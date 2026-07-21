import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { forgotPassword, resetPassword } from '../../services/api';
import Colors from '../../constants/colors';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [step, setStep] = useState(1);           // 1 = enter email, 2 = enter OTP + new password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);

  // Orbs
  const orb1 = useRef(new Animated.Value(0)).current;
  const orb2 = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(100)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const floatOrb = (anim, delay) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 3000, useNativeDriver: true, delay }),
          Animated.timing(anim, { toValue: 0, duration: 3000, useNativeDriver: true }),
        ])
      ).start();
    };
    floatOrb(orb1, 0);
    floatOrb(orb2, 1200);
    Animated.parallel([
      Animated.timing(sheetY, { toValue: 0, duration: 600, useNativeDriver: true, delay: 200 }),
      Animated.timing(sheetOpacity, { toValue: 1, duration: 600, useNativeDriver: true, delay: 200 }),
    ]).start();
  }, []);

  const orb1Y = orb1.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });
  const orb2Y = orb2.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });

  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!emailOk) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      await forgotPassword({ email: trimmed });
      setEmail(trimmed);
      setStep(2);
      Alert.alert('Check your email', 'If an account exists for that email, a 6-digit reset code has been sent. It expires in 10 minutes.');
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not send reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit code from your email');
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ email, otp, password });
      Alert.alert('Success', 'Your password has been reset. Please sign in.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.bg}>
        <Animated.View style={[styles.orb, styles.orb1, { transform: [{ translateY: orb1Y }] }]} />
        <Animated.View style={[styles.orb, styles.orb2, { transform: [{ translateY: orb2Y }] }]} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Top bar */}
            <View style={styles.topBar}>
              <TouchableOpacity
                onPress={() => step === 1 ? router.back() : setStep(1)}
                style={styles.backBtn}
              >
                <Ionicons name="arrow-back" size={20} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.topTitle}>Reset Password</Text>
              <View style={{ width: 38 }} />
            </View>

            {/* Icon */}
            <View style={styles.iconWrap}>
              <LinearGradient
                colors={['rgba(52,211,153,0.3)', 'rgba(45,212,191,0.3)']}
                style={styles.iconRing}
              >
                <Ionicons name={step === 1 ? 'mail-outline' : 'shield-checkmark-outline'} size={34} color="#fff" />
              </LinearGradient>
            </View>

            <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }], opacity: sheetOpacity }]}>
              <View style={styles.handle} />

              {step === 1 ? (
                <>
                  <Text style={styles.sheetTitle}>Forgot your password?</Text>
                  <Text style={styles.sheetSub}>Enter your registered email and we'll send you a 6-digit reset code.</Text>

                  <Text style={styles.label}>EMAIL ADDRESS</Text>
                  <View style={[styles.inputWrap, focusedInput === 'email' && styles.inputFocused]}>
                    <Ionicons name="mail-outline" size={18} color={focusedInput === 'email' ? Colors.primary : 'rgba(255,255,255,0.3)'} />
                    <TextInput
                      style={styles.input}
                      placeholder="your@email.com"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() => setFocusedInput('email')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>

                  <TouchableOpacity onPress={handleSendCode} disabled={loading} style={styles.btnWrap}>
                    <LinearGradient
                      colors={['#34d399', '#2dd4bf']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.btn}
                    >
                      {loading
                        ? <ActivityIndicator color="#fff" />
                        : <>
                            <Text style={styles.btnText}>Send Reset Code</Text>
                            <Ionicons name="arrow-forward" size={18} color="#fff" />
                          </>}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.sheetTitle}>Enter reset code</Text>
                  <Text style={styles.sheetSub}>We sent a 6-digit code to {email}. Enter it below with your new password.</Text>

                  <Text style={styles.label}>6-DIGIT CODE</Text>
                  <View style={[styles.inputWrap, focusedInput === 'otp' && styles.inputFocused]}>
                    <Ionicons name="key-outline" size={18} color={focusedInput === 'otp' ? Colors.primary : 'rgba(255,255,255,0.3)'} />
                    <TextInput
                      style={[styles.input, styles.otpInput]}
                      placeholder="000000"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      value={otp}
                      onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      maxLength={6}
                      onFocus={() => setFocusedInput('otp')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>

                  <Text style={styles.label}>NEW PASSWORD</Text>
                  <View style={[styles.inputWrap, focusedInput === 'password' && styles.inputFocused]}>
                    <Ionicons name="lock-closed-outline" size={18} color={focusedInput === 'password' ? Colors.primary : 'rgba(255,255,255,0.3)'} />
                    <TextInput
                      style={styles.input}
                      placeholder="At least 6 characters"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      onFocus={() => setFocusedInput('password')}
                      onBlur={() => setFocusedInput(null)}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.3)" />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={handleReset} disabled={loading} style={styles.btnWrap}>
                    <LinearGradient
                      colors={['#34d399', '#2dd4bf']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.btn}
                    >
                      {loading
                        ? <ActivityIndicator color="#fff" />
                        : <>
                            <Text style={styles.btnText}>Reset Password</Text>
                            <Ionicons name="checkmark" size={18} color="#fff" />
                          </>}
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.resend} onPress={handleSendCode} disabled={loading}>
                    <Text style={styles.resendText}>Didn't get it? Resend code</Text>
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07231f' },
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  orb: { position: 'absolute', borderRadius: 999 },
  orb1: { width: 280, height: 280, backgroundColor: 'rgba(52,211,153,0.30)', top: -60, right: -60 },
  orb2: { width: 220, height: 220, backgroundColor: 'rgba(45,212,191,0.18)', top: 220, left: -80 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 16 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  iconWrap: { alignItems: 'center', marginTop: 10, marginBottom: 20 },
  iconRing: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  sheet: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    borderWidth: 1, borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 28, paddingBottom: 48, flex: 1,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 24 },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 6 },
  sheetSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24, lineHeight: 19 },
  label: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 16,
  },
  inputFocused: { borderColor: 'rgba(52,211,153,0.6)', backgroundColor: 'rgba(52,211,153,0.08)' },
  input: { flex: 1, fontSize: 15, color: '#fff' },
  otpInput: { letterSpacing: 8, fontWeight: '700', fontSize: 18 },
  btnWrap: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  btn: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  resend: { alignItems: 'center', marginTop: 18 },
  resendText: { fontSize: 13, color: 'rgba(52,211,153,0.8)', fontWeight: '600' },
});
