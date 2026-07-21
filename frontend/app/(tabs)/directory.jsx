import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Animated,
  Linking, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getAllUsers, updateUserRole } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import SwipeWrapper from '../../components/SwipeWrapper';

const BLOCKS = ['All', 'Lands Down Park', 'Hill Top Garden', 'Aakkulam Avenue'];

const roleConfig = {
  president: { label: 'President', color: '#ff4757', bg: 'rgba(255,71,87,0.15)', border: 'rgba(255,71,87,0.25)', icon: 'star' },
  secretary: { label: 'Secretary', color: '#ffa502', bg: 'rgba(255,165,2,0.15)', border: 'rgba(255,165,2,0.25)', icon: 'shield' },
  committee: { label: 'Committee', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.25)', icon: 'people' },
  resident: { label: 'Resident', color: '#6c63ff', bg: 'rgba(108,99,255,0.15)', border: 'rgba(108,99,255,0.25)', icon: 'home' },
};

export default function DirectoryScreen() {
  const { user } = useAuth();
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedBlock, setSelectedBlock] = useState('All');

  const orb1 = useRef(new Animated.Value(0)).current;
  const orb2 = useRef(new Animated.Value(0)).current;

  const isAdmin = ['secretary', 'president'].includes(user?.role);

  useEffect(() => {
    const floatOrb = (anim, delay) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 4000, useNativeDriver: true, delay }),
          Animated.timing(anim, { toValue: 0, duration: 4000, useNativeDriver: true }),
        ])
      ).start();
    };
    floatOrb(orb1, 0);
    floatOrb(orb2, 2000);
    fetchResidents();
  }, []);

  const orb1Y = orb1.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });
  const orb2Y = orb2.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });

  const fetchResidents = async () => {
    try {
      const res = await getAllUsers();
      setResidents(res.data.users);
    } catch (error) {
      console.log('Error fetching residents:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchResidents();
    setRefreshing(false);
  }, []);

  const handleCall = (phone) => Linking.openURL(`tel:${phone}`);

  const handleLongPress = (resident) => {
    if (!isAdmin) return;
    if (resident._id === user._id) return;

    const options = [];

    if (resident.role !== 'committee') {
      options.push({
        text: 'Make Committee Member',
        onPress: () => confirmRoleChange(resident, 'committee'),
      });
    }
    if (resident.role !== 'secretary' && user.role === 'president') {
      options.push({
        text: 'Make Secretary',
        onPress: () => confirmRoleChange(resident, 'secretary'),
      });
    }
    if (resident.role !== 'president' && user.role === 'president') {
      options.push({
        text: 'Make President',
        onPress: () => confirmRoleChange(resident, 'president'),
      });
    }
    if (resident.role !== 'resident') {
      options.push({
        text: 'Remove Role (Make Resident)',
        style: 'destructive',
        onPress: () => confirmRoleChange(resident, 'resident'),
      });
    }
    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(
      `Manage ${resident.name}`,
      `Current role: ${roleConfig[resident.role]?.label}`,
      options
    );
  };

  const confirmRoleChange = (resident, newRole) => {
    Alert.alert(
      'Confirm Role Change',
      `Are you sure you want to make ${resident.name} a ${roleConfig[newRole]?.label}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await updateUserRole(resident._id, newRole);
              Alert.alert('Success', `${resident.name} is now a ${roleConfig[newRole]?.label}`);
              fetchResidents();
            } catch (error) {
              Alert.alert('Error', error.response?.data?.message || 'Could not update role');
            }
          }
        }
      ]
    );
  };

  // Split users into groups
  const president = residents.find(r => r.role === 'president');
  const secretary = residents.find(r => r.role === 'secretary');
  const committee = residents.filter(r => r.role === 'committee');
  const normalResidents = residents.filter(r => r.role === 'resident');

  const filtered = normalResidents.filter(r => {
    const matchBlock = selectedBlock === 'All' || r.block === selectedBlock;
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.houseNo?.toLowerCase().includes(search.toLowerCase());
    return matchBlock && matchSearch;
  });

  const grouped = filtered.reduce((acc, r) => {
    const letter = r.name[0].toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(r);
    return acc;
  }, {});

  const ExecutiveCard = ({ member, prominent }) => (
    <TouchableOpacity
      style={[styles.execCard, prominent && styles.execCardProminent]}
      onLongPress={() => handleLongPress(member)}
      activeOpacity={0.85}
    >
      {prominent && (
        <LinearGradient
          colors={['rgba(255,71,87,0.15)', 'rgba(255,71,87,0.05)']}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={[styles.execAvatar, { backgroundColor: member.avatarColor || '#6c63ff' }]}>
        <Text style={styles.execAvatarText}>{member.initials}</Text>
      </View>
      <View style={styles.execInfo}>
        <View style={styles.execNameRow}>
          <Text style={styles.execName}>{member.name}</Text>
          {member._id === user?._id && (
            <View style={styles.youBadge}>
              <Text style={styles.youText}>You</Text>
            </View>
          )}
        </View>
        <View style={[styles.roleBadge, {
          backgroundColor: roleConfig[member.role]?.bg,
          borderColor: roleConfig[member.role]?.border,
        }]}>
          <Ionicons name={roleConfig[member.role]?.icon} size={10} color={roleConfig[member.role]?.color} />
          <Text style={[styles.roleText, { color: roleConfig[member.role]?.color }]}>
            {roleConfig[member.role]?.label}
          </Text>
        </View>
        <Text style={styles.execHouse}>{member.houseNo} · {member.block}</Text>
      </View>
      {member._id !== user?._id && member.phone && (
        <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(member.phone)}>
          <Ionicons name="call-outline" size={16} color="#11998e" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <SwipeWrapper>
      <View style={styles.container}>
        <View style={styles.bg}>
          <Animated.View style={[styles.orb, styles.orb1, { transform: [{ translateY: orb1Y }] }]} />
          <Animated.View style={[styles.orb, styles.orb2, { transform: [{ translateY: orb2Y }] }]} />
        </View>

        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          {/* Header */}
          <View style={styles.header}>
            <LinearGradient
              colors={['rgba(17,153,142,0.35)', 'rgba(56,239,125,0.2)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.headerGrad}
            >
              <Text style={styles.headerTitle}>Resident Directory 👥</Text>
              <Text style={styles.headerSub}>{`${residents.length} families · Sunrise Enclave`}</Text>
            </LinearGradient>
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.3)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or house number..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            )}
          </View>

          {/* Block filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsRow}
          >
            {BLOCKS.map(b => (
              <TouchableOpacity
                key={b}
                style={[styles.chip, selectedBlock === b && styles.chipActive]}
                onPress={() => setSelectedBlock(b)}
              >
                {selectedBlock === b && (
                  <LinearGradient
                    colors={['#11998e', '#38ef7d']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <Text style={[styles.chipText, selectedBlock === b && styles.chipTextActive]}>
                  {b === 'All' ? '🏘️ All' : b}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#11998e" />}
          >
            {loading ? (
              <ActivityIndicator color="#11998e" style={{ marginTop: 40 }} />
            ) : (
              <>
                {/* Executive Committee Section */}
                {(president || secretary || committee.length > 0) && (
                  <View style={styles.execSection}>
                    <View style={styles.execSectionHeader}>
                      <LinearGradient
                        colors={['#ff4757', '#ffa502']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={styles.execSectionLine}
                      />
                      <Text style={styles.execSectionTitle}>Executive Committee</Text>
                      <LinearGradient
                        colors={['#ffa502', '#ff4757']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={styles.execSectionLine}
                      />
                    </View>

                    {president && <ExecutiveCard member={president} prominent={true} />}
                    {secretary && <ExecutiveCard member={secretary} prominent={false} />}
                    {committee.map(m => (
                      <ExecutiveCard key={m._id} member={m} prominent={false} />
                    ))}
                  </View>
                )}

                {/* Residents section */}
                <View style={styles.residentsSectionHeader}>
                  <View style={styles.letterLine} />
                  <Text style={styles.residentsSectionTitle}>Residents</Text>
                  <View style={styles.letterLine} />
                </View>

                <View style={styles.resultRow}>
                  <Text style={styles.resultText}>{`${filtered.length} residents`}</Text>
                  {isAdmin && (
                    <Text style={styles.longPressHint}>Long press to manage roles</Text>
                  )}
                </View>

                {Object.keys(grouped).sort().map(letter => (
                  <View key={letter}>
                    <View style={styles.letterHeaderWrap}>
                      <Text style={styles.letterHeader}>{letter}</Text>
                      <View style={styles.letterLine} />
                    </View>
                    {grouped[letter].map(r => (
                      <TouchableOpacity
                        key={r._id}
                        style={styles.card}
                        onLongPress={() => handleLongPress(r)}
                        activeOpacity={0.85}
                      >
                        <View style={[styles.avatar, { backgroundColor: r.avatarColor || '#6c63ff' }]}>
                          <Text style={styles.avatarText}>{r.initials}</Text>
                        </View>
                        <View style={styles.info}>
                          <View style={styles.nameRow}>
                            <Text style={styles.name}>{r.name}</Text>
                            {r._id === user?._id && (
                              <View style={styles.youBadge}>
                                <Text style={styles.youText}>You</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.flat}>{`${r.houseNo} · ${r.block}`}</Text>
                          {r.residentSince && (
                            <Text style={styles.since}>{`Since ${r.residentSince}`}</Text>
                          )}
                          {r.isServiceProvider && (
                            <View style={styles.profBadge}>
                              <Ionicons name="briefcase-outline" size={10} color="#a78bfa" />
                              <Text style={styles.profText}>{r.designation || r.profession}</Text>
                            </View>
                          )}
                        </View>
                        {r._id !== user?._id && r.phone && (
                          <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(r.phone)}>
                            <Ionicons name="call-outline" size={16} color="#11998e" />
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </>
            )}
            <View style={{ height: 24 }} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </SwipeWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07231f' },
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  orb: { position: 'absolute', borderRadius: 999 },
  orb1: { width: 300, height: 300, backgroundColor: 'rgba(52,211,153,0.22)', top: -60, left: -60 },
  orb2: { width: 250, height: 250, backgroundColor: 'rgba(45,212,191,0.12)', top: 300, right: -80 },
  header: { padding: 16, paddingBottom: 8 },
  headerGrad: { borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 16, marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#fff' },
  chipsScroll: { flexGrow: 0, flexShrink: 0 },
  chipsRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden', alignSelf: 'center',
  },
  chipActive: { borderColor: 'transparent' },
  chipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  chipTextActive: { color: '#fff' },

  // Executive section
  execSection: { padding: 16, paddingBottom: 8 },
  execSectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 14,
  },
  execSectionLine: { flex: 1, height: 1.5, borderRadius: 1 },
  execSectionTitle: {
    fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase', letterSpacing: 1.5,
  },
  execCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  execCardProminent: {
    borderColor: 'rgba(255,71,87,0.3)',
  },
  execAvatar: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  execAvatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  execInfo: { flex: 1 },
  execNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  execName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 10, borderWidth: 1, marginBottom: 4,
  },
  roleText: { fontSize: 10, fontWeight: '700' },
  execHouse: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },

  // Residents section
  residentsSectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingHorizontal: 16, marginBottom: 8, marginTop: 4,
  },
  residentsSectionTitle: {
    fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase', letterSpacing: 1.5,
  },
  resultRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 6,
  },
  resultText: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: '500' },
  longPressHint: { fontSize: 11, color: 'rgba(108,99,255,0.6)', fontStyle: 'italic' },
  letterHeaderWrap: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, marginTop: 10, marginBottom: 6, gap: 10,
  },
  letterHeader: { fontSize: 12, fontWeight: '800', color: '#11998e', letterSpacing: 1 },
  letterLine: { flex: 1, height: 1, backgroundColor: 'rgba(17,153,142,0.2)' },
  card: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  avatar: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  name: { fontSize: 14, fontWeight: '600', color: '#fff' },
  youBadge: {
    backgroundColor: 'rgba(108,99,255,0.2)',
    borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
  },
  youText: { fontSize: 9, color: '#a78bfa', fontWeight: '700' },
  flat: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 1 },
  since: { fontSize: 11, color: 'rgba(255,255,255,0.2)' },
  profBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  profText: { fontSize: 11, color: '#a78bfa', fontWeight: '500' },
  callBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(17,153,142,0.12)',
    borderWidth: 1, borderColor: 'rgba(17,153,142,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
});