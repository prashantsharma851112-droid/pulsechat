import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { ApiService, User } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../services/socket';
import { AdBanner } from '../components/AdBanner';

export const ChatListScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  const loadData = async () => {
    try {
      const data = await ApiService.getUsers();
      // Filter out self
      const otherUsers = data.filter((u) => u.id !== user?.id);
      setUsers(otherUsers);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    const socket = getSocket();
    if (socket) {
      socket.on('online_users_list', (list: string[]) => {
        setOnlineUsers(list);
      });

      socket.on('user_status', ({ userId, status }: { userId: string; status: string }) => {
        setOnlineUsers((prev) => {
          if (status === 'online') {
            return prev.includes(userId) ? prev : [...prev, userId];
          } else {
            return prev.filter((id) => id !== userId);
          }
        });
      });
    }

    return () => {
      if (socket) {
        socket.off('online_users_list');
        socket.off('user_status');
      }
    };
  }, []);

  const filteredUsers = users.filter(
    (u) =>
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderChatItem = ({ item }: { item: User }) => {
    const isOnline = onlineUsers.includes(item.id);
    const chatId = [user?.id, item.id].sort().join('_');

    return (
      <TouchableOpacity
        style={styles.chatCard}
        onPress={() =>
          navigation.navigate('ChatDetail', {
            chatId,
            partner: item,
          })
        }
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrapper}>
          <Image
            source={{
              uri: item.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.username}`,
            }}
            style={styles.avatar}
          />
          {isOnline && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.topRow}>
            <Text style={styles.nameText}>{item.displayName}</Text>
            <Text style={styles.usernameTag}>@{item.username}</Text>
          </View>

          <Text style={styles.statusText} numberOfLines={1}>
            {item.status || 'Hey there! I am using PulseChat.'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.brandTitle}>PulseChat</Text>
          <View style={styles.onlinePill}>
            <View style={styles.greenPulse} />
            <Text style={styles.onlineCountText}>{onlineUsers.length} Online</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor="#8696a0"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Chat List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#00a884" />
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              tintColor="#00a884"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>No conversations found</Text>
              <Text style={styles.emptySub}>Invite your friends to chat on PulseChat!</Text>
            </View>
          }
        />
      )}

      {/* Non-intrusive Google AdMob Banner */}
      <AdBanner />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b141a',
  },
  header: {
    backgroundColor: '#111b21',
    paddingTop: 44,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#202c33',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#00a884',
    letterSpacing: 0.5,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2c34',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  greenPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00a884',
    marginRight: 6,
  },
  onlineCountText: {
    color: '#e9edef',
    fontSize: 12,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#202c33',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#e9edef',
    fontSize: 14,
  },
  listContent: {
    paddingVertical: 6,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111b21',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#202c33',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#00a884',
    borderWidth: 2,
    borderColor: '#0b141a',
  },
  chatInfo: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nameText: {
    color: '#e9edef',
    fontSize: 16,
    fontWeight: '600',
  },
  usernameTag: {
    color: '#8696a0',
    fontSize: 12,
  },
  statusText: {
    color: '#8696a0',
    fontSize: 14,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#e9edef',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  emptySub: {
    color: '#8696a0',
    fontSize: 14,
  },
});
