import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { AdBanner } from '../components/AdBanner';

export const CallsScreen = () => {
  const dummyCalls = [
    { id: '1', name: 'David Miller', type: 'incoming', date: 'Today, 2:30 PM', isVideo: true, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=david' },
    { id: '2', name: 'Sarah Jenkins', type: 'outgoing', date: 'Yesterday, 8:15 PM', isVideo: false, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calls</Text>
      </View>

      <FlatList
        data={dummyCalls}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.callRow}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={styles.callInfo}>
              <Text style={styles.nameText}>{item.name}</Text>
              <Text style={styles.dateText}>
                {item.type === 'incoming' ? '↙ Incoming' : '↗ Outgoing'} • {item.date}
              </Text>
            </View>
            <TouchableOpacity style={styles.callBtn}>
              <Text style={styles.callIcon}>{item.isVideo ? '📹' : '📞'}</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📞</Text>
            <Text style={styles.emptyText}>No recent call logs</Text>
          </View>
        }
      />

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
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#202c33',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#00a884',
  },
  listContent: {
    paddingVertical: 8,
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111b21',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#202c33',
    marginRight: 14,
  },
  callInfo: {
    flex: 1,
  },
  nameText: {
    color: '#e9edef',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  dateText: {
    color: '#8696a0',
    fontSize: 13,
  },
  callBtn: {
    padding: 8,
  },
  callIcon: {
    fontSize: 20,
  },
  emptyBox: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyText: {
    color: '#8696a0',
    fontSize: 14,
  },
});
