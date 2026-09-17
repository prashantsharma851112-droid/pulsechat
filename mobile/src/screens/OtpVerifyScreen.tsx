import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ApiService } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const OtpVerifyScreen = ({ navigation }: any) => {
  const { user, updateUser } = useAuth();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    if (!otp.trim() || otp.trim().length < 6) {
      setError('Please enter your 6-digit verification code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await ApiService.verifyOtp(user?.email || '', otp.trim(), user?.id);

      if (res.success) {
        updateUser({ isEmailVerified: true });
        Alert.alert('Verified! 🎉', 'Your email address has been verified successfully.', [
          { text: 'Continue', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid OTP code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setResending(true);
      setError('');
      const res = await ApiService.sendOtp(user?.email || '');
      Alert.alert('Code Sent', `A new verification code was sent to ${user?.email}. (Demo Code: ${res.otp})`);
    } catch (err: any) {
      setError('Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>✉️</Text>
        <Text style={styles.title}>Email Verification</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit verification code sent to{'\n'}
          <Text style={styles.emailHighlight}>{user?.email || 'your email'}</Text>
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TextInput
          style={styles.otpInput}
          placeholder="123456"
          placeholderTextColor="#8696a0"
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
        />

        <TouchableOpacity
          style={[styles.verifyBtn, loading && styles.disabledBtn]}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#111b21" /> : <Text style={styles.verifyBtnText}>Verify Email</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.resendBtn} onPress={handleResend} disabled={resending}>
          <Text style={styles.resendText}>
            {resending ? 'Sending...' : "Didn't receive the code? Resend"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b141a',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
  },
  icon: {
    fontSize: 52,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e9edef',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#8696a0',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  emailHighlight: {
    color: '#00a884',
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: 'rgba(234, 67, 53, 0.15)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
    textAlign: 'center',
  },
  otpInput: {
    backgroundColor: '#111b21',
    borderWidth: 2,
    borderColor: '#00a884',
    borderRadius: 12,
    width: '80%',
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e9edef',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 24,
  },
  verifyBtn: {
    backgroundColor: '#00a884',
    width: '100%',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  verifyBtnText: {
    color: '#111b21',
    fontWeight: 'bold',
    fontSize: 16,
  },
  resendBtn: {
    padding: 8,
  },
  resendText: {
    color: '#00a884',
    fontSize: 14,
  },
});
