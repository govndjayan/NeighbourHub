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
import { useAuth } from '../../context/AuthContext';

const BLOCKS = ['Lands Down Park', 'Hill Top Garden', 'Aakkulam Avenue'];
const CATEGORIES = ['Medical', 'Legal', 'Finance', 'Home', 'Other'];

// ✅ InputField is outside RegisterScreen — prevents re-creation on every render
const InputField = ({
  icon, placeholder, value, onChangeText,
  keyboardType, secureTextEntry, fieldName,
  rightIcon, onRightPress, maxLength,
  focusedInput, setFocusedInput
}) => (
  <View style={[styles.inputWrap, focusedInput === fieldName && styles.inputFocused]}>
    <Ionicons
      name={icon}
      size={18}
      color={focusedInput === fieldName ? '#6c63ff' : 'rgba(255,255,255,0.3)'}
    />
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      placeholderTextColor="rgba(255,255,255,0.25)"
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType || 'default'}
      secureTextEntry={secureTextEntry}
      onFocus={() => setFocusedInput(fieldName)}
      onBlur={() => setFocusedInput(null)}
      maxLength={maxLength}
      autoCorrect={false}
      autoCapitalize="none"
    />
    {rightIcon && (
      <TouchableOpacity onPress={onRightPress}>
        <Ionicons name={rightIcon} size={18} color="rgba(255,255,255,0.3)" />
      </TouchableOpacity>
    )}
  </View>
);

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [focusedInput, setFocusedInput] = useState(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [houseNo, setHouseNo] = useState('');
  const [block, setBlock] = useState('');
 
  const [isServiceProvider, setIsServiceProvider] = useState(false);
  const [profession, setProfession] = useState('');
  const [designation, setDesignation] = useState('');
  const [serviceCategory, setServiceCategory] = useState('');

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
    floatOrb(orb2, 1500);
    Animated.parallel([
      Animated.timing(sheetY, { toValue: 0, duration: 600, useNativeDriver: true, delay: 200 }),
      Animated.timing(sheetOpacity, { toValue: 1, duration: 600, useNativeDriver: true, delay: 200 }),
    ]).start();
  }, []);

  const orb1Y = orb1.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });
  const orb2Y = orb2.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });

  const handleNext = () => {
    if (step === 1) {
      if (!name || !phone || !password) {
        Alert.alert('Error', 'Please fill in name, phone and password');
        return;
      }
      if (phone.length < 10) {
        Alert.alert('Error', 'Please enter a valid 10-digit phone number');
        return;
      }
    }
    if (step === 2) {
      if (!houseNo || !block) {
        Alert.alert('Error', 'Please fill in your house number and select a block');
        return;
      }
    }
    setStep(step + 1);
  };

  const handleRegister = async () => {
    setLoading(true);
    const result = await register({
      name, phone, email, password,
      houseNo, block, 
      isServiceProvider,
      profession, designation, serviceCategory,
    });
    setLoading(false);
    if (!result.success) {
      Alert.alert('Registration Failed', result.message);
    }
  };

  // Shared props for all InputField instances
  const inputProps = { focusedInput, setFocusedInput };

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
                onPress={() => step === 1 ? router.back() : setStep(step - 1)}
                style={styles.backBtn}
              >
                <Ionicons name="arrow-back" size={20} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.topTitle}>Create Account</Text>
              <Text style={styles.stepIndicator}>{step}/3</Text>
            </View>

            {/* Progress bar */}
            <View style={styles.progressRow}>
              {[1, 2, 3].map(s => (
                <View key={s} style={styles.progressTrack}>
                  <LinearGradient
                    colors={s <= step ? ['#6c63ff', '#f093fb'] : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.1)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.progressFill}
                  />
                </View>
              ))}
            </View>

            {/* Step labels */}
            <View style={styles.stepLabels}>
              {['Account', 'Address', 'Services'].map((label, i) => (
                <Text key={label} style={[styles.stepLabel, step === i + 1 && styles.stepLabelActive]}>
                  {label}
                </Text>
              ))}
            </View>

            {/* Sheet */}
            <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }], opacity: sheetOpacity }]}>
              <View style={styles.handle} />

              {/* Step 1 */}
              {step === 1 && (
                <View>
                  <Text style={styles.sheetTitle}>Personal details</Text>
                  <Text style={styles.sheetSub}>Let's start with the basics</Text>

                  <Text style={styles.label}>FULL NAME</Text>
                  <InputField {...inputProps} icon="person-outline" placeholder="Your full name" value={name} onChangeText={setName} fieldName="name" />

                  <Text style={styles.label}>PHONE NUMBER</Text>
                  <InputField {...inputProps} icon="call-outline" placeholder="10-digit phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" fieldName="phone" maxLength={10} />

                  <Text style={styles.label}>EMAIL (OPTIONAL)</Text>
                  <InputField {...inputProps} icon="mail-outline" placeholder="your@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" fieldName="email" />

                  <Text style={styles.label}>PASSWORD</Text>
                  <InputField
                    {...inputProps}
                    icon="lock-closed-outline"
                    placeholder="Create a password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    fieldName="password"
                    rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    onRightPress={() => setShowPassword(!showPassword)}
                  />
                </View>
              )}

              {/* Step 2 */}
              {step === 2 && (
                <View>
                  <Text style={styles.sheetTitle}>Your address 🏠</Text>
                  <Text style={styles.sheetSub}>Help neighbours find you</Text>

                  <Text style={styles.label}>HOUSE NUMBER</Text>
                  <InputField {...inputProps} icon="home-outline" placeholder="e.g. HPA-96" value={houseNo} onChangeText={setHouseNo} fieldName="houseNo" />

                 

                  <Text style={styles.label}>SELECT YOUR BLOCK</Text>
                  <View style={styles.blockGrid}>
                    {BLOCKS.map(b => (
                      <TouchableOpacity
                        key={b}
                        style={[styles.blockChip, block === b && styles.blockChipActive]}
                        onPress={() => setBlock(b)}
                      >
                        {block === b && (
                          <LinearGradient
                            colors={['#6c63ff', '#f093fb']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={StyleSheet.absoluteFill}
                          />
                        )}
                        <Text style={[styles.blockChipText, block === b && styles.blockChipTextActive]}>{b}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Step 3 */}
              {step === 3 && (
                <View>
                  <Text style={styles.sheetTitle}>Professional services</Text>
                  <Text style={styles.sheetSub}>Optional — share your expertise with neighbours</Text>

                  <TouchableOpacity
                    style={[styles.toggleRow, isServiceProvider && styles.toggleRowActive]}
                    onPress={() => setIsServiceProvider(!isServiceProvider)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.toggleTitle}>I offer professional services</Text>
                      <Text style={styles.toggleSub}>Doctors, Lawyers, CAs etc</Text>
                    </View>
                    <View style={[styles.toggle, isServiceProvider && styles.toggleOn]}>
                      <View style={[styles.toggleDot, isServiceProvider && styles.toggleDotOn]} />
                    </View>
                  </TouchableOpacity>

                  {isServiceProvider && (
                    <View>
                      <Text style={styles.label}>PROFESSION</Text>
                      <InputField {...inputProps} icon="briefcase-outline" placeholder="e.g. Doctor" value={profession} onChangeText={setProfession} fieldName="profession" />

                      <Text style={styles.label}>DESIGNATION</Text>
                      <InputField {...inputProps} icon="ribbon-outline" placeholder="e.g. Cardiologist" value={designation} onChangeText={setDesignation} fieldName="designation" />

                      <Text style={styles.label}>CATEGORY</Text>
                      <View style={styles.catGrid}>
                        {CATEGORIES.map(cat => (
                          <TouchableOpacity
                            key={cat}
                            style={[styles.catChip, serviceCategory === cat && styles.catChipActive]}
                            onPress={() => setServiceCategory(cat)}
                          >
                            {serviceCategory === cat && (
                              <LinearGradient
                                colors={['#6c63ff', '#f093fb']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                              />
                            )}
                            <Text style={[styles.catChipText, serviceCategory === cat && styles.catChipTextActive]}>{cat}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {!isServiceProvider && (
                    <View style={styles.skipNote}>
                      <Ionicons name="information-circle-outline" size={20} color="rgba(255,255,255,0.3)" />
                      <Text style={styles.skipNoteText}>You can always add this later from your profile settings.</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Action button */}
              <TouchableOpacity
                onPress={step < 3 ? handleNext : handleRegister}
                disabled={loading}
                style={styles.btnWrap}
              >
                <LinearGradient
                  colors={['#6c63ff', '#f093fb']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.btn}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <>
                        <Text style={styles.btnText}>{step < 3 ? 'Continue' : 'Create Account'}</Text>
                        <Ionicons name={step < 3 ? 'arrow-forward' : 'checkmark'} size={18} color="#fff" />
                      </>
                  }
                </LinearGradient>
              </TouchableOpacity>

              {step === 1 && (
                <TouchableOpacity style={styles.loginLink} onPress={() => router.back()}>
                  <Text style={styles.loginLinkText}>
                    Already have an account? <Text style={{ color: '#6c63ff' }}>Sign in</Text>
                  </Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  orb: { position: 'absolute', borderRadius: 999 },
  orb1: { width: 280, height: 280, backgroundColor: 'rgba(108,99,255,0.3)', top: -60, right: -60 },
  orb2: { width: 220, height: 220, backgroundColor: 'rgba(240,147,251,0.2)', top: 200, left: -80 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 16 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  stepIndicator: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginBottom: 8 },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { flex: 1, height: 4 },
  stepLabels: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20 },
  stepLabel: { flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '600', textAlign: 'center' },
  stepLabelActive: { color: '#6c63ff' },
  sheet: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    borderWidth: 1, borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 28, paddingBottom: 48, flex: 1,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 24 },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  sheetSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24 },
  label: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 16,
  },
  inputFocused: { borderColor: 'rgba(108,99,255,0.6)', backgroundColor: 'rgba(108,99,255,0.08)' },
  input: { flex: 1, fontSize: 15, color: '#fff' },
  blockGrid: { gap: 8, marginBottom: 16 },
  blockChip: {
    borderRadius: 14, padding: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden', alignItems: 'center',
  },
  blockChipActive: { borderColor: 'transparent' },
  blockChipText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  blockChipTextActive: { color: '#fff' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16, padding: 16, marginBottom: 20, gap: 12,
  },
  toggleRowActive: { borderColor: 'rgba(108,99,255,0.4)', backgroundColor: 'rgba(108,99,255,0.08)' },
  toggleTitle: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 2 },
  toggleSub: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.1)', padding: 3, justifyContent: 'center' },
  toggleOn: { backgroundColor: '#6c63ff' },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.5)' },
  toggleDotOn: { backgroundColor: '#fff', transform: [{ translateX: 18 }] },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  catChip: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden',
  },
  catChipActive: { borderColor: 'transparent' },
  catChipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  catChipTextActive: { color: '#fff' },
  skipNote: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, marginTop: 8 },
  skipNoteText: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 18 },
  btnWrap: { borderRadius: 16, overflow: 'hidden', marginTop: 24 },
  btn: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  loginLink: { alignItems: 'center', marginTop: 20 },
  loginLinkText: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
});