import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert, Animated, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import Colors from '../../constants/colors';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);

  // Animations
  const orb1 = useRef(new Animated.Value(0)).current;
  const orb2 = useRef(new Animated.Value(0)).current;
  const orb3 = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(100)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Orb floating animations
    const floatOrb = (anim, delay) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 3000 + delay, useNativeDriver: true, delay }),
          Animated.timing(anim, { toValue: 0, duration: 3000 + delay, useNativeDriver: true }),
        ])
      ).start();
    };
    floatOrb(orb1, 0);
    floatOrb(orb2, 1000);
    floatOrb(orb3, 2000);

    // Logo entrance
    Animated.spring(logoScale, {
      toValue: 1, tension: 50, friction: 7,
      useNativeDriver: true, delay: 200,
    }).start();

    // Sheet entrance
    Animated.parallel([
      Animated.timing(sheetY, { toValue: 0, duration: 600, useNativeDriver: true, delay: 400 }),
      Animated.timing(sheetOpacity, { toValue: 1, duration: 600, useNativeDriver: true, delay: 400 }),
    ]).start();
  }, []);

  const orb1Y = orb1.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });
  const orb2Y = orb2.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  const orb3Y = orb3.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });

  const handleLogin = async () => {
    console.log('LOGIN PRESSED', phone, password);
    if (!phone || !password) {
      Alert.alert('Error', 'Please enter phone and password');
      return;
    }
    setLoading(true);
    const result = await login(phone, password);
    console.log('LOGIN RESULT',result);
    setLoading(false);
    if (!result.success) {
      Alert.alert('Login Failed', result.message);
    }
  };

  return (
    <View style={styles.container}>

      {/* Animated background */}
      <View style={styles.bg}>
        <Animated.View style={[styles.orb, styles.orb1, { transform: [{ translateY: orb1Y }] }]} />
        <Animated.View style={[styles.orb, styles.orb2, { transform: [{ translateY: orb2Y }] }]} />
        <Animated.View style={[styles.orb, styles.orb3, { transform: [{ translateY: orb3Y }] }]} />
      </View>

      {/* Grid overlay */}
      <View style={styles.grid} />

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

            {/* Logo section */}
            <View style={styles.top}>
              <Animated.View style={[styles.logoWrap, { transform: [{ scale: logoScale }] }]}>
                <LinearGradient
                  colors={['rgba(108,99,255,0.3)', 'rgba(240,147,251,0.3)']}
                  style={styles.logoRing}
                >
                  <View style={styles.logoInner}>
                    <Ionicons name="home" size={36} color="#fff" />
                  </View>
                </LinearGradient>
                <Text style={styles.appName}>Hill Park Avenue</Text>
                <Text style={styles.appSub}>YOUR COMMUNITY · CONNECTED</Text>
              </Animated.View>
            </View>

            {/* Bottom sheet */}
            <Animated.View style={[
              styles.sheet,
              { transform: [{ translateY: sheetY }], opacity: sheetOpacity }
            ]}>
              <View style={styles.handle} />
              <Text style={styles.sheetTitle}>Welcome back 👋</Text>
              <Text style={styles.sheetSub}>Sign in to your community</Text>

              {/* Phone input */}
              <Text style={styles.label}>PHONE NUMBER</Text>
              <View style={[styles.inputWrap, focusedInput === 'phone' && styles.inputFocused]}>
                <Ionicons name="call-outline" size={18} color={focusedInput === 'phone' ? Colors.primary : 'rgba(255,255,255,0.3)'} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your phone number"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                  onFocus={() => setFocusedInput('phone')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              {/* Password input */}
              <Text style={styles.label}>PASSWORD</Text>
              <View style={[styles.inputWrap, focusedInput === 'password' && styles.inputFocused]}>
                <Ionicons name="lock-closed-outline" size={18} color={focusedInput === 'password' ? Colors.primary : 'rgba(255,255,255,0.3)'} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="rgba(255,255,255,0.3)"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.forgot}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              {/* Login button */}
              <TouchableOpacity onPress={handleLogin} disabled={loading} style={styles.loginBtnWrap}>
                <LinearGradient
                  colors={['#6c63ff', '#f093fb']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginBtn}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <>
                        <Text style={styles.loginBtnText}>Sign In</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                      </>
                  }
                </LinearGradient>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.divLine} />
                <Text style={styles.divText}>or</Text>
                <View style={styles.divLine} />
              </View>

              {/* Register button */}
              <TouchableOpacity
                style={styles.registerBtn}
                onPress={() => router.push('/(auth)/register')}
              >
                <Text style={styles.registerBtnText}>Create an account</Text>
              </TouchableOpacity>

              <Text style={styles.hint}>
                New residents need to register first.{'\n'}
                Contact your secretary if you need help.
              </Text>

            </Animated.View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  bg: { position: 'absolute', inset: 0 },
  orb: { position: 'absolute', borderRadius: 999 },
  orb1: {
    width: 300, height: 300,
    backgroundColor: 'rgba(108,99,255,0.35)',
    top: -80, left: -60,
    shadowColor: '#6c63ff', shadowRadius: 80, shadowOpacity: 1,
  },
  orb2: {
    width: 250, height: 250,
    backgroundColor: 'rgba(240,147,251,0.25)',
    top: 120, right: -80,
    shadowColor: '#f093fb', shadowRadius: 60, shadowOpacity: 1,
  },
  orb3: {
    width: 200, height: 200,
    backgroundColor: 'rgba(46,213,115,0.12)',
    bottom: 300, left: -40,
  },
  grid: {
    position: 'absolute', inset: 0,
    opacity: 0.4,
  },
  top: {
    flex: 1, alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60, paddingBottom: 40,
  },
  logoWrap: { alignItems: 'center', gap: 12 },
  logoRing: {
    width: 90, height: 90, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  logoInner: { alignItems: 'center', justifyContent: 'center' },
  appName: { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  appSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5 },
  sheet: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    borderWidth: 1, borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 28, paddingBottom: 48,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginBottom: 24,
  },
  sheetTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 4 },
  sheetSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24 },
  label: {
    fontSize: 11, fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1, marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, paddingHorizontal: 14,
    paddingVertical: 14, marginBottom: 16,
  },
  inputFocused: {
    borderColor: 'rgba(108,99,255,0.6)',
    backgroundColor: 'rgba(108,99,255,0.08)',
  },
  input: { flex: 1, fontSize: 15, color: '#fff' },
  forgot: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotText: { fontSize: 12, color: 'rgba(108,99,255,0.8)', fontWeight: '600' },
  loginBtnWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 6 },
  loginBtn: {
    padding: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20 },
  divLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  divText: { fontSize: 12, color: 'rgba(255,255,255,0.3)' },
  registerBtn: {
    borderWidth: 1.5, borderColor: 'rgba(108,99,255,0.4)',
    borderRadius: 16, padding: 16, alignItems: 'center',
    backgroundColor: 'rgba(108,99,255,0.08)',
  },
  registerBtnText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600' },
  hint: {
    fontSize: 11, color: 'rgba(255,255,255,0.2)',
    textAlign: 'center', marginTop: 16, lineHeight: 18,
  },
}); 
