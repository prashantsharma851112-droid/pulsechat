import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { AdBanner } from '../components/AdBanner';

export const StatusScreen = () => {
  const { user } = useAuth();

  const dummyStatuses = [
    { id: '1', name: 'Sarah Jenkins', time: '10 minutes ago', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah' },
    { id: '2', name: 'David Miller', time: '1 hour ago', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=david' },
    { id: '3', name: 'Elena Rostova', time: '3 hours ago', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=elena' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Status & Stories</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* My Status */}
        <TouchableOpacity style={styles.statusRow}>
          <View style={styles.myAvatarWrapper}>
            <Image
              source={{ uri: user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}` }}
              style={styles.avatar}
            />
            <View style={styles.addBadge}>
              <Text style={styles.addBadgeText}>+</Text>
            </View>
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.nameText}>My Status</Text>
            <Text style={styles.subText}>Tap to add status update</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionHeader}>Recent Updates</Text>

        {dummyStatuses.map((item) => (
          <TouchableOpacity key={item.id} style={styles.statusRow}>
            <View style={styles.storyRing}>
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.nameText}>{item.name}</Text>
              <Text style={styles.subText}>{item.time}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
  content: {
    paddingVertical: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  myAvatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#202c33',
  },
  addBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#00a884',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0b141a',
  },
  addBadgeText: {
    color: '#111b21',
    fontWeight: 'bold',
    fontSize: 14,
  },
  storyRing: {
    marginRight: 14,
    padding: 2,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: '#00a884',
  },
  textContainer: {
    flex: 1,
  },
  nameText: {
    color: '#e9edef',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  subText: {
    color: '#8696a0',
    fontSize: 13,
  },
  sectionHeader: {
    color: '#8696a0',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
});
