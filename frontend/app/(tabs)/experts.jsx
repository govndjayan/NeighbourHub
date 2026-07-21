import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { getProfessionals, getConversations } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import SwipeWrapper from '../../components/SwipeWrapper';
import { io } from 'socket.io-client';
import { BASE_URL } from '../../constants/config';

const categories = ['All', 'Medical', 'Legal', 'Finance', 'Home', 'Other'];

const categoryIcons = {
  All: 'grid-outline',
  Medical: 'medkit-outline',
  Legal: 'scale-outline',
  Finance: 'cash-outline',
  Home: 'hammer-outline',
  Other: 'ellipsis-horizontal-outline',
};

const statusColors = {
  online: '#2ed573',
  busy: '#ffa502',
  offline: 'rgba(255,255,255,0.2)',
};

export default function ExpertsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('professionals');
  const [professionals, setProfessionals] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState('All');
  const [search, setSearch] = useState('');

  const orb1 = useRef(new Animated.Value(0)).current;
  const orb2 = useRef(new Animated.Value(0)).current;

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
    fetchData();
    //unread messages count on chat
    const socket = io(BASE_URL, { transports: ['websocket'] });
socket.on('receive_message', async () => {
  // Refresh conversations to update unread count
  const convRes = await getConversations();
  setConversations(convRes.data.conversations);
});

return () => socket.disconnect();
  }, []);

  // Refetch conversations whenever this screen regains focus (e.g. returning
  // from a chat) so the unread counts reflect messages just read.
  useFocusEffect(
    useCallback(() => {
      getConversations()
        .then((res) => setConversations(res.data.conversations))
        .catch(() => {});
    }, [])
  );

  const orb1Y = orb1.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });
  const orb2Y = orb2.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });

  const fetchData = async () => {
    try {
      const [proRes, convRes] = await Promise.all([
        getProfessionals(),
        getConversations(),
      ]);
      setProfessionals(proRes.data.professionals);
      setConversations(convRes.data.conversations);
    } catch (error) {
      console.log('Error fetching experts data:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const handleCategoryChange = async (cat) => {
    setSelected(cat);
    setLoading(true);
    try {
      const res = await getProfessionals(cat !== 'All' ? cat : null);
      setProfessionals(res.data.professionals);
    } catch (error) {
      console.log('Error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = professionals.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.designation?.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const getTimeAgo = (date) => {
    const diff = Math.floor((Date.now() - new Date(date)) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

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
            colors={['rgba(83,52,131,0.4)', 'rgba(108,99,255,0.3)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.headerGrad}
          >
            <Text style={styles.headerTitle}>Professional Services 💼</Text>
            <Text style={styles.headerSub}>Connect with skilled neighbours</Text>
          </LinearGradient>
        </View>

        {/* Top tabs */}
        <View style={styles.topTabs}>
          <TouchableOpacity
            style={[styles.topTab, activeTab === 'professionals' && styles.topTabActive]}
            onPress={() => setActiveTab('professionals')}
          >
            {activeTab === 'professionals' && (
              <LinearGradient
                colors={['#533483', '#6c63ff']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Ionicons name="briefcase-outline" size={15} color={activeTab === 'professionals' ? '#fff' : 'rgba(255,255,255,0.4)'} />
            <Text style={[styles.topTabText, activeTab === 'professionals' && styles.topTabTextActive]}>
              Professionals
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.topTab, activeTab === 'chats' && styles.topTabActive]}
            onPress={() => setActiveTab('chats')}
          >
            {activeTab === 'chats' && (
              <LinearGradient
                colors={['#533483', '#6c63ff']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Ionicons name="chatbubbles-outline" size={15} color={activeTab === 'chats' ? '#fff' : 'rgba(255,255,255,0.4)'} />
            <Text style={[styles.topTabText, activeTab === 'chats' && styles.topTabTextActive]}>
              My Chats
            </Text>
            {totalUnread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{totalUnread}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Professionals Tab */}
        {activeTab === 'professionals' && (
          <>
            {/* Search */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="rgba(255,255,255,0.3)" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search doctors, lawyers..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={15} color="rgba(255,255,255,0.3)" />
                </TouchableOpacity>
              )}
            </View>

            {/* Category chips — compact */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsScroll}
              contentContainerStyle={styles.chipsRow}
            >
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, selected === cat && styles.chipActive]}
                  onPress={() => handleCategoryChange(cat)}
                >
                  {selected === cat && (
                    <LinearGradient
                      colors={['#6c63ff', '#a78bfa']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <Ionicons
                    name={categoryIcons[cat]}
                    size={12}
                    color={selected === cat ? '#fff' : 'rgba(255,255,255,0.4)'}
                  />
                  <Text style={[styles.chipText, selected === cat && styles.chipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c63ff" />}
              contentContainerStyle={{ padding: 16, gap: 10 }}
            >
              {loading ? (
                <ActivityIndicator color="#6c63ff" style={{ marginTop: 40 }} />
              ) : filtered.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="briefcase-outline" size={32} color="rgba(255,255,255,0.2)" />
                  </View>
                  <Text style={styles.emptyTitle}>No professionals found</Text>
                  <Text style={styles.emptySubt}>Try a different category</Text>
                </View>
              ) : (
                filtered.map(p => {
                  const isMe = p._id === user?._id;
                  return (
                    <View key={p._id} style={[styles.card, isMe && styles.cardMe]}>
                      <View style={[styles.avatar, { backgroundColor: p.avatarColor || '#6c63ff' }]}>
                        <Text style={styles.avatarText}>{p.initials}</Text>
                      </View>
                      <View style={styles.info}>
                        <View style={styles.nameRow}>
                          <Text style={styles.name}>{p.name}</Text>
                          {isMe && (
                            <View style={styles.youBadge}>
                              <Text style={styles.youText}>You</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.designation}>{p.designation || p.profession}</Text>
                        <Text style={styles.flat}>{p.houseNo} · {p.block}</Text>
                        <View style={styles.statusRow}>
                          <View style={[styles.dot, { backgroundColor: statusColors[p.availability] }]} />
                          <Text style={[styles.statusText, { color: statusColors[p.availability] }]}>
                            {p.availability === 'online' ? 'Available' : p.availability === 'busy' ? 'Busy' : 'Offline'}
                          </Text>
                          {p.availabilityNote ? (
                            <Text style={styles.availNote}>{`· ${p.availabilityNote}`}</Text>
                          ) : null}
                        </View>
                      </View>
                      {isMe ? (
                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() => router.push('/profile')}
                        >
                          <Ionicons name="pencil" size={14} color="#a78bfa" />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.chatBtn}
                          onPress={() => router.push({
                            pathname: '/chat/[id]',
                            params: {
                              id: p._id,
                              name: p.name,
                              designation: p.designation,
                              initials: p.initials,
                              color: p.avatarColor,
                              phone: p.phone
                            }
                          })}
                        >
                          <LinearGradient
                            colors={['#6c63ff', '#a78bfa']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={styles.chatBtnGrad}
                          >
                            <Ionicons name="chatbubble" size={13} color="#fff" />
                            <Text style={styles.chatBtnText}>Chat</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
              <View style={{ height: 24 }} />
            </ScrollView>
          </>
        )}

        {/* My Chats Tab */}
        {activeTab === 'chats' && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c63ff" />}
            contentContainerStyle={{ padding: 16, gap: 10 }}
          >
            {loading ? (
              <ActivityIndicator color="#6c63ff" style={{ marginTop: 40 }} />
            ) : conversations.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="chatbubbles-outline" size={32} color="rgba(255,255,255,0.2)" />
                </View>
                <Text style={styles.emptyTitle}>No chats yet</Text>
                <Text style={styles.emptySubt}>Start a conversation with a professional</Text>
              </View>
            ) : (
              conversations.map((conv, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.convCard}
                  onPress={() => router.push({
                    pathname: '/chat/[id]',
                    params: {
                      id: conv.otherUser._id,
                      name: conv.otherUser.name,
                      designation: conv.otherUser.designation || '',
                      initials: conv.otherUser.initials,
                      color: conv.otherUser.avatarColor,
                      phone: conv.otherUser.phone || '',
                    }
                  })}
                  activeOpacity={0.8}
                >
                  <View style={[styles.avatar, { backgroundColor: conv.otherUser.avatarColor || '#6c63ff' }]}>
                    <Text style={styles.avatarText}>{conv.otherUser.initials}</Text>
                  </View>
                  <View style={styles.convInfo}>
                    <View style={styles.convTop}>
                      <Text style={styles.convName}>{conv.otherUser.name}</Text>
                      <Text style={styles.convTime}>{getTimeAgo(conv.lastMessageTime)}</Text>
                    </View>
                    <View style={styles.convBottom}>
                      <Text style={styles.convLastMsg} numberOfLines={1}>
                        {conv.lastMessage}
                      </Text>
                      {conv.unreadCount > 0 && (
                        <View style={styles.convUnread}>
                          <Text style={styles.convUnreadText}>{conv.unreadCount}</Text>
                        </View>
                      )}
                    </View>
                    {conv.otherUser.designation ? (
                      <Text style={styles.convDesig}>{conv.otherUser.designation}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))
            )}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}

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
  orb2: { width: 250, height: 250, backgroundColor: 'rgba(45,212,191,0.13)', top: 250, right: -80 },
  header: { padding: 16, paddingBottom: 8 },
  headerGrad: { borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },

  // Top tabs
  topTabs: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, marginBottom: 10,
  },
  topTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  topTabActive: { borderColor: 'transparent' },
  topTabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  topTabTextActive: { color: '#fff' },
  unreadBadge: {
    backgroundColor: '#ff4757', width: 18, height: 18,
    borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
  unreadBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#fff' },

  // Compact chips
  chipsScroll: { flexGrow: 0, flexShrink: 0 },
  chipsRow: { paddingHorizontal: 16, gap: 6, paddingBottom: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden', alignSelf: 'center',
  },
  chipActive: { borderColor: 'transparent' },
  chipText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  chipTextActive: { color: '#fff' },

  // Professional card
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  cardMe: {
    borderColor: 'rgba(108,99,255,0.3)',
    backgroundColor: 'rgba(108,99,255,0.06)',
  },
  avatar: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  name: { fontSize: 14, fontWeight: '700', color: '#fff' },
  youBadge: {
    backgroundColor: 'rgba(108,99,255,0.2)',
    borderWidth: 1, borderColor: 'rgba(108,99,255,0.4)',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
  },
  youText: { fontSize: 9, color: '#a78bfa', fontWeight: '700' },
  designation: { fontSize: 11, color: '#a78bfa', fontWeight: '600', marginBottom: 2 },
  flat: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  availNote: { fontSize: 10, color: 'rgba(255,255,255,0.25)' },
  chatBtn: { borderRadius: 10, overflow: 'hidden' },
  chatBtnGrad: { paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  chatBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  editBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Conversation card
  convCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  convInfo: { flex: 1 },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  convName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  convTime: { fontSize: 11, color: 'rgba(255,255,255,0.25)' },
  convBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  convLastMsg: { fontSize: 12, color: 'rgba(255,255,255,0.4)', flex: 1 },
  convUnread: {
    backgroundColor: '#6c63ff', width: 20, height: 20,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  convUnreadText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  convDesig: { fontSize: 11, color: '#a78bfa', fontWeight: '500', marginTop: 3 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 15, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  emptySubt: { fontSize: 12, color: 'rgba(255,255,255,0.2)' },
});