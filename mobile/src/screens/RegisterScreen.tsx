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

export const RegisterScreen = ({ navigation }: any) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'checking' | 'available' | 'taken' | ''>('');

  const handleUsernameChange = async (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(clean);

    if (clean.length >= 3) {
      setUsernameStatus('checking');
      const isAvail = await ApiService.checkUsername(clean);
      setUsernameStatus(isAvail ? 'available' : 'taken');
    } else {
      setUsernameStatus('');
    }
  };

  const handleRegister = async () => {
    if (!email.trim() || !username.trim() || !displayName.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (usernameStatus === 'taken') {
      setError('Username is already taken');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const data = await ApiService.register({
        email: email.trim(),
        username: username.trim(),
        displayName: displayName.trim(),
        password,
      });

      // Automatically send OTP code for verification
      try {
        await ApiService.sendOtp(email.trim());
      } catch {
        // Proceed even if OTP email send fails locally
      }

      await login(data.token, data.user);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
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
          <Text style={styles.logoBadge}>✨</Text>
          <Text style={styles.title}>Join PulseChat</Text>
          <Text style={styles.subtitle}>Create your free account in seconds</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Alex Rivera"
            placeholderTextColor="#8696a0"
            value={displayName}
            onChangeText={setDisplayName}
          />

          <Text style={styles.label}>Unique Username</Text>
          <View style={styles.inputWithBadge}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="e.g. alex_rivera"
              placeholderTextColor="#8696a0"
              value={username}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
            />
            {usernameStatus === 'checking' && <ActivityIndicator color="#00a884" style={styles.statusBadge} />}
            {usernameStatus === 'available' && <Text style={[styles.statusBadge, { color: '#00a884' }]}>✓ Available</Text>}
            {usernameStatus === 'taken' && <Text style={[styles.statusBadge, { color: '#ff6b6b' }]}>✗ Taken</Text>}
          </View>

          <Text style={[styles.label, { marginTop: 18 }]}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. alex@example.com"
            placeholderTextColor="#8696a0"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="At least 6 characters"
            placeholderTextColor="#8696a0"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.registerBtn, loading && styles.disabledBtn]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.registerBtnText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Log In</Text>
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
    paddingTop: 50,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    fontSize: 44,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
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
    marginBottom: 16,
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
    marginBottom: 16,
  },
  inputWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    position: 'absolute',
    right: 12,
    fontSize: 12,
    fontWeight: 'bold',
  },
  registerBtn: {
    backgroundColor: '#00a884',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  registerBtnText: {
    color: '#111b21',
    fontWeight: 'bold',
    fontSize: 16,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#8696a0',
    fontSize: 14,
  },
  loginLink: {
    color: '#00a884',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
