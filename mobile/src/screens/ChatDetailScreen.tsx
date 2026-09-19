import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { ApiService, Message, User } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  getSocket,
  joinChatRoom,
  emitSendMessage,
  emitTypingStart,
  emitTypingStop,
} from '../services/socket';
import { MessageItem } from '../components/MessageItem';
import { showInterstitialAd } from '../services/admob';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../config';

export const ChatDetailScreen = ({ route, navigation }: any) => {
  const { chatId, partner } = route.params as { chatId: string; partner: User };
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const storageKey = `${CONFIG.STORAGE_KEYS.MESSAGES_PREFIX}${chatId}`;

  // Flush Outbox Queue on Reconnect
  const flushOutbox = async () => {
    try {
      const storedOutbox = await AsyncStorage.getItem(CONFIG.STORAGE_KEYS.OUTBOX);
      if (!storedOutbox) return;
      const queue: Message[] = JSON.parse(storedOutbox);
      if (queue.length === 0) return;

      const remaining: Message[] = [];
      for (const item of queue) {
        emitSendMessage({
          chatId: item.chatId,
          senderId: item.senderId,
          receiverId: item.receiverId,
          content: item.content,
          type: item.type,
        });

        // Mark as sent in state if in current chat
        if (item.chatId === chatId) {
          setMessages((prev) =>
            prev.map((m) => (m.id === item.id ? { ...m, status: 'sent' } : m))
          );
        }
      }
      await AsyncStorage.setItem(CONFIG.STORAGE_KEYS.OUTBOX, JSON.stringify(remaining));
    } catch (e) {
      console.warn('Error flushing outbox:', e);
    }
  };

  // Load existing messages (Offline cache first, then API)
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        // 1. Load from AsyncStorage cache first
        const cached = await AsyncStorage.getItem(storageKey);
        if (cached) {
          setMessages(JSON.parse(cached));
          setLoading(false);
        }

        // 2. Fetch fresh messages from API
        const data = await ApiService.getMessages(chatId);
        setMessages(data);
        await AsyncStorage.setItem(storageKey, JSON.stringify(data));
      } catch (err) {
        console.warn('Using cached messages offline:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    joinChatRoom(chatId);

    const socket = getSocket();
    if (socket) {
      if (socket.connected) {
        flushOutbox();
      }
      socket.on('connect', flushOutbox);

      socket.on('new_message', async (newMsg: Message) => {
        if (newMsg.chatId === chatId) {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === newMsg.id);
            const updated = exists ? prev.map((m) => (m.id === newMsg.id ? newMsg : m)) : [...prev, newMsg];
            AsyncStorage.setItem(storageKey, JSON.stringify(updated)).catch(() => {});
            return updated;
          });
        }
      });

      socket.on('typing_start', ({ userId }: { userId: string }) => {
        if (userId === partner.id) {
          setIsPartnerTyping(true);
        }
      });

      socket.on('typing_stop', ({ userId }: { userId: string }) => {
        if (userId === partner.id) {
          setIsPartnerTyping(false);
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('connect', flushOutbox);
        socket.off('new_message');
        socket.off('typing_start');
        socket.off('typing_stop');
      }
      // Show full screen ad occasionally when leaving a conversation
      if (Math.random() > 0.5) {
        showInterstitialAd();
      }
    };
  }, [chatId]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    if (!user) return;

    emitTypingStart(chatId, user.id, user.username);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emitTypingStop(chatId, user.id);
    }, 1500);
  };

  const handleSend = async () => {
    if (!inputText.trim() || !user) return;

    const content = inputText.trim();
    setInputText('');
    emitTypingStop(chatId, user.id);

    const socket = getSocket();
    const isSocketOnline = Boolean(socket && socket.connected);

    const tempMsg: Message = {
      id: 'temp_' + Date.now(),
      chatId,
      senderId: user.id,
      receiverId: partner.id,
      content,
      type: 'text',
      status: isSocketOnline ? 'sent' : 'pending',
      timestamp: new Date().toISOString(),
    };

    // Optimistic UI update
    setMessages((prev) => {
      const next = [...prev, tempMsg];
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
      return next;
    });

    if (!isSocketOnline) {
      // Offline: Enqueue in outbox
      try {
        const storedOutbox = await AsyncStorage.getItem(CONFIG.STORAGE_KEYS.OUTBOX);
        const queue = storedOutbox ? JSON.parse(storedOutbox) : [];
        queue.push(tempMsg);
        await AsyncStorage.setItem(CONFIG.STORAGE_KEYS.OUTBOX, JSON.stringify(queue));
      } catch (e) {
        console.warn('Error saving to outbox:', e);
      }
      return;
    }

    // Online: Emit via Socket.io
    emitSendMessage({
      chatId,
      senderId: user.id,
      receiverId: partner.id,
      content,
      type: 'text',
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <Image
          source={{
            uri: partner.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner.username}`,
          }}
          style={styles.headerAvatar}
        />

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerName}>{partner.displayName}</Text>
          <Text style={styles.headerSub}>
            {isPartnerTyping ? 'typing...' : `@${partner.username}`}
          </Text>
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#00a884" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageItem message={item} currentUserId={user?.id || ''} />
          )}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor="#8696a0"
          value={inputText}
          onChangeText={handleInputChange}
          multiline
        />

        <TouchableOpacity
          style={[styles.sendBtn, !inputText.trim() && styles.disabledSendBtn]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b141a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111b21',
    paddingTop: 44,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#202c33',
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  backIcon: {
    color: '#00a884',
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#202c33',
  },
  headerTitleBox: {
    flex: 1,
  },
  headerName: {
    color: '#e9edef',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerSub: {
    color: '#00a884',
    fontSize: 12,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageList: {
    paddingVertical: 12,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111b21',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#202c33',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#202c33',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    color: '#e9edef',
    fontSize: 15,
    marginRight: 8,
  },
  sendBtn: {
    backgroundColor: '#00a884',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledSendBtn: {
    backgroundColor: '#202c33',
    opacity: 0.5,
  },
  sendIcon: {
    color: '#111b21',
    fontSize: 16,
    marginLeft: 2,
  },
});
