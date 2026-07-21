import React, { useState, useEffect, useCallback, useRef } from 'react';
import SwipeWrapper from '../../components/SwipeWrapper';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Animated, Dimensions, AppState
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { getAnnouncements, getStats, getMyCommitments, fulfillCommitment } from '../../services/api';
import { createAnnouncement } from '../../services/api';
import { Modal, TextInput } from 'react-native';

const { width } = Dimensions.get('window');

/* const stats = [
  { label: 'Families', value: '97', sub: '3 new this month', color: '#a78bfa', accent: ['#6c63ff', '#a78bfa'], route: '/(tabs)/directory' },
  { label: 'Food shared', value: '24', sub: 'this week', color: '#2ed573', accent: ['#2ed573', '#7bed9f'], route: '/(tabs)/food' },
  { label: 'Open complaints', value: '5', sub: '2 under review', color: '#ff4757', accent: ['#ff4757', '#ff6b81'], route: '/(tabs)/complaints' },
  { label: 'Professionals', value: '12', sub: 'available now', color: '#a78bfa', accent: ['#533483', '#a78bfa'], route: '/(tabs)/experts' },
];  */


const tagStyles = {
  Urgent: { color: '#ff4757', bg: 'rgba(255,71,87,0.15)', border: 'rgba(255,71,87,0.25)', emoji: '🚨', accent: '#ff4757' },
  Event: { color: '#a78bfa', bg: 'rgba(108,99,255,0.15)', border: 'rgba(108,99,255,0.25)', emoji: '🎉', accent: '#6c63ff' },
  Food: { color: '#2ed573', bg: 'rgba(46,213,115,0.15)', border: 'rgba(46,213,115,0.25)', emoji: '🌿', accent: '#2ed573' },
  General: { color: 'rgba(255,255,255,0.6)', bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.12)', emoji: '📢', accent: '#888' },
  Maintenance: { color: '#ffa502', bg: 'rgba(255,165,2,0.15)', border: 'rgba(255,165,2,0.25)', emoji: '🔧', accent: '#ffa502' },
};

export default function HomeScreen() {

  const [announcementModal, setAnnouncementModal] = useState(false);
const [annTitle, setAnnTitle] = useState('');
const [annBody, setAnnBody] = useState('');
const [annTag, setAnnTag] = useState('General');
const [annSubmitting, setAnnSubmitting] = useState(false);

const [editingAnnouncement, setEditingAnnouncement] = useState(null);

  const { user, logout } = useAuth();
  const router = useRouter();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState({
  families: 0,
  foodShared: 0,
  openComplaints: 0,
  professionals: 0,
});

  // Orb animations
  const orb1 = useRef(new Animated.Value(0)).current;
  const orb2 = useRef(new Animated.Value(0)).current;
  const orb3 = useRef(new Animated.Value(0)).current;
  const promptedCommitments = useRef(new Set());



  useEffect(() => {
    fetchData();
    const floatOrb = (anim, delay) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 4000, useNativeDriver: true, delay }),
          Animated.timing(anim, { toValue: 0, duration: 4000, useNativeDriver: true }),
        ])
      ).start();
    };
    floatOrb(orb1, 0);
    floatOrb(orb2, 1500);
    floatOrb(orb3, 3000);
    fetchAnnouncements();
  }, []);

  // Refetch stats whenever the screen regains focus (e.g. switching back to the
  // Home tab) so the cards never sit stale.
  useFocusEffect(
    useCallback(() => {
      fetchData();
      checkCommitments();
    }, [checkCommitments])
  );

  // Refetch when the app returns to the foreground (resume from recents).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') { fetchData(); checkCommitments(); }
    });
    return () => sub.remove();
  }, []);

  const orb1Y = orb1.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });
  const orb2Y = orb2.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  const orb3Y = orb3.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });

  const fetchAnnouncements = async () => {
    try {
      const res = await getAnnouncements();
      setAnnouncements(res.data.announcements);
    } catch (error) {
      console.log('Error fetching announcements:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
  try {
    const [annRes, statsRes] = await Promise.all([
      getAnnouncements(),
      getStats(),
    ]);
    setAnnouncements(annRes.data.announcements);
    setStats(statsRes.data.stats);
  } catch (error) {
    console.log('Error fetching data:', error.message);
  } finally {
    setLoading(false);
  }
};
  // Remind the user of any help they promised (offer accepted, not yet fulfilled)
  const checkCommitments = useCallback(async () => {
    try {
      const res = await getMyCommitments();
      const commitments = res.data.commitments || [];
      for (const c of commitments) {
        if (promptedCommitments.current.has(c._id)) continue;
        promptedCommitments.current.add(c._id);
        const who = c.postedBy?.name || 'a neighbour';
        const when = c.pickupTime ? `\nPickup: ${c.pickupTime}` : '';
        Alert.alert(
          "Don't forget your promise 🤝",
          `You offered to help ${who} with "${c.title}".${when}`,
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Mark as done',
              onPress: async () => {
                try {
                  await fulfillCommitment(c._id);
                } catch (e) {
                  Alert.alert('Error', 'Could not update. Please try again.');
                  promptedCommitments.current.delete(c._id);
                }
              },
            },
          ]
        );
      }
    } catch (e) {
      // silent — reminder is best-effort
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

const handleAnnouncement = async () => {
  if (!annTitle || !annBody) {
    Alert.alert('Error', 'Please fill in title and body');
    return;
  }
  setAnnSubmitting(true);
  try {
    if (editingAnnouncement) {
      await updateAnnouncement(editingAnnouncement._id, { title: annTitle, body: annBody, tag: annTag });
      Alert.alert('Success', 'Announcement updated!');
    } else {
      await createAnnouncement({ title: annTitle, body: annBody, tag: annTag });
      Alert.alert('Success', 'Announcement posted!');
    }
    setAnnouncementModal(false);
    setEditingAnnouncement(null);
    setAnnTitle(''); setAnnBody(''); setAnnTag('General');
    fetchAnnouncements();
  } catch (error) {
    Alert.alert('Error', error.response?.data?.message || 'Something went wrong');
  } finally {
    setAnnSubmitting(false);
  }
};
const handleDeleteAnnouncement = (id) => {
  Alert.alert(
    'Delete Announcement',
    'Are you sure you want to delete this announcement?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAnnouncement(id);
            fetchAnnouncements();
          } catch (error) {
            Alert.alert('Error', 'Could not delete announcement');
          }
        }
      }
    ]
  );
};
const handleEditAnnouncement = (announcement) => {
  setEditingAnnouncement(announcement);
  setAnnTitle(announcement.title);
  setAnnBody(announcement.body);
  setAnnTag(announcement.tag);
  setAnnouncementModal(true);
};

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => logout() },
      ]
    );
  };

  const getTimeAgo = (date) => {
    const diff = Math.floor((Date.now() - new Date(date)) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  
const statsCards = [
  { 
    label: 'Families', 
    value: stats.families.toString(), 
    sub: 'registered houses', 
    color: '#a78bfa', 
    accent: ['#6c63ff', '#a78bfa'], 
    route: '/(tabs)/directory' 
  },
  { 
    label: 'Items Shared', 
    value: stats.foodShared.toString(), 
    sub: 'this week', 
    color: '#2ed573', 
    accent: ['#2ed573', '#7bed9f'], 
    route: '/(tabs)/food' 
  },
  { 
    label: 'Open complaints', 
    value: stats.openComplaints.toString(), 
    sub: 'need attention', 
    color: '#ff4757', 
    accent: ['#ff4757', '#ff6b81'], 
    route: '/(tabs)/complaints' 
  },
  { 
    label: 'Professionals', 
    value: stats.professionals.toString(), 
    sub: 'in community', 
    color: '#a78bfa', 
    accent: ['#533483', '#a78bfa'], 
    route: '/(tabs)/experts' 
  },
];
  return (
    <SwipeWrapper>
    <View style={styles.container}>

      {/* Animated background orbs */}
      <View style={styles.bg}>
        <Animated.View style={[styles.orb, styles.orb1, { transform: [{ translateY: orb1Y }] }]} />
        <Animated.View style={[styles.orb, styles.orb2, { transform: [{ translateY: orb2Y }] }]} />
        <Animated.View style={[styles.orb, styles.orb3, { transform: [{ translateY: orb3Y }] }]} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c63ff" />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.greeting}>Good morning 👋</Text>
                <Text style={styles.userName}>{user?.name|| 'Resident'}</Text>
                <Text style={styles.community}>Hill Park Avenue</Text>
              </View>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.7}>
                <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>
            <View style={styles.weatherChip}>
              <Ionicons name="partly-sunny" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.weatherText}>28°C · Partly cloudy</Text>
            </View>
          </View>

          {/* Stats grid */}
<View style={styles.statsGrid}>
  {statsCards.map((s, i) => (
    <TouchableOpacity
      key={i}
      style={styles.statCard}
      onPress={() => router.push(s.route)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={s.accent}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.statAccent}
      />
      <Text style={styles.statLabel}>{s.label}</Text>
      <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
      <Text style={styles.statSub}>{s.sub}</Text>
      <Ionicons name="arrow-forward" size={12} color="rgba(255,255,255,0.2)" style={{ marginTop: 6 }} />
    </TouchableOpacity>
  ))}
</View>
          {(user?.role === 'secretary' || user?.role === 'president') && (
            
  <TouchableOpacity
    style={styles.postAnnBtn}
    onPress={() => setAnnouncementModal(true)}
    activeOpacity={0.8}
  >
    <LinearGradient
      colors={['#6c63ff', '#a78bfa']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.postAnnGrad}
    >
      <Ionicons name="megaphone" size={18} color="#fff" />
      <Text style={styles.postAnnText}>Post Announcement</Text>
    </LinearGradient>
  </TouchableOpacity>
)}

          {/* Announcements */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Announcements</Text>
            <TouchableOpacity style={styles.seeAllBtn}>
              <Text style={styles.seeAll}>See all</Text>
              <Ionicons name="arrow-forward" size={12} color="#6c63ff" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color="#6c63ff" style={{ marginTop: 30 }} />
          ) : announcements.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="megaphone-outline" size={32} color="rgba(255,255,255,0.3)" />
              </View>
              <Text style={styles.emptyTitle}>No announcements yet</Text>
              <Text style={styles.emptySubt}>Check back later for updates</Text>
            </View>
          ) : (
            announcements.map(a => {
              const tag = tagStyles[a.tag] || tagStyles.General;
              return (
                <View key={a._id} style={styles.newsCard}>
                  <View style={[styles.newsAccent, { backgroundColor: tag.accent }]} />
                  <View style={styles.newsContent}>
                    <View style={[styles.tag, { backgroundColor: tag.bg, borderColor: tag.border }]}>
                      <Text style={styles.tagEmoji}>{tag.emoji}</Text>
                      <Text style={[styles.tagText, { color: tag.color }]}>{a.tag}</Text>
                    </View>
                    <Text style={styles.newsTitle}>{a.title}</Text>
                    <Text style={styles.newsDesc}>{a.body}</Text>
                    <View style={styles.newsMeta}>
                      <View style={styles.newsMetaLeft}>
                        <View style={[styles.avatar, { backgroundColor: a.postedBy?.avatarColor || '#6c63ff' }]}>
                          <Text style={styles.avatarText}>{a.postedBy?.initials || '??'}</Text>
                        </View>
                        <Text style={styles.newsAuthor}>{a.postedBy?.name || 'Unknown'}</Text>
                      </View>
                      <Text style={styles.newsTime}>{getTimeAgo(a.createdAt)}</Text>
                    </View>
                    {(user?.role === 'secretary' || user?.role === 'president') && (
  <View style={styles.annActions}>
    <TouchableOpacity
      style={styles.annEditBtn}
      onPress={() => handleEditAnnouncement(a)}
    >
      <Ionicons name="pencil" size={12} color="#a78bfa" />
      <Text style={styles.annEditText}>Edit</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.annDeleteBtn}
      onPress={() => handleDeleteAnnouncement(a._id)}
    >
      <Ionicons name="trash" size={12} color="#ff4757" />
      <Text style={styles.annDeleteText}>Delete</Text>
    </TouchableOpacity>
  </View>
)}
                  </View>
                </View>
              );
            })
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
      <Modal visible={announcementModal} animationType="slide" presentationStyle="pageSheet">
  <View style={styles.modal}>
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>
  {editingAnnouncement ? '✏️ Edit Announcement' : '📢 New Announcement'}
</Text>
        <TouchableOpacity
          onPress={() => {
  setAnnouncementModal(false);
  setEditingAnnouncement(null);
  setAnnTitle(''); setAnnBody(''); setAnnTag('General');
}}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
        <Text style={styles.inputLabel}>TITLE</Text>
        <TextInput
          style={styles.input}
          placeholder="Announcement title"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={annTitle}
          onChangeText={setAnnTitle}
        />

        <Text style={styles.inputLabel}>BODY</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Write your announcement..."
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={annBody}
          onChangeText={setAnnBody}
          multiline
          numberOfLines={4}
        />

        <Text style={styles.inputLabel}>TAG</Text>
        <View style={styles.tagGrid}>
          {['General', 'Urgent', 'Event', 'Maintenance', 'Food'].map(tag => (
            <TouchableOpacity
              key={tag}
              style={[styles.tagChip, annTag === tag && styles.tagChipActive]}
              onPress={() => setAnnTag(tag)}
            >
              {annTag === tag && (
                <LinearGradient
                  colors={['#6c63ff', '#a78bfa']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Text style={[styles.tagChipText, annTag === tag && styles.tagChipTextActive]}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleAnnouncement}
          disabled={annSubmitting}
        >
          <LinearGradient
            colors={['#6c63ff', '#a78bfa']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitGrad}
          >
            {annSubmitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>
  {editingAnnouncement ? 'Update Announcement' : 'Post Announcement'}
</Text>
            }
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  </View>
</Modal>
    </View>
    </SwipeWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07231f' },

  // Background orbs
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  orb: { position: 'absolute', borderRadius: 999 },
  orb1: { width: 350, height: 350, backgroundColor: 'rgba(52,211,153,0.22)', top: -100, left: -80 },
  orb2: { width: 280, height: 280, backgroundColor: 'rgba(45,212,191,0.14)', top: 200, right: -100 },
  orb3: { width: 200, height: 200, backgroundColor: 'rgba(163,230,53,0.08)', bottom: 300, left: 40 },

  // Header
  header: { padding: 20, paddingTop: 10 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 2 },
  userName: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  community: { fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  logoutBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  weatherChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, alignSelf: 'flex-start',
  },
  weatherText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 10 },
  statCard: {
    width: (width - 44) / 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  statAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, borderRadius: 18 },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  statValue: { fontSize: 32, fontWeight: '800', marginBottom: 2 },
  statSub: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },

  // Section header
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAll: { fontSize: 12, color: '#6c63ff', fontWeight: '600' },

  postAnnBtn: { marginHorizontal: 16, marginBottom: 16, borderRadius: 14, overflow: 'hidden' },
postAnnGrad: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
postAnnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
modal: { flex: 1, backgroundColor: '#0a2a25' },
modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
modalTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
modalBody: { padding: 20 },
inputLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
input: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 13, fontSize: 14, color: '#fff' },
textArea: { height: 100, textAlignVertical: 'top' },
tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
tagChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden' },
tagChipActive: { borderColor: 'transparent' },
tagChipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
tagChipTextActive: { color: '#fff' },
submitBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 24, marginBottom: 40 },
submitGrad: { padding: 16, alignItems: 'center' },
submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

annActions: { flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
annEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(167,139,250,0.12)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
annEditText: { fontSize: 11, color: '#a78bfa', fontWeight: '600' },
annDeleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,71,87,0.12)', borderWidth: 1, borderColor: 'rgba(255,71,87,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
annDeleteText: { fontSize: 11, color: '#ff4757', fontWeight: '600' },

  // News cards
  newsCard: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row',
  },
  newsAccent: { width: 3 },
  newsContent: { flex: 1, padding: 14 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 20,
    borderWidth: 1, marginBottom: 8,
  },
  tagEmoji: { fontSize: 11 },
  tagText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  newsTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 4 },
  newsDesc: { fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 18, marginBottom: 12 },
  newsMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  newsMetaLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  newsAuthor: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  newsTime: { fontSize: 11, color: 'rgba(255,255,255,0.25)' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 15, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  emptySubt: { fontSize: 12, color: 'rgba(255,255,255,0.25)' },
});