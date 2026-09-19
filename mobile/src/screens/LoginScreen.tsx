import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { ApiService } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const LoginScreen = ({ navigation }: any) => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      setError('Please enter your email/username and password');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const data = await ApiService.login({
        identifier: identifier.trim(),
        password,
      });

      await login(data.token, data.user);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerBox}>
          <Text style={styles.logoBadge}>💬</Text>
          <Text style={styles.title}>PulseChat</Text>
          <Text style={styles.subtitle}>Welcome back! Sign in to continue</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <Text style={styles.label}>Email or Username</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. john@example.com or @john"
            placeholderTextColor="#8696a0"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#8696a0"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.disabledBtn]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Log In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b141a',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoBadge: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e9edef',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#8696a0',
  },
  errorBox: {
    backgroundColor: 'rgba(234, 67, 53, 0.15)',
    borderWidth: 1,
    borderColor: '#ea4335',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  label: {
    color: '#8696a0',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#111b21',
    borderWidth: 1,
    borderColor: '#202c33',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#e9edef',
    fontSize: 15,
    marginBottom: 18,
  },
  loginBtn: {
    backgroundColor: '#00a884',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#00a884',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: '#111b21',
    fontWeight: 'bold',
    fontSize: 16,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#8696a0',
    fontSize: 14,
  },
  signupLink: {
    color: '#00a884',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
