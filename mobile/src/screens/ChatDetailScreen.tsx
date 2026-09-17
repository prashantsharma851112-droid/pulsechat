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

export const ChatDetailScreen = ({ route, navigation }: any) => {
  const { chatId, partner } = route.params as { chatId: string; partner: User };
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load existing messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const data = await ApiService.getMessages(chatId);
        setMessages(data);
      } catch (err) {
        console.error('Failed to load chat messages:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    joinChatRoom(chatId);

    const socket = getSocket();
    if (socket) {
      socket.on('new_message', (newMsg: Message) => {
        if (newMsg.chatId === chatId) {
          setMessages((prev) => [...prev, newMsg]);
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

    const tempMsg: Message = {
      id: 'temp_' + Date.now(),
      chatId,
      senderId: user.id,
      receiverId: partner.id,
      content,
      type: 'text',
      status: 'sent',
      timestamp: new Date().toISOString(),
    };

    // Optimistic UI update
    setMessages((prev) => [...prev, tempMsg]);

    // Emit via Socket.io
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
