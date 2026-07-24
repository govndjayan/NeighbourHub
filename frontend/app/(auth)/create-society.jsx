import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert, Animated, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { createSociety } from '../../services/api';
import Colors from '../../constants/colors';

export default function CreateSocietyScreen() {
  const router = useRouter();

  const [step, setStep] = useState(1);          // 1 = form, 2 = invite code created
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [blockInput, setBlockInput] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [created, setCreated] = useState(null);  // { name, inviteCode, ... }

  // Orbs + sheet entrance (matches the other auth screens)
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

  const addBlock = () => {
    const b = blockInput.trim();
    if (!b) return;
    // Ignore case-insensitive duplicates
    if (blocks.some((x) => x.toLowerCase() === b.toLowerCase())) {
      setBlockInput('');
      return;
    }
    setBlocks((prev) => [...prev, b]);
    setBlockInput('');
  };

  const removeBlock = (b) => setBlocks((prev) => prev.filter((x) => x !== b));

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your society name');
      return;
    }
    setLoading(true);
    try {
      const res = await createSociety({
        name: name.trim(),
        city: city.trim(),
        state: state.trim(),
        blocks,
      });
      setCreated(res.data.society);
      setStep(2);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not create your society. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (!created?.inviteCode) return;
    await Clipboard.setStringAsync(created.inviteCode);
    Alert.alert('Copied', 'Invite code copied to clipboard.');
  };

  const shareCode = async () => {
    if (!created?.inviteCode) return;
    try {
      await Share.share({
        message: `Join ${created.name} on Eaze Apt. Use invite code ${created.inviteCode} when you register.`,
      });
    } catch {}
  };

  // Hand off to the resident registration, pre-filled with the new code —
  // the first person to register against a fresh society becomes its admin.
  const continueToRegister = () => {
    router.replace({ pathname: '/(auth)/register', params: { code: created?.inviteCode } });
  };

  return (
    <View style={styles.container}>
      <View style={styles.bg}>
        <Animated.View style={[styles.orb, styles.orb1, { transform: [{ translateY: orb1Y }] }]} />
        <Animated.View style={[styles.orb, styles.orb2, { transform: [{ translateY: orb2Y }] }]} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
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
                onPress={() => step === 1 ? router.back() : null}
                style={[styles.backBtn, step !== 1 && { opacity: 0 }]}
                disabled={step !== 1}
              >
                <Ionicons name="arrow-back" size={20} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.topTitle}>Set up your society</Text>
              <View style={{ width: 38 }} />
            </View>

            {/* Icon */}
            <View style={styles.iconWrap}>
              <LinearGradient
                colors={['rgba(108,99,255,0.3)', 'rgba(240,147,251,0.3)']}
                style={styles.iconRing}
              >
                <Ionicons name={step === 1 ? 'business-outline' : 'checkmark-circle-outline'} size={34} color="#fff" />
              </LinearGradient>
            </View>

            <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }], opacity: sheetOpacity }]}>
              <View style={styles.handle} />

              {step === 1 ? (
                <>
                  <Text style={styles.sheetTitle}>Register your community</Text>
                  <Text style={styles.sheetSub}>
                    Create your society once. You'll get an invite code to share with residents.
                  </Text>

                  <Text style={styles.label}>SOCIETY NAME</Text>
                  <View style={[styles.inputWrap, focusedInput === 'name' && styles.inputFocused]}>
                    <Ionicons name="business-outline" size={18} color={focusedInput === 'name' ? Colors.primary : 'rgba(255,255,255,0.3)'} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Hill Park Avenue"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      value={name}
                      onChangeText={setName}
                      onFocus={() => setFocusedInput('name')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>

                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>CITY <Text style={styles.optional}>· optional</Text></Text>
                      <View style={[styles.inputWrap, focusedInput === 'city' && styles.inputFocused]}>
                        <TextInput
                          style={styles.input}
                          placeholder="City"
                          placeholderTextColor="rgba(255,255,255,0.25)"
                          value={city}
                          onChangeText={setCity}
                          onFocus={() => setFocusedInput('city')}
                          onBlur={() => setFocusedInput(null)}
                        />
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>STATE <Text style={styles.optional}>· optional</Text></Text>
                      <View style={[styles.inputWrap, focusedInput === 'state' && styles.inputFocused]}>
                        <TextInput
                          style={styles.input}
                          placeholder="State"
                          placeholderTextColor="rgba(255,255,255,0.25)"
                          value={state}
                          onChangeText={setState}
                          onFocus={() => setFocusedInput('state')}
                          onBlur={() => setFocusedInput(null)}
                        />
                      </View>
                    </View>
                  </View>

                  <Text style={styles.label}>BLOCKS / WINGS <Text style={styles.optional}>· optional</Text></Text>
                  <View style={styles.blockAddRow}>
                    <View style={[styles.inputWrap, { flex: 1, marginBottom: 0 }, focusedInput === 'block' && styles.inputFocused]}>
                      <TextInput
                        style={styles.input}
                        placeholder="Add a block name"
                        placeholderTextColor="rgba(255,255,255,0.25)"
                        value={blockInput}
                        onChangeText={setBlockInput}
                        onSubmitEditing={addBlock}
                        returnKeyType="done"
                        onFocus={() => setFocusedInput('block')}
                        onBlur={() => setFocusedInput(null)}
                      />
                    </View>
                    <TouchableOpacity style={styles.addBtn} onPress={addBlock}>
                      <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  {blocks.length > 0 && (
                    <View style={styles.chipWrap}>
                      {blocks.map((b) => (
                        <TouchableOpacity key={b} style={styles.chip} onPress={() => removeBlock(b)}>
                          <Text style={styles.chipText}>{b}</Text>
                          <Ionicons name="close" size={14} color="rgba(255,255,255,0.5)" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={styles.helperNote}>
                    Leave blocks empty if your society is a single building.
                  </Text>

                  <TouchableOpacity onPress={handleCreate} disabled={loading} style={styles.btnWrap}>
                    <LinearGradient
                      colors={['#6c63ff', '#f093fb']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.btn}
                    >
                      {loading
                        ? <ActivityIndicator color="#fff" />
                        : <>
                            <Text style={styles.btnText}>Create society</Text>
                            <Ionicons name="arrow-forward" size={18} color="#fff" />
                          </>}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.sheetTitle}>Society created 🎉</Text>
                  <Text style={styles.sheetSub}>
                    Share this code with your residents. They enter it when they register.
                  </Text>

                  <Text style={styles.label}>YOUR INVITE CODE</Text>
                  <View style={styles.codeBox}>
                    <Text style={styles.codeText}>{created?.inviteCode}</Text>
                  </View>

                  <View style={styles.codeActions}>
                    <TouchableOpacity style={styles.codeActionBtn} onPress={copyCode}>
                      <Ionicons name="copy-outline" size={16} color="#6c63ff" />
                      <Text style={styles.codeActionText}>Copy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.codeActionBtn} onPress={shareCode}>
                      <Ionicons name="share-social-outline" size={16} color="#6c63ff" />
                      <Text style={styles.codeActionText}>Share</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={continueToRegister} style={[styles.btnWrap, { marginTop: 24 }]}>
                    <LinearGradient
                      colors={['#6c63ff', '#f093fb']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.btn}
                    >
                      <Text style={styles.btnText}>Continue to create my account</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>

                  <Text style={styles.adminNote}>
                    You'll be the society admin — the first account under this community.
                  </Text>
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
  optional: { fontWeight: '600', color: 'rgba(255,255,255,0.25)', letterSpacing: 0 },
  row: { flexDirection: 'row', gap: 12 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 16,
  },
  inputFocused: { borderColor: 'rgba(108,99,255,0.6)', backgroundColor: 'rgba(108,99,255,0.08)' },
  input: { flex: 1, fontSize: 15, color: '#fff' },
  blockAddRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  addBtn: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#6c63ff', alignItems: 'center', justifyContent: 'center',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(108,99,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(108,99,255,0.35)',
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8,
  },
  chipText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  helperNote: { fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 18, marginBottom: 20 },
  btnWrap: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  btn: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  // Invite code (step 2)
  codeBox: {
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)',
    borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 12,
  },
  codeText: { fontSize: 30, fontWeight: '800', letterSpacing: 8, color: '#34d399' },
  codeActions: { flexDirection: 'row', gap: 10 },
  codeActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(108,99,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)',
    borderRadius: 14, paddingVertical: 12,
  },
  codeActionText: { color: '#6c63ff', fontSize: 13, fontWeight: '700' },
  adminNote: { fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 16, marginTop: 12 },
});
