import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { AdBanner } from '../components/AdBanner';

export const ProfileScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of PulseChat?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile & Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* User Card */}
        <View style={styles.profileCard}>
          <Image
            source={{
              uri: user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`,
            }}
            style={styles.avatar}
          />

          <Text style={styles.displayName}>{user?.displayName}</Text>
          <Text style={styles.username}>@{user?.username}</Text>

          {user?.isEmailVerified ? (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓ Verified Account</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.unverifiedBadge}
              onPress={() => navigation.navigate('OtpVerify')}
            >
              <Text style={styles.unverifiedText}>⚠️ Email Unverified — Verify Now</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Info Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.itemRow}>
            <Text style={styles.itemLabel}>Status</Text>
            <Text style={styles.itemValue}>{user?.status || 'Hey there! I am using PulseChat.'}</Text>
          </View>
          <View style={styles.itemRow}>
            <Text style={styles.itemLabel}>Email</Text>
            <Text style={styles.itemValue}>{user?.email}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Info</Text>
          <View style={styles.itemRow}>
            <Text style={styles.itemLabel}>Version</Text>
            <Text style={styles.itemValue}>1.0.0 (Native React Native)</Text>
          </View>
          <View style={styles.itemRow}>
            <Text style={styles.itemLabel}>Backend Server</Text>
            <Text style={styles.itemValue}>pulsechat-xzul.onrender.com</Text>
          </View>
          <View style={styles.itemRow}>
            <Text style={styles.itemLabel}>Monetization</Text>
            <Text style={styles.itemValue}>Google AdMob Integrated 🟢</Text>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out of PulseChat</Text>
        </TouchableOpacity>
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
    padding: 16,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#111b21',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#202c33',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#202c33',
    marginBottom: 12,
  },
  displayName: {
    color: '#e9edef',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  username: {
    color: '#8696a0',
    fontSize: 14,
    marginBottom: 12,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(0, 168, 132, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00a884',
  },
  verifiedText: {
    color: '#00a884',
    fontSize: 12,
    fontWeight: 'bold',
  },
  unverifiedBadge: {
    backgroundColor: 'rgba(234, 67, 53, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ea4335',
  },
  unverifiedText: {
    color: '#ff6b6b',
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: '#111b21',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#202c33',
  },
  sectionTitle: {
    color: '#00a884',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#202c33',
  },
  itemLabel: {
    color: '#8696a0',
    fontSize: 14,
  },
  itemValue: {
    color: '#e9edef',
    fontSize: 14,
    fontWeight: '500',
  },
  logoutBtn: {
    backgroundColor: '#202c33',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ea4335',
    marginVertical: 8,
  },
  logoutText: {
    color: '#ff6b6b',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
