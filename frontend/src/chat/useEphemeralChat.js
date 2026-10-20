import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteOutboxItem,
  getConversation,
  getMessage,
  getOutbox,
  getPendingOutgoing,
  getConversationKey,
  putOutbox,
  updateMessage,
  upsertMessage
} from './chatDb.js';

const RETRY_INTERVAL_MS = 15_000;
const ACK_TIMEOUT_MS = 8_000;

function newMessageId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

function toId(user) {
  return String(user?._id ?? user?.id ?? user?.userId ?? '');
}

export function useEphemeralChat({ socket, me, activePeerId }) {
  const meId = toId(me);
  const activePeerRef = useRef(activePeerId ? String(activePeerId) : '');
  const meIdRef = useRef(meId);
  const sendingIds = useRef(new Set());
  const deliveryIds = useRef(new Set());
  const readIds = useRef(new Set());
  const [messages, setMessages] = useState([]);
  const [loadingLocal, setLoadingLocal] = useState(Boolean(activePeerId));
  const [lastError, setLastError] = useState('');

  activePeerRef.current = activePeerId ? String(activePeerId) : '';
  meIdRef.current = meId;

  const refreshActiveConversation = useCallback(async () => {
    const currentMe = meIdRef.current;
    const peerId = activePeerRef.current;
    if (!currentMe || !peerId) {
      setMessages([]);
      setLoadingLocal(false);
      return;
    }
    try {
      const localMessages = await getConversation(currentMe, peerId);
      setMessages(localMessages);
    } catch (error) {
      setLastError(error.message || 'Could not load local chat history.');
    } finally {
      setLoadingLocal(false);
    }
  }, []);

  const sendOutgoingToServer = useCallback((message) => {
    if (!socket || !socket.connected || sendingIds.current.has(message.messageId)) return;
    sendingIds.current.add(message.messageId);

    socket.timeout(ACK_TIMEOUT_MS).emit(
      'chat:send',
      {
        messageId: message.messageId,
        receiverId: message.receiverId,
        content: message.content
      },
      async (timeoutError, response) => {
        sendingIds.current.delete(message.messageId);
        if (timeoutError || !response?.ok) {
          if (response?.error === 'MESSAGE_EXPIRED') {
            await updateMessage(message.messageId, { status: 'expired' });
            await refreshActiveConversation();
          } else if (response?.error) {
            setLastError(`Message not accepted: ${response.error}`);
          }
          return;
        }
        await updateMessage(message.messageId, {
          status: response.alreadyDelivered ? 'delivered' : 'sent',
          receiptToken: response.receiptToken || message.receiptToken || null
        });
        await refreshActiveConversation();
      }
    );
  }, [socket, refreshActiveConversation]);

  const sendDeliveryOutbox = useCallback(async () => {
    if (!socket?.connected) return;
    const pending = await getOutbox('deliveryOutbox');
    for (const item of pending) {
      if (deliveryIds.current.has(item.messageId)) continue;
      deliveryIds.current.add(item.messageId);
      socket.timeout(ACK_TIMEOUT_MS).emit('chat:delivered', item, async (timeoutError, response) => {
        deliveryIds.current.delete(item.messageId);
        if (!timeoutError && response?.ok) {
          await deleteOutboxItem('deliveryOutbox', item.messageId);
        }
      });
    }
  }, [socket]);

  const sendReadOutbox = useCallback(async () => {
    if (!socket?.connected) return;
    const pending = await getOutbox('readOutbox');
    for (const item of pending) {
      if (readIds.current.has(item.messageId)) continue;
      readIds.current.add(item.messageId);
      socket.timeout(ACK_TIMEOUT_MS).emit('chat:receipt:read', item, async (timeoutError, response) => {
        readIds.current.delete(item.messageId);
        if (!timeoutError && response?.ok) {
          await deleteOutboxItem('readOutbox', item.messageId);
        }
      });
    }
  }, [socket]);

  const flushPendingOutgoing = useCallback(async () => {
    if (!socket?.connected) return;
    const pending = await getPendingOutgoing();
    pending.forEach(sendOutgoingToServer);
  }, [socket, sendOutgoingToServer]);

  const flushEverything = useCallback(async () => {
    await flushPendingOutgoing();
    await sendDeliveryOutbox();
    await sendReadOutbox();
  }, [flushPendingOutgoing, sendDeliveryOutbox, sendReadOutbox]);

  const sendMessage = useCallback(async (receiverIdInput, text) => {
    const receiverId = String(receiverIdInput || '');
    const content = String(text ?? '').trim();
    if (!meId || !receiverId) throw new Error('A logged-in user and receiver are required.');
    if (!content) return null;
    if (content.length > 10_000) throw new Error('Messages can be at most 10,000 characters.');

    const createdAt = new Date().toISOString();
    const message = {
      messageId: newMessageId(),
      senderId: meId,
      receiverId,
      conversationKey: getConversationKey(meId, receiverId),
      content,
      createdAt,
      direction: 'outgoing',
      status: 'sending',
      receiptToken: null,
      isRead: false
    };

    // Save locally before network I/O; refresh never depends on server history.
    await upsertMessage(message);
    await refreshActiveConversation();
    sendOutgoingToServer(message);
    return message;
  }, [meId, refreshActiveConversation, sendOutgoingToServer]);

  useEffect(() => {
    refreshActiveConversation();
  }, [activePeerId, meId, refreshActiveConversation]);

  useEffect(() => {
    if (!socket || !meId) return undefined;

    const handleIncomingMessage = async (wireMessage) => {
      if (!wireMessage?.messageId || String(wireMessage.receiverId) !== meIdRef.current) return;
      const senderId = String(wireMessage.senderId);
      const receiverId = String(wireMessage.receiverId);
      const message = {
        ...wireMessage,
        senderId,
        receiverId,
        conversationKey: getConversationKey(senderId, receiverId),
        createdAt: wireMessage.createdAt || new Date().toISOString(),
        direction: 'incoming',
        isRead: false
      };
      try {
        // IndexedDB commit finishes before any delivery ACK leaves this browser.
        await upsertMessage(message);
        await putOutbox('deliveryOutbox', {
          messageId: message.messageId,
          receiptToken: message.receiptToken
        });
        await refreshActiveConversation();
        await sendDeliveryOutbox();
      } catch (error) {
        // No ACK is sent if local persistence fails; server keeps the queue item.
        setLastError(error.message || 'Could not save the received message locally.');
      }
    };

    const handleDeliveredReceipt = async (receipt, acknowledge) => {
      try {
        const local = await getMessage(receipt?.messageId);
        if (local && local.direction === 'outgoing' && local.senderId === meIdRef.current) {
          await updateMessage(receipt.messageId, { status: 'delivered' });
          await refreshActiveConversation();
          if (typeof acknowledge === 'function') acknowledge({ ok: true });
        } else if (typeof acknowledge === 'function') {
          acknowledge({ ok: false });
        }
      } catch {
        if (typeof acknowledge === 'function') acknowledge({ ok: false });
      }
    };

    const handleReadReceipt = async (receipt, acknowledge) => {
      try {
        const local = await getMessage(receipt?.messageId);
        if (local && local.direction === 'outgoing' && local.senderId === meIdRef.current) {
          await updateMessage(receipt.messageId, { status: 'read' });
          await refreshActiveConversation();
          if (typeof acknowledge === 'function') acknowledge({ ok: true });
        } else if (typeof acknowledge === 'function') {
          acknowledge({ ok: false });
        }
      } catch {
        if (typeof acknowledge === 'function') acknowledge({ ok: false });
      }
    };

    const handleConnect = () => {
      socket.emit('chat:sync', {}, () => {});
      flushEverything().catch((error) => setLastError(error.message));
    };

    socket.on('chat:message', handleIncomingMessage);
    socket.on('chat:receipt:delivered', handleDeliveredReceipt);
    socket.on('chat:receipt:read', handleReadReceipt);
    socket.on('connect', handleConnect);

    if (socket.connected) handleConnect();

    // Retry only local outboxes and locally-pending sends. The message body is
    // never fetched back from MongoDB after the receiver has persisted it.
    const retryTimer = setInterval(() => {
      if (!socket.connected) return;
      socket.emit('chat:sync', {}, () => {});
      flushEverything().catch((error) => setLastError(error.message));
    }, RETRY_INTERVAL_MS);

    return () => {
      clearInterval(retryTimer);
      socket.off('chat:message', handleIncomingMessage);
      socket.off('chat:receipt:delivered', handleDeliveredReceipt);
      socket.off('chat:receipt:read', handleReadReceipt);
      socket.off('connect', handleConnect);
    };
  }, [socket, meId, refreshActiveConversation, sendDeliveryOutbox, flushEverything]);

  useEffect(() => {
    if (!activePeerId || !meId) return;
    let cancelled = false;

    const markVisibleIncomingAsRead = async () => {
      const localMessages = await getConversation(meId, String(activePeerId));
      const unread = localMessages.filter(
        (message) => message.direction === 'incoming' && !message.isRead && message.receiptToken
      );
      if (unread.length === 0 || cancelled) return;

      for (const message of unread) {
        await updateMessage(message.messageId, { isRead: true });
        await putOutbox('readOutbox', {
          messageId: message.messageId,
          receiptToken: message.receiptToken
        });
      }
      await refreshActiveConversation();
      await sendReadOutbox();
    };

    markVisibleIncomingAsRead().catch((error) => setLastError(error.message));
    return () => { cancelled = true; };
  }, [messages, activePeerId, meId, refreshActiveConversation, sendReadOutbox]);

  return {
    messages,
    loadingLocal,
    lastError,
    sendMessage,
    refreshActiveConversation,
    clearError: () => setLastError('')
  };
}
