import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Alert, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { io } from 'socket.io-client';
import { getComplaints, createComplaint, updateComplaintStatus, addComplaintComment } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { BASE_URL } from '../../constants/config';
import SwipeWrapper from '../../components/SwipeWrapper';


const CATEGORIES = ['Parking', 'Maintenance', 'Noise', 'Security', 'Cleanliness', 'Other'];

const statusConfig = {
  open: { color: '#ff4757', bg: 'rgba(255,71,87,0.15)', border: 'rgba(255,71,87,0.25)', label: 'Open', step: 1 },
  review: { color: '#ffa502', bg: 'rgba(255,165,2,0.15)', border: 'rgba(255,165,2,0.25)', label: 'In Review', step: 2 },
  resolved: { color: '#2ed573', bg: 'rgba(46,213,115,0.15)', border: 'rgba(46,213,115,0.25)', label: 'Resolved', step: 3 },
};

const roleColors = {
  secretary: '#ffa502',
  president: '#ff4757',
  committee: '#a78bfa',
  resident: '#6c63ff',
};

export default function ComplaintsScreen() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [detailModal, setDetailModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [comment, setComment] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  const socketRef = useRef(null);
  const selectedComplaintRef = useRef(null);
  const [activeFilter, setActiveFilter] = useState('all');

  const orb1 = useRef(new Animated.Value(0)).current;
  const orb2 = useRef(new Animated.Value(0)).current;

  const isAdmin = ['secretary', 'president', 'committee'].includes(user?.role);

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
    fetchComplaints();

    socketRef.current = io(BASE_URL, { transports: ['websocket'] });
socketRef.current.on('complaint_updated', (updated) => {
  setComplaints(prev => prev.map(c => c._id === updated._id ? updated : c));
  if (selectedComplaintRef.current?._id === updated._id) {
    setSelectedComplaint(updated);
    selectedComplaintRef.current = updated;
  }
});
    socketRef.current.on('new_complaint', (newComplaint) => {
      setComplaints(prev => [newComplaint, ...prev]);
    });

    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, []);

  const orb1Y = orb1.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });
  const orb2Y = orb2.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });

  const fetchComplaints = async () => {
    try {
      const res = await getComplaints();
      setComplaints(res.data.complaints);
    } catch (error) {
      console.log('Error fetching complaints:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchComplaints();
    setRefreshing(false);
  }, []);

  const resetForm = () => { setTitle(''); setDesc(''); setSelectedCat(''); };

  const handleSubmit = async () => {
    if (!title || !desc || !selectedCat) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setSubmitting(true);
    try {
      await createComplaint({ title, description: desc, category: selectedCat });
      Alert.alert('Success', 'Complaint raised!');
      setModalVisible(false);
      resetForm();
      fetchComplaints();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

const openDetail = (complaint) => {
  setSelectedComplaint(complaint);
  selectedComplaintRef.current = complaint;
  setDetailModal(true);
};

  const handleStatusUpdate = async (newStatus) => {
    if (newStatus === 'resolved' && !resolutionNote.trim()) {
      Alert.alert('Required', 'Please write a resolution note before resolving');
      return;
    }
    setUpdatingStatus(true);
    try {
      console.log('UPDATING STATUS:', selectedComplaint._id, newStatus);
      const response = await updateComplaintStatus(selectedComplaint._id, {
        status: newStatus,
        resolutionNote: newStatus === 'resolved' ? resolutionNote : undefined,
      });
      console.log('RESPONSE:', JSON.stringify(response?.data));
      setSelectedComplaint(response.data.complaint);
    setComplaints(prev =>
      prev.map(c => c._id === response.data.complaint._id ? response.data.complaint : c)
    );
      setResolutionNote('');
    } catch (error) {
      console.log('STATUS UPDATE ERROR:', error.response?.status);
    console.log('STATUS UPDATE ERROR DATA:', JSON.stringify(error.response?.data));
    console.log('STATUS UPDATE ERROR MSG:', error.message);
      Alert.alert('Error', error.response?.data?.message || 'Could not update status');
    }
    finally{
   
      setUpdatingStatus(false);
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    setAddingComment(true);
    try {
      await addComplaintComment(selectedComplaint._id, { text: comment });
      setComment('');
    } catch (error) {
      Alert.alert('Error', 'Could not add comment');
    } finally {
      setAddingComment(false);
    }
  };

  const getTimeAgo = (date) => {
    const diff = Math.floor((Date.now() - new Date(date)) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const stats = {
    open: complaints.filter(c => c.status === 'open').length,
    review: complaints.filter(c => c.status === 'review').length,
    resolved: complaints.filter(c => c.status === 'resolved').length,
  };
  const filteredComplaints = activeFilter === 'all'
  ? complaints
  : complaints.filter(c => c.status === activeFilter);

  return (
    <SwipeWrapper>
    <View style={styles.container}>
      <View style={styles.bg}>
        <Animated.View style={[styles.orb, styles.orb1, { transform: [{ translateY: orb1Y }] }]} />
        <Animated.View style={[styles.orb, styles.orb2, { transform: [{ translateY: orb2Y }] }]} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ee0979" />}
        >
          <View style={styles.header}>
            <LinearGradient colors={['rgba(238,9,121,0.3)', 'rgba(255,106,0,0.25)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGrad}>
              <Text style={styles.headerTitle}>Complaint Portal ⚠️</Text>
              <Text style={styles.headerSub}>Transparent community issue tracking</Text>
            </LinearGradient>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {[
              { label: 'Open', value: stats.open, color: '#ff4757', accent: ['#ff4757', '#ff6b81'] },
              { label: 'In Review', value: stats.review, color: '#ffa502', accent: ['#ffa502', '#ffcc02'] },
              { label: 'Resolved', value: stats.resolved, color: '#2ed573', accent: ['#2ed573', '#7bed9f'] },
            ].map((s, i) => (
              <View key={i} style={styles.statBox}>
                <LinearGradient colors={s.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.statAccent} />
                <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statLbl}>{s.label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.raiseBtn} onPress={() => setModalVisible(true)} activeOpacity={0.8}>
            <LinearGradient colors={['#ee0979', '#ff6a00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.raiseBtnGrad}>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.raiseBtnText}>Raise a Complaint</Text>
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.filterRow}>
  {[
    { key: 'all', label: 'All', count: complaints.length },
    { key: 'open', label: 'Open', count: stats.open },
    { key: 'review', label: 'In Review', count: stats.review },
    { key: 'resolved', label: 'Resolved', count: stats.resolved },
  ].map(f => (
    <TouchableOpacity
      key={f.key}
      style={[styles.filterTab, activeFilter === f.key && styles.filterTabActive]}
      onPress={() => setActiveFilter(f.key)}
    >
      {activeFilter === f.key && (
        <LinearGradient
          colors={['#ee0979', '#ff6a00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Text style={[styles.filterTabText, activeFilter === f.key && styles.filterTabTextActive]}>
        {f.label}
      </Text>
      <View style={[styles.filterBadge, activeFilter === f.key && styles.filterBadgeActive]}>
        <Text style={[styles.filterBadgeText, activeFilter === f.key && styles.filterBadgeTextActive]}>
          {f.count}
        </Text>
      </View>
    </TouchableOpacity>
  ))}
</View>
         {filteredComplaints.length === 0 ? (
  <View style={styles.emptyState}>
    <View style={styles.emptyIcon}>
      <Ionicons name="shield-checkmark-outline" size={32} color="rgba(255,255,255,0.2)" />
    </View>
    <Text style={styles.emptyTitle}>No {activeFilter === 'all' ? '' : activeFilter} complaints</Text>
    <Text style={styles.emptySubt}>Nothing to show here</Text>
  </View>
) : (
            filteredComplaints.map(c => {
              const status = statusConfig[c.status] || statusConfig.open;
              const isOwn = c.postedBy?._id === user?._id;
              return (
                <TouchableOpacity
                  key={c._id}
                  style={styles.card}
                  onPress={() => openDetail(c)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.cardAccent, { backgroundColor: status.color }]} />
                  <View style={styles.cardContent}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle}>{c.title}</Text>
                      <View style={[styles.badge, { backgroundColor: status.bg, borderColor: status.border }]}>
                        <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
                      </View>
                    </View>

                    {/* Posted by tag */}
                    <View style={styles.postedByRow}>
                      <View style={[styles.postedAvatar, { backgroundColor: c.postedBy?.avatarColor || '#6c63ff' }]}>
                        <Text style={styles.postedAvatarText}>{c.postedBy?.initials}</Text>
                      </View>
                      <Text style={styles.postedByName}>{c.postedBy?.name}</Text>
                      {isOwn && <View style={styles.youBadge}><Text style={styles.youText}>You</Text></View>}
                      <Text style={styles.postedTime}>{getTimeAgo(c.createdAt)}</Text>
                    </View>

                    <Text style={styles.cardDesc} numberOfLines={2}>{c.description}</Text>

                    <View style={styles.progressTrack}>
                      {[1, 2, 3].map(step => (
                        <View key={step} style={styles.progressStepWrap}>
                          <View style={[
                            styles.progressStep,
                            step < status.step && styles.progressDone,
                            step === status.step && styles.progressCurrent,
                          ]} />
                        </View>
                      ))}
                    </View>

                    <View style={styles.cardFooter}>
                      <View style={[styles.catBadge]}>
                        <Text style={styles.catText}>{c.category}</Text>
                      </View>
                      <View style={styles.cardMeta}>
                        {c.comments?.length > 0 && (
                          <View style={styles.commentCount}>
                            <Ionicons name="chatbubble-outline" size={12} color="rgba(255,255,255,0.3)" />
                            <Text style={styles.commentCountText}>{c.comments.length}</Text>
                          </View>
                        )}
                        <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.2)" />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>

      {/* New Complaint Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Complaint</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>TITLE</Text>
              <TextInput style={styles.input} placeholder="Brief title" placeholderTextColor="rgba(255,255,255,0.25)" value={title} onChangeText={setTitle} />

              <Text style={styles.inputLabel}>DESCRIPTION</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Describe the issue..." placeholderTextColor="rgba(255,255,255,0.25)" value={desc} onChangeText={setDesc} multiline numberOfLines={4} />

              <Text style={styles.inputLabel}>CATEGORY</Text>
              <View style={styles.catGrid}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity key={cat} style={[styles.catChip, selectedCat === cat && styles.catChipActive]} onPress={() => setSelectedCat(cat)}>
                    {selectedCat === cat && <LinearGradient colors={['#ee0979', '#ff6a00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />}
                    <Text style={[styles.catChipText, selectedCat === cat && styles.catChipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
                <LinearGradient colors={['#ee0979', '#ff6a00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitGrad}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Complaint</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={detailModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setDetailModal(false); setResolutionNote(''); setComment(''); }} style={styles.closeBtn}>
                <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Complaint Details</Text>
              <View style={{ width: 36 }} />
            </View>

            {selectedComplaint && (
              <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                {/* Status badge */}
                <View style={styles.detailStatusRow}>
                  <View style={[styles.badge, {
                    backgroundColor: statusConfig[selectedComplaint.status]?.bg,
                    borderColor: statusConfig[selectedComplaint.status]?.border,
                  }]}>
                    <Text style={[styles.badgeText, { color: statusConfig[selectedComplaint.status]?.color }]}>
                      {statusConfig[selectedComplaint.status]?.label}
                    </Text>
                  </View>
                  <View style={[styles.catBadge]}>
                    <Text style={styles.catText}>{selectedComplaint.category}</Text>
                  </View>
                </View>

                {/* Title */}
                <Text style={styles.detailTitle}>{selectedComplaint.title}</Text>

                {/* Posted by */}
                <View style={styles.detailPostedBy}>
                  <View style={[styles.postedAvatar, { backgroundColor: selectedComplaint.postedBy?.avatarColor || '#6c63ff' }]}>
                    <Text style={styles.postedAvatarText}>{selectedComplaint.postedBy?.initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailPostedName}>{selectedComplaint.postedBy?.name}</Text>
                    <Text style={styles.detailPostedSub}>
                      {selectedComplaint.postedBy?.houseNo} · {getTimeAgo(selectedComplaint.createdAt)}
                    </Text>
                  </View>
                  <View style={[styles.roleBadge, { backgroundColor: `${roleColors[selectedComplaint.postedBy?.role]}20`, borderColor: `${roleColors[selectedComplaint.postedBy?.role]}40` }]}>
                    <Text style={[styles.roleText, { color: roleColors[selectedComplaint.postedBy?.role] }]}>
                      {selectedComplaint.postedBy?.role}
                    </Text>
                  </View>
                </View>

                {/* Description */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Description</Text>
                  <Text style={styles.detailDesc}>{selectedComplaint.description}</Text>
                </View>

                {/* Progress */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Progress</Text>
                  <View style={styles.progressTrack}>
                    {[1, 2, 3].map(step => (
                      <View key={step} style={styles.progressStepWrap}>
                        <View style={[
                          styles.progressStep,
                          step < statusConfig[selectedComplaint.status]?.step && styles.progressDone,
                          step === statusConfig[selectedComplaint.status]?.step && styles.progressCurrent,
                        ]} />
                      </View>
                    ))}
                  </View>
                  <View style={styles.progressLabels}>
                    {['Raised', 'In Review', 'Resolved'].map((l, i) => (
                      <Text key={i} style={[styles.progressLabel, i + 1 <= statusConfig[selectedComplaint.status]?.step && { color: 'rgba(255,255,255,0.5)' }]}>{l}</Text>
                    ))}
                  </View>
                </View>

                {/* Resolution note */}
                {selectedComplaint.status === 'resolved' && selectedComplaint.resolutionNote && (
                  <View style={[styles.detailSection, styles.resolutionSection]}>
                    <Text style={styles.detailSectionTitle}>✅ Resolution Note</Text>
                    <Text style={styles.resolutionText}>{selectedComplaint.resolutionNote}</Text>
                    <View style={styles.resolvedByRow}>
                      <View style={[styles.postedAvatar, { backgroundColor: selectedComplaint.resolvedBy?.avatarColor || '#2ed573', width: 28, height: 28, borderRadius: 8 }]}>
                        <Text style={[styles.postedAvatarText, { fontSize: 9 }]}>{selectedComplaint.resolvedBy?.initials}</Text>
                      </View>
                      <Text style={styles.resolvedByText}>
                        Resolved by {selectedComplaint.resolvedBy?.name} · {selectedComplaint.resolvedBy?.houseNo}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Admin status actions  */} 
                {isAdmin && selectedComplaint.status !== 'resolved' && selectedComplaint.postedBy?._id !== user?._id && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Update Status</Text>

                    {selectedComplaint.status === 'open' && (
                      <TouchableOpacity
                        style={[styles.statusActionBtn, updatingStatus && styles.statusActionDisabled]}
                        onPress={() => handleStatusUpdate('review')}
                        disabled={updatingStatus}
                      >
                        <LinearGradient colors={['#ffa502', '#ffcc02']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.statusActionGrad}>
                          {updatingStatus ? <ActivityIndicator color="#fff" size="small" /> : (
                            <>
                              <Ionicons name="eye" size={16} color="#fff" />
                              <Text style={styles.statusActionText}>Move to In Review</Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    )}

                    {selectedComplaint.status === 'review' && (
                      <>
                        <Text style={styles.inputLabel}>RESOLUTION NOTE (REQUIRED)</Text>
                        <TextInput
                          style={[styles.input, styles.textArea, { marginBottom: 12 }]}
                          placeholder="Describe how this was resolved..."
                          placeholderTextColor="rgba(255,255,255,0.25)"
                          value={resolutionNote}
                          onChangeText={setResolutionNote}
                          multiline
                          numberOfLines={3}
                        />
                        <TouchableOpacity
                          style={[styles.statusActionBtn, updatingStatus && styles.statusActionDisabled]}
                          onPress={() => handleStatusUpdate('resolved')}
                          disabled={updatingStatus}
                        >
                          <LinearGradient colors={['#2ed573', '#7bed9f']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.statusActionGrad}>
                            {updatingStatus ? <ActivityIndicator color="#fff" size="small" /> : (
                              <>
                                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                                <Text style={styles.statusActionText}>Mark as Resolved</Text>
                              </>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}

                {/* Comments */}
                {selectedComplaint.status == 'open' && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>
                    Comments ({selectedComplaint.comments?.length || 0})
                  </Text>
                  {selectedComplaint.comments?.length === 0 && (
                    <Text style={styles.noComments}>No comments yet</Text>
                  )}
                  {selectedComplaint.comments?.map((comment, i) => (
                    <View key={i} style={styles.commentItem}>
                      <View style={[styles.postedAvatar, { backgroundColor: comment.user?.avatarColor || '#6c63ff', width: 32, height: 32, borderRadius: 9 }]}>
                        <Text style={[styles.postedAvatarText, { fontSize: 10 }]}>{comment.user?.initials}</Text>
                      </View>
                      <View style={styles.commentContent}>
                        <View style={styles.commentHeader}>
                          <Text style={styles.commentName}>{comment.user?.name}</Text>
                          <View style={[styles.roleBadge, { backgroundColor: `${roleColors[comment.user?.role]}20`, borderColor: `${roleColors[comment.user?.role]}40` }]}>
                            <Text style={[styles.roleText, { color: roleColors[comment.user?.role] }]}>
                              {comment.user?.role}
                            </Text>
                          </View>
                          <Text style={styles.commentTime}>{getTimeAgo(comment.createdAt)}</Text>
                        </View>
                        <Text style={styles.commentText}>{comment.text}</Text>
                      </View>
                    </View>
                  ))}

                  {/* Add comment input */}
                  <View style={styles.addCommentRow}>
                    <TextInput
                      style={styles.commentInput}
                      placeholder="Add a comment..."
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      value={comment}
                      onChangeText={setComment}
                      multiline
                    />
                    <TouchableOpacity
                      style={[styles.sendCommentBtn, comment.trim() && styles.sendCommentBtnActive]}
                      onPress={handleAddComment}
                      disabled={!comment.trim() || addingComment}
                    >
                      {addingComment
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Ionicons name="send" size={16} color={comment.trim() ? '#fff' : 'rgba(255,255,255,0.3)'} />
                      }
                    </TouchableOpacity>
                  </View>
                </View>
                )}
                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
  
      </Modal>
    </View>
    </SwipeWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07231f' },
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  orb: { position: 'absolute', borderRadius: 999 },
  orb1: { width: 300, height: 300, backgroundColor: 'rgba(52,211,153,0.20)', top: -60, right: -60 },
  orb2: { width: 250, height: 250, backgroundColor: 'rgba(45,212,191,0.12)', top: 300, left: -80 },
  header: { padding: 16, paddingBottom: 8 },
  headerGrad: { borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  statsRow: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 8 },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  statAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  statNum: { fontSize: 26, fontWeight: '800', marginBottom: 2 },
  statLbl: { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  raiseBtn: { marginHorizontal: 16, marginBottom: 16, borderRadius: 14, overflow: 'hidden' },
  raiseBtnGrad: { padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  raiseBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  sectionCount: { fontSize: 12, color: '#6c63ff', fontWeight: '600' },
  card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', flexDirection: 'row' },
  cardAccent: { width: 3 },
  cardContent: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#fff', flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  postedByRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  postedAvatar: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  postedAvatarText: { fontSize: 8, fontWeight: '700', color: '#fff' },
  postedByName: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '500', flex: 1 },
  youBadge: { backgroundColor: 'rgba(108,99,255,0.2)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  youText: { fontSize: 9, color: '#a78bfa', fontWeight: '700' },
  postedTime: { fontSize: 10, color: 'rgba(255,255,255,0.25)' },
  cardDesc: { fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 18, marginBottom: 10 },
  progressTrack: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  progressStepWrap: { flex: 1 },
  progressStep: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' },
  progressDone: { backgroundColor: '#6c63ff' },
  progressCurrent: { backgroundColor: '#f093fb' },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { fontSize: 9, color: 'rgba(255,255,255,0.2)', fontWeight: '500' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catBadge: { backgroundColor: 'rgba(108,99,255,0.15)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  catText: { fontSize: 11, color: '#a78bfa', fontWeight: '600' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentCount: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  commentCountText: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 15, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  emptySubt: { fontSize: 12, color: 'rgba(255,255,255,0.2)' },
  modal: { flex: 1, backgroundColor: '#0a2a25' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 20 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 13, fontSize: 14, color: '#fff' },
  textArea: { height: 100, textAlignVertical: 'top' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  catChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden' },
  catChipActive: { borderColor: 'transparent' },
  catChipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  catChipTextActive: { color: '#fff' },
  submitBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 24, marginBottom: 40 },
  submitGrad: { padding: 16, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  detailStatusRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  detailTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 16 },
  detailPostedBy: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  detailPostedName: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 2 },
  detailPostedSub: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  roleText: { fontSize: 9, fontWeight: '700', textTransform: 'capitalize' },
  detailSection: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  detailSectionTitle: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  detailDesc: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 20 },
  resolutionSection: { borderColor: 'rgba(46,213,115,0.2)', backgroundColor: 'rgba(46,213,115,0.05)' },
  resolutionText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 20, marginBottom: 12 },
  resolvedByRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(46,213,115,0.15)' },
  resolvedByText: { fontSize: 11, color: '#2ed573', fontWeight: '500' },
  statusActionBtn: { borderRadius: 12, overflow: 'hidden' },
  statusActionGrad: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  statusActionText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  noComments: { fontSize: 12, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' },
  commentItem: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  commentContent: { flex: 1 },
  statusActionDisabled: { opacity: 0.4 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  commentName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  commentTime: { fontSize: 10, color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' },
  commentText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },
  addCommentRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 14 },
  commentInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, fontSize: 13, color: '#fff', maxHeight: 80 },
  sendCommentBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  sendCommentBtnActive: { backgroundColor: '#6c63ff' },
  filterRow: {
  flexDirection: 'row', gap: 8,
  paddingHorizontal: 16, marginBottom: 14,
},
filterTab: {
  flex: 1, flexDirection: 'row', alignItems: 'center',
  justifyContent: 'center', gap: 4,
  paddingVertical: 8, borderRadius: 20,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  backgroundColor: 'rgba(255,255,255,0.04)',
  overflow: 'hidden',
},
filterTabActive: { borderColor: 'transparent' },
filterTabText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
filterTabTextActive: { color: '#fff' },
filterBadge: {
  backgroundColor: 'rgba(255,255,255,0.08)',
  paddingHorizontal: 6, paddingVertical: 2,
  borderRadius: 10,
},
filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
filterBadgeText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
filterBadgeTextActive: { color: '#fff' }
}); 