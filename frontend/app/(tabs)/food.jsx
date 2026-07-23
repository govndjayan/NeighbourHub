import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import SwipeWrapper from '../../components/SwipeWrapper';
import { io } from 'socket.io-client';
import { BASE_URL } from '../../constants/config';



import { getFoodPosts, createFoodPost, updateFoodPost, deleteFoodPost, claimFood, offerFood, uploadImage, getFoodOffers, acceptOffer, markFoodOutOfStock, commentOnOffer } from '../../services/api';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Alert, Animated, Dimensions, Image,
  KeyboardAvoidingView, Platform, Linking
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');
const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Produce', 'Item'];
const BLOCKS = ['All', 'Lands Down Park', 'Hill Top Garden', 'Aakkulam Avenue'];
const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest' },
  { key: 'availability', label: 'Availability' },
  { key: 'oldest', label: 'Oldest to Newest' },
];

// Instagram/Messenger-style comment bubbles + composer, reused inline on a
// card and inside the request detail modal — one implementation, two spots.
const ThreadPanel = ({ loading, comments, currentUserId, inputValue, onChangeInput, onSend, sending }) => (
  <View style={styles.threadPanel} onStartShouldSetResponder={() => true}>
    {loading ? (
      <ActivityIndicator color="#6c63ff" style={{ paddingVertical: 16 }} />
    ) : (
      <>
        <ScrollView style={styles.threadPanelScroll} contentContainerStyle={{ paddingVertical: 8 }}>
          {comments.length === 0 ? (
            <Text style={styles.threadHint}>Say hello to coordinate the pickup 👋</Text>
          ) : (
            comments.map((c, i) => {
              const cid = c.user?._id || c.user;
              const mine = cid && currentUserId && cid.toString() === currentUserId.toString();
              return (
                <View key={i} style={[styles.threadRow, mine ? styles.threadRowMine : styles.threadRowOther]}>
                  <View style={[styles.threadBubble, mine ? styles.threadBubbleMine : styles.threadBubbleOther]}>
                    {!mine && <Text style={styles.threadAuthor}>{c.user?.name || 'Helper'}</Text>}
                    <Text style={styles.threadText}>{c.text}</Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
        <View style={styles.threadPanelInputRow}>
          <TextInput
            style={styles.threadPanelInput}
            placeholder="Type a message..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={inputValue}
            onChangeText={onChangeInput}
            multiline
          />
          <TouchableOpacity
            style={styles.threadPanelSendBtn}
            onPress={onSend}
            disabled={sending || !inputValue.trim()}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="send" size={16} color="#fff" />}
          </TouchableOpacity>
        </View>
      </>
    )}
  </View>
);

const SkeletonCard = () => {
  const pulse = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.75, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
      <View style={styles.cardContent}>
        <Animated.View style={[styles.skeletonLine, { width: '55%', height: 18, opacity: pulse }]} />
        <Animated.View style={[styles.skeletonLine, { width: '35%', height: 12, marginTop: 8, opacity: pulse }]} />
        <Animated.View style={[styles.skeletonLine, { width: '100%', height: 14, marginTop: 16, opacity: pulse }]} />
        <Animated.View style={[styles.skeletonLine, { width: '70%', height: 14, marginTop: 6, opacity: pulse }]} />
      </View>
    </View>
  );
};

 const FoodCard = ({
   item, type, user, getTimeAgo, handleClaim, handleOffer, handleViewOffers, handleViewDetail, handleMarkOutOfStock,
 }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();

  return (
  <TouchableOpacity
    onPress={() => handleViewDetail(item)}
    onPressIn={onPressIn}
    onPressOut={onPressOut}
    activeOpacity={0.9}
  >
    <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
      <View style={[styles.cardAccent, { backgroundColor: type === 'share' ? '#2ed573' : '#f5576c' }]} />
      <View style={styles.cardContent}>

        {/* Photo — shown first, full width, for a more visual/modern feed */}
        {item.photo ? (
          <Image source={{ uri: item.photo }} style={styles.cardImage} resizeMode="cover" />
        ) : null}

        {/* Card Top */}
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardFlat}>{item.postedBy?.name} · {item.postedBy?.houseNo}</Text>
          </View>
          <View style={[styles.badge, {
            backgroundColor: type === 'share' ? 'rgba(46,213,115,0.15)' : 'rgba(245,87,108,0.15)',
            borderColor: type === 'share' ? 'rgba(46,213,115,0.25)' : 'rgba(245,87,108,0.25)'
          }]}>
            <Text style={[styles.badgeText, { color: type === 'share' ? '#2ed573' : '#f5576c' }]}>
              {type === 'share' ? (item.category || 'Food') : 'Request'}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        {type === 'share' ? (
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, {
              width: `${((item.portions - item.remainingPortions) / item.portions) * 100}%`
            }]} />
          </View>
        ) : null}

        {/* Description */}
        {item.description ? (
          <Text style={styles.cardDesc}>{item.description}</Text>
        ) : null}

        {/* Bottom row: meta info + action, aligned on one line */}
        <View style={styles.bottomRow}>
          <View style={styles.countRow}>
            <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.3)" />
            <Text style={styles.countText}>{getTimeAgo(item.createdAt)}</Text>
            {type === 'share' ? (
              <>
                <Text style={styles.dot}>·</Text>
                <Ionicons name="people-outline" size={12} color="rgba(108,99,255,0.8)" />
                <Text style={styles.countText}>{item.remainingPortions} of {item.portions} left</Text>
              </>
            ) : null}
            {type === 'request' ? (
              <>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.countText}>{item.offers?.length || 0} offers</Text>
              </>
            ) : null}
          </View>

          {/* Collect / Offer help — only for other users' posts */}
          {item.postedBy?._id !== user?._id ? (
            type === 'request' && item.selectedOffer ? (
              // A helper has already been chosen. If it's ME, a compact
              // "Coordinate" button opens the detail window with the chat.
              item.selectedOffer?._id === user?._id ? (
                <TouchableOpacity style={styles.coordinateBtn} onPress={() => handleViewDetail(item)}>
                  <Ionicons name="chatbubble-ellipses" size={13} color="#fff" />
                  <Text style={styles.coordinateBtnText}>Coordinate</Text>
                </TouchableOpacity>
              ) : null
            ) : (
              <TouchableOpacity
                style={type === 'share' ? styles.claimBtn : styles.offerBtn}
                onPress={() => type === 'share' ? handleClaim(item) : handleOffer(item._id)}
              >
                <Text style={type === 'share' ? styles.claimBtnText : styles.offerBtnText}>
                  {type === 'share' ? 'Collect' : 'Offer help'}
                </Text>
              </TouchableOpacity>
            )
          ) : null}

          {/* Poster of a request: coordinate with the accepted helper, or view pending offers */}
          {type === 'request' && item.postedBy?._id === user?._id && item.selectedOffer ? (
            <TouchableOpacity style={styles.coordinateBtn} onPress={() => handleViewDetail(item)}>
              <Ionicons name="chatbubble-ellipses" size={13} color="#fff" />
              <Text style={styles.coordinateBtnText}>Coordinate</Text>
            </TouchableOpacity>
          ) : type === 'request' && item.postedBy?._id === user?._id && item.offers?.length > 0 ? (
            <TouchableOpacity
              style={styles.viewOffersBtn}
              onPress={() => handleViewOffers(item)}
            >
              <Ionicons name="people" size={13} color="#fff" />
              <Text style={styles.viewOffersBtnText}>
                {'View ' + item.offers.length + ' offer' + (item.offers.length > 1 ? 's' : '')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

      </View>
    </Animated.View>
  </TouchableOpacity>
  );
};

export default function FoodScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [image, setImage] = useState(null);
  const [sharePosts, setSharePosts] = useState([]);
  const [requestPosts, setRequestPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [portions, setPortions] = useState('1');
  const [category, setCategory] = useState('');
  const [preferences, setPreferences] = useState('');
  const [uploading, setUploading] = useState(false);
  const [offersModal, setOffersModal] = useState(false);
const [selectedPost, setSelectedPost] = useState(null);
const [postOffers, setPostOffers] = useState([]);
const [loadingOffers, setLoadingOffers] = useState(false);
// Offer comment (optional) when helping
const [offerModal, setOfferModal] = useState(false);
const [offerTargetId, setOfferTargetId] = useState(null);
const [offerComment, setOfferComment] = useState('');
const [offerSubmitting, setOfferSubmitting] = useState(false);
// How many portions to collect from a share post
const [claimModal, setClaimModal] = useState(false);
const [claimTarget, setClaimTarget] = useState(null);
const [claimQuantity, setClaimQuantity] = useState(1);
const [claimSubmitting, setClaimSubmitting] = useState(false);
// Toast — lightweight, non-blocking confirmation instead of Alert for success paths
const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }
const toastAnim = useRef(new Animated.Value(0)).current;
const toastTimeoutRef = useRef(null);
const showToast = useCallback((message, type = 'success') => {
  if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
  setToast({ message, type });
  toastAnim.setValue(0);
  Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 80 }).start();
  toastTimeoutRef.current = setTimeout(() => {
    Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToast(null));
  }, 2200);
}, [toastAnim]);
// Discovery: sort + block filter for the browsing lists, tucked behind a filter button
const [sortBy, setSortBy] = useState('newest');
const [blockFilter, setBlockFilter] = useState('All');
const [filterModal, setFilterModal] = useState(false);
// Sliding pill under the Posts/Requests segmented control
const [segmentWidth, setSegmentWidth] = useState(0);
const segmentAnim = useRef(new Animated.Value(0)).current;
// Live coordination thread — always visible on an accepted request's card
// (no separate "message helper" click). Keyed by food post id since several
// accepted requests can have their threads showing at once.
const [threads, setThreads] = useState({}); // { [postId]: { comments, offerId, loading, input, sending } }
const threadsRef = useRef(threads);
useEffect(() => { threadsRef.current = threads; }, [threads]);
const loadedThreadIdsRef = useRef(new Set());
const socketRef = useRef(null);
const [detailModal, setDetailModal] = useState(false);
const [detailPost, setDetailPost] = useState(null);
// Set when the create modal is repurposed to edit an existing post/request
const [editingId, setEditingId] = useState(null);
// Always-fresh ref so the socket listeners (set up once on mount) can see
// the current user without needing to reconnect the socket.
const userRef = useRef(user);
useEffect(() => { userRef.current = user; }, [user]);

const [activeSubTab, setActiveSubTab] = useState('posts'); // 'posts' | 'requests'
  const [showMine, setShowMine] = useState(false); // filter current tab to my own items

  useEffect(() => {
    Animated.spring(segmentAnim, {
      toValue: activeSubTab === 'requests' ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 80,
    }).start();
  }, [activeSubTab]);

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
    fetchFoodPosts();
      // Setup socket
  socketRef.current = io(BASE_URL, { transports: ['websocket'] });
    // Community-wide events are broadcast to a per-society room, so we have
    // to join it (on every (re)connect) or we receive nothing.
    socketRef.current.on('connect', () => {
      const sid = userRef.current?.societyId;
      if (sid) socketRef.current.emit('join_society', sid);
    });
    // Listen for food claimed event
    socketRef.current.on('food_claimed', (updatedPost) => {
    console.log('FOOD CLAIMED EVENT:', updatedPost._id);
    setSharePosts(prev =>
      prev.map(post => post._id === updatedPost._id ? updatedPost : post)
    );
  });
// Listen for new food post
  socketRef.current.on('new_food_post', (newPost) => {
    if (newPost.type === 'share') {
      setSharePosts(prev => [newPost, ...prev]);
    } else {
      setRequestPosts(prev => [newPost, ...prev]);
    }
  });
// Listen for new offer on request
  socketRef.current.on('new_offer', (updatedPost) => {
    setRequestPosts(prev =>
      prev.map(post => post._id === updatedPost._id ? updatedPost : post)
    );
  });

  // Listen for offer accepted
  socketRef.current.on('offer_accepted', (updatedPost) => {
    // Once a helper is chosen, the request becomes private to the poster and
    // the chosen helper — everyone else should have it drop out of their feed.
    const me = userRef.current?._id;
    const isPoster = (updatedPost.postedBy?._id || updatedPost.postedBy) === me;
    const isChosenHelper = (updatedPost.selectedOffer?._id || updatedPost.selectedOffer) === me;
    if (!isPoster && !isChosenHelper) {
      setRequestPosts(prev => prev.filter(post => post._id !== updatedPost._id));
      return;
    }
    setRequestPosts(prev =>
      prev.map(post => post._id === updatedPost._id ? updatedPost : post)
    );
  });
  // Listen for a post/request being edited
  socketRef.current.on('food_edited', (updatedPost) => {
    if (updatedPost.type === 'share') {
      setSharePosts(prev => prev.map(p => p._id === updatedPost._id ? updatedPost : p));
    } else {
      setRequestPosts(prev => prev.map(p => p._id === updatedPost._id ? updatedPost : p));
    }
  });
  // Listen for a post/request being deleted
  socketRef.current.on('food_deleted', ({ _id }) => {
    setSharePosts(prev => prev.filter(p => p._id !== _id));
    setRequestPosts(prev => prev.filter(p => p._id !== _id));
  });

  // Listen for a new coordination-thread message
  socketRef.current.on('offer_comment', ({ postId, post: updatedPost }) => {
    setRequestPosts(prev =>
      prev.map(post => post._id === updatedPost._id ? updatedPost : post)
    );
    // Keep the always-visible comment panel live for this request's thread
    const pid = postId?.toString?.() || postId;
    setThreads(prev => {
      if (!prev[pid]) return prev;
      const accepted = (updatedPost.offers || []).find(o => o.isSelected) || updatedPost.offers?.[0];
      return { ...prev, [pid]: { ...prev[pid], comments: accepted?.comments || [] } };
    });
  });
  // Food updated
  socketRef.current.on('food_updated', (updatedPost) => {
  setSharePosts(prev => prev.filter(p => p._id !== updatedPost._id));
});

  return () => {
    if (socketRef.current) socketRef.current.disconnect();
  };
}, []);

  const orb1Y = orb1.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });
  const orb2Y = orb2.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });

  const fetchFoodPosts = async () => {
    try {
      const [shareRes, requestRes] = await Promise.all([
        getFoodPosts('share'),
        getFoodPosts('request'),
      ]);
      setSharePosts(shareRes.data.posts);
      setRequestPosts(requestRes.data.posts);
    } catch (error) {
      console.log('Error fetching food posts:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFoodPosts();
    setRefreshing(false);
  }, []);

const resetForm = () => {
  setTitle(''); setDescription(''); setPortions('1');
  setCategory(''); setPreferences(''); setImage(null);
  setEditingId(null);
};

// Prefill the create modal with an existing post/request and switch it into edit mode
const handleEditPost = (post) => {
  setTitle(post.title || '');
  setDescription(post.description || '');
  setPortions(String(post.portions || 1));
  setCategory(post.category || '');
  setPreferences(post.preferences || '');
  setImage(post.photo || null);
  setEditingId(post._id);
  setModalType(post.type);
};

const handleSubmit = async () => {
  if (!title) {
    Alert.alert('Error', 'Please add a title');
    return;
  }
  setSubmitting(true);
      let photoUrl = image;

  try {

    // Upload image to Cloudinary only if a new local photo was picked
if (image && image.startsWith('file')) {
  try {
    setUploading(true);
    photoUrl = await uploadImage(image);
    console.log('PHOTO URL AFTER UPLOAD:', photoUrl);
    setUploading(false);
  } catch (err) {
    console.log('UPLOAD ERROR:', err);
    setUploading(false);
    Alert.alert('Warning', 'Could not upload image, posting without photo');
  }
}
    if (editingId) {
      await updateFoodPost(editingId, {
        title,
        description,
        category: category || undefined,
        portions: parseInt(portions),
        preferences,
        photo: photoUrl,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Changes saved!');
    } else {
      console.log('CREATING POST WITH PHOTO:', photoUrl);
      await createFoodPost({
        type: modalType,
        title,
        description,
        category: category || undefined,
        portions: parseInt(portions),
        preferences,
        photo: photoUrl,
        availableTill: new Date(Date.now() + 8 * 60 * 60 * 1000),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(modalType === 'share' ? 'Food post shared!' : 'Request posted!');
    }
    setModalType(null);
    resetForm();
    fetchFoodPosts();
  } catch (error) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert('Error', error.response?.data?.message || 'Something went wrong');
  } finally {
    setSubmitting(false);
  }
};

const handleDeletePost = (post) => {
  // A helper who already accepted (and hasn't marked it fulfilled yet) is
  // mid-coordination — make sure the poster knows deleting cuts that off.
  const acceptedOffer = post.offers?.find(o => o.isSelected) || post.offers?.[0];
  const hasActiveHelper = post.type === 'request' && post.selectedOffer && !acceptedOffer?.fulfilled;

  Alert.alert(
    post.type === 'share' ? 'Delete this post?' : 'Delete this request?',
    hasActiveHelper
      ? `${post.selectedOffer?.name || 'A neighbour'} has already agreed to help with this request. Deleting it now will end that coordination. This cannot be undone.`
      : 'This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteFoodPost(post._id);
            if (post.type === 'share') {
              setSharePosts(prev => prev.filter(p => p._id !== post._id));
            } else {
              setRequestPosts(prev => prev.filter(p => p._id !== post._id));
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            showToast(post.type === 'share' ? 'Post deleted' : 'Request deleted');
          } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.response?.data?.message || 'Could not delete');
          }
        }
      }
    ]
  );
};

  // Open the quantity sheet; actual claim happens in submitClaim
  const handleClaim = (post) => {
    setClaimTarget(post);
    setClaimQuantity(1);
    setClaimModal(true);
  };

  const submitClaim = async () => {
    if (!claimTarget) return;
    setClaimSubmitting(true);
    try {
      await claimFood(claimTarget._id, { quantity: claimQuantity });
      setClaimModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(`Claimed ${claimQuantity} portion${claimQuantity > 1 ? 's' : ''}!`);
      fetchFoodPosts();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.response?.data?.message || 'Could not claim');
    } finally {
      setClaimSubmitting(false);
    }
  };

  // Open the optional-comment sheet; actual send happens in submitOffer
  const handleOffer = (postId) => {
    setOfferTargetId(postId);
    setOfferComment('');
    setOfferModal(true);
  };

  const submitOffer = async () => {
    if (!offerTargetId) return;
    setOfferSubmitting(true);
    try {
      // Comment is optional — send whatever (possibly empty) note the user typed
      await offerFood(offerTargetId, { description: offerComment.trim(), portions: 1 });
      setOfferModal(false);
      setOfferTargetId(null);
      setOfferComment('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Offer sent!');
      fetchFoodPosts();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.response?.data?.message || 'Could not send offer');
    } finally {
      setOfferSubmitting(false);
    }
  };

  // Load an accepted request's coordination thread (idempotent — safe to
  // call repeatedly, it only fetches once per post).
  const loadThread = useCallback(async (postId) => {
    if (loadedThreadIdsRef.current.has(postId)) return;
    loadedThreadIdsRef.current.add(postId);
    setThreads(prev => ({ ...prev, [postId]: { comments: [], offerId: null, loading: true, input: '', sending: false } }));
    try {
      const res = await getFoodOffers(postId);
      const accepted = (res.data.offers || []).find(o => o.isSelected) || res.data.offers?.[0];
      setThreads(prev => ({
        ...prev,
        [postId]: { ...(prev[postId] || {}), comments: accepted?.comments || [], offerId: accepted?._id || null, loading: false },
      }));
    } catch (error) {
      loadedThreadIdsRef.current.delete(postId);
      setThreads(prev => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
    }
  }, []);

  const updateThreadInput = useCallback((postId, text) => {
    setThreads(prev => ({ ...prev, [postId]: { ...(prev[postId] || {}), input: text } }));
  }, []);

  // Post a message into the accepted offer's live coordination thread
  const sendThread = useCallback(async (postId) => {
    const t = threadsRef.current[postId];
    const text = (t?.input || '').trim();
    if (!text || !t?.offerId) return;
    setThreads(prev => ({ ...prev, [postId]: { ...prev[postId], sending: true } }));
    try {
      const res = await commentOnOffer(postId, t.offerId, text);
      const accepted = (res.data.post?.offers || []).find(o => o.isSelected) || res.data.post?.offers?.[0];
      setThreads(prev => ({ ...prev, [postId]: { ...prev[postId], comments: accepted?.comments || [], input: '', sending: false } }));
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Could not send message. Please try again.');
      setThreads(prev => ({ ...prev, [postId]: { ...prev[postId], sending: false } }));
    }
  }, []);

  // Auto-load the thread for every request that now has an accepted helper
  // (either side of the deal) so the comment box is already populated —
  // nothing to click to reveal it.
  useEffect(() => {
    requestPosts
      .filter(p => p.selectedOffer && (
        (p.selectedOffer?._id || p.selectedOffer) === user?._id ||
        (p.postedBy?._id || p.postedBy) === user?._id
      ))
      .forEach(p => loadThread(p._id));
  }, [requestPosts, user?._id, loadThread]);
  const handleViewDetail = (post) => {
  setDetailPost(post);
  setDetailModal(true);
};
  // Ask for a permission; if permanently denied, guide the user to Settings
  const ensurePermission = async (requestFn, label) => {
    const current = await requestFn();
    if (current.granted) return true;
    // canAskAgain === false means the OS will no longer show the prompt
    if (current.canAskAgain === false) {
      Alert.alert(
        `${label} access is off`,
        `Enable ${label} access for NeighbourHub in Settings to use this option.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    } else {
      Alert.alert('Permission needed', `${label} permission is required.`);
    }
    return false;
  };

  const handlePickImage = async () => {
  Alert.alert(
    'Add Photo',
    'Choose an option',
    [
      {
        text: 'Take Photo',
        onPress: async () => {
          const ok = await ensurePermission(
            () => ImagePicker.requestCameraPermissionsAsync(),
            'Camera'
          );
          if (!ok) return;
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
          });
          if (!result.canceled) setImage(result.assets[0].uri);
        }
      },
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          const ok = await ensurePermission(
            () => ImagePicker.requestMediaLibraryPermissionsAsync(),
            'Gallery'
          );
          if (!ok) return;
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
          });
          if (!result.canceled) setImage(result.assets[0].uri);
        }
      },
      { text: 'Cancel', style: 'cancel' }
    ]
  );
};
const handleViewOffers = async (post) => {
  setSelectedPost(post);
  setOffersModal(true);
  setLoadingOffers(true);
  try {
    const res = await getFoodOffers(post._id);
    setPostOffers(res.data.offers);
  } catch (error) {
    Alert.alert('Error', 'Could not load offers');
  } finally {
    setLoadingOffers(false);
  }
};
const handleAcceptOffer = async (offerId) => {
  Alert.alert(
    'Accept Offer',
    'Are you sure you want to accept this offer?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          try {
            await acceptOffer(selectedPost._id, offerId);
            setOffersModal(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast('Offer accepted! Tap the card to coordinate.');
            fetchFoodPosts();
          } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.response?.data?.message || 'Could not accept offer');
          }
        }
      }
    ]
  );
};
const handleMarkOutOfStock = async (postId) => {
  Alert.alert(
    'Mark as Out of Stock',
    'This will remove the post from the feed. Are you sure?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: 'destructive',
        onPress: async () => {
          try {
            await markFoodOutOfStock(postId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast('Post marked as out of stock');
            fetchFoodPosts();
          } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.response?.data?.message || 'Could not update');
          }
        }
      }
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

  // Apply the "My" filter to whichever sub-tab is active
  const mine = (p) => (p.postedBy?._id || p.postedBy) === user?._id;
  const visibleShares = showMine ? sharePosts.filter(mine) : sharePosts;

  // Requests with an accepted helper surface in their own highlighted
  // section — pulled out of the regular list entirely so they don't sit
  // lost among open requests. Same treatment for both sides of the deal:
  // the helper who got accepted, and the poster who accepted someone.
  const iAmAcceptedHelper = (p) => (p.selectedOffer?._id || p.selectedOffer) === user?._id;
  const iPostedWithHelper = (p) => mine(p) && !!p.selectedOffer;
  const acceptedHelpRequests = requestPosts.filter(iAmAcceptedHelper);
  const myAcceptedRequests = requestPosts.filter(iPostedWithHelper);
  const regularRequests = requestPosts.filter(p => !iAmAcceptedHelper(p) && !iPostedWithHelper(p));
  const visibleRequests = showMine ? regularRequests.filter(mine) : regularRequests;

  // Discovery: narrow by neighbourhood block, then sort
  const byBlock = (p) => blockFilter === 'All' || p.postedBy?.block === blockFilter;
  const sortList = (list, kind) => {
    const arr = [...list];
    if (sortBy === 'availability') {
      arr.sort((a, b) => {
        const aTime = new Date(kind === 'share' ? a.availableTill : (a.neededBy || a.availableTill)).getTime();
        const bTime = new Date(kind === 'share' ? b.availableTill : (b.neededBy || b.availableTill)).getTime();
        return (isNaN(aTime) ? Infinity : aTime) - (isNaN(bTime) ? Infinity : bTime);
      });
    } else if (sortBy === 'oldest') {
      arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return arr; // 'newest' — already createdAt desc from the API
  };
  const discoverableShares = sortList(visibleShares.filter(byBlock), 'share');
  const discoverableRequests = sortList(visibleRequests.filter(byBlock), 'request');

  // Build the scrollable content as a flat array so section headers can be
  // marked sticky by index (ScrollView's stickyHeaderIndices) — the number
  // of sections varies (accepted sections only show when non-empty), so the
  // indices are computed here rather than hard-coded.
  const listChildren = [];
  const stickyIndices = [];

  listChildren.push(
    <View key="header" style={styles.header}>
      <LinearGradient colors={['rgba(240,147,251,0.3)', 'rgba(245,87,108,0.3)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGrad}>
        <Text style={styles.headerTitle}>Food & Resource Hub🍱</Text>
        <Text style={styles.headerSub}>Share and request food, products and lot more</Text>
      </LinearGradient>
    </View>
  );

  listChildren.push(
    <View key="subtab" style={styles.subTabBar}>
      <View style={styles.segment} onLayout={(e) => setSegmentWidth(e.nativeEvent.layout.width)}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segmentIndicator,
            segmentWidth > 0 && {
              width: (segmentWidth - 8) / 2,
              transform: [{
                translateX: segmentAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, (segmentWidth - 8) / 2],
                }),
              }],
            },
          ]}
        />
        <TouchableOpacity
          style={styles.segmentBtn}
          onPress={() => { setActiveSubTab('posts'); setShowMine(false); }}
          activeOpacity={0.85}
        >
          <Text style={[styles.segmentText, activeSubTab === 'posts' && styles.segmentTextActive]}>Posts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.segmentBtn}
          onPress={() => { setActiveSubTab('requests'); setShowMine(false); }}
          activeOpacity={0.85}
        >
          <Text style={[styles.segmentText, activeSubTab === 'requests' && styles.segmentTextActive]}>Requests</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.myPill, showMine && styles.myPillActive]}
        onPress={() => setShowMine(m => !m)}
        activeOpacity={0.8}
      >
        <Ionicons name="person" size={15} color={showMine ? '#fff' : '#f5576c'} />
        <Text style={[styles.myPillText, showMine && styles.myPillTextActive]}>
          {activeSubTab === 'posts' ? 'My Posts' : 'My Requests'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const filterActive = blockFilter !== 'All' || sortBy !== 'newest';
  listChildren.push(
    <View key="filterBtnRow" style={styles.filterBtnRow}>
      <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterModal(true)}>
        <Ionicons name="options-outline" size={15} color="#fff" />
        <Text style={styles.filterBtnText}>Filter</Text>
        {filterActive && <View style={styles.filterBtnDot} />}
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    listChildren.push(<SkeletonCard key="sk1" />, <SkeletonCard key="sk2" />, <SkeletonCard key="sk3" />);
  } else {
    if (activeSubTab === 'requests' && myAcceptedRequests.length > 0) {
      stickyIndices.push(listChildren.length);
      listChildren.push(
        <View key="hdr-mine-accepted" style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, styles.acceptedSectionTitle]}>🤝 Helper accepted</Text>
          <Text style={styles.sectionCount}>{`${myAcceptedRequests.length} active`}</Text>
        </View>
      );
      myAcceptedRequests.forEach(item => listChildren.push(
        <FoodCard key={item._id} item={item} type="request" user={user} getTimeAgo={getTimeAgo} handleClaim={handleClaim} handleOffer={handleOffer} handleViewOffers={handleViewOffers} handleViewDetail={handleViewDetail} handleMarkOutOfStock={handleMarkOutOfStock} />
      ));
    }

    if (activeSubTab === 'requests' && acceptedHelpRequests.length > 0) {
      stickyIndices.push(listChildren.length);
      listChildren.push(
        <View key="hdr-helping" style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, styles.acceptedSectionTitle]}>✅ Accepted your offer</Text>
          <Text style={styles.sectionCount}>{`${acceptedHelpRequests.length} active`}</Text>
        </View>
      );
      acceptedHelpRequests.forEach(item => listChildren.push(
        <FoodCard key={item._id} item={item} type="request" user={user} getTimeAgo={getTimeAgo} handleClaim={handleClaim} handleOffer={handleOffer} handleViewOffers={handleViewOffers} handleViewDetail={handleViewDetail} handleMarkOutOfStock={handleMarkOutOfStock} />
      ));
    }

    stickyIndices.push(listChildren.length);
    listChildren.push(
      <View key="hdr-main" style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {activeSubTab === 'posts'
            ? (showMine ? 'My shared posts' : 'Available to claim')
            : (showMine ? 'My requests' : 'Open requests')}
        </Text>
        <Text style={styles.sectionCount}>
          {`${activeSubTab === 'posts' ? discoverableShares.length : discoverableRequests.length} active`}
        </Text>
      </View>
    );

    if (activeSubTab === 'posts') {
      if (discoverableShares.length === 0) {
        listChildren.push(
          <View key="empty" style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={32} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyText}>{showMine ? "You haven't shared anything yet" : 'Nothing shared yet'}</Text>
            <Text style={styles.emptyHint}>Tap the + button to share food or items</Text>
          </View>
        );
      } else {
        discoverableShares.forEach(item => listChildren.push(
          <FoodCard key={item._id} item={item} type="share" user={user} getTimeAgo={getTimeAgo} handleClaim={handleClaim} handleOffer={handleOffer} handleViewOffers={handleViewOffers} handleViewDetail={handleViewDetail} handleMarkOutOfStock={handleMarkOutOfStock} />
        ));
      }
    } else {
      if (discoverableRequests.length === 0) {
        listChildren.push(
          <View key="empty" style={styles.emptyState}>
            <Ionicons name="hand-left-outline" size={32} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyText}>{showMine ? "You haven't requested anything yet" : 'No requests yet'}</Text>
            <Text style={styles.emptyHint}>Tap the + button to ask your neighbours</Text>
          </View>
        );
      } else {
        discoverableRequests.forEach(item => listChildren.push(
          <FoodCard key={item._id} item={item} type="request" user={user} getTimeAgo={getTimeAgo} handleClaim={handleClaim} handleOffer={handleOffer} handleViewOffers={handleViewOffers} handleViewDetail={handleViewDetail} handleMarkOutOfStock={handleMarkOutOfStock} />
        ));
      }
    }

    listChildren.push(<View key="spacer" style={{ height: 24 }} />);
  }

  return (
    <SwipeWrapper>
    <View style={styles.container}>
      <View style={styles.bg}>
        <Animated.View style={[styles.orb, styles.orb1, { transform: [{ translateY: orb1Y }] }]} />
        <Animated.View style={[styles.orb, styles.orb2, { transform: [{ translateY: orb2Y }] }]} />
      </View>

      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              top: insets.top + 10,
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            },
          ]}
        >
          <Ionicons
            name={toast.type === 'error' ? 'close-circle' : 'checkmark-circle'}
            size={18}
            color={toast.type === 'error' ? '#ff4757' : '#2ed573'}
          />
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      )}

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={stickyIndices}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f5576c" />}
        >
          {listChildren}
        </ScrollView>
      </SafeAreaView>

      {/* Center-bottom + FAB — context aware */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => setModalType(activeSubTab === 'posts' ? 'share' : 'request')}
      >
        <LinearGradient
          colors={activeSubTab === 'posts' ? ['#2ed573', '#7bed9f'] : ['#f093fb', '#f5576c']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGrad}
        >
          <Ionicons name="add" size={34} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={!!modalType} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId
                  ? (modalType === 'share' ? '✏️ Edit Post' : '✏️ Edit Request')
                  : (modalType === 'share' ? '🍱 Share Food' : '🙋 Request Food')}
              </Text>
              <TouchableOpacity onPress={() => { setModalType(null); resetForm(); }} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>TITLE</Text>
              <TextInput style={styles.input} placeholder={modalType === 'share' ? 'e.g. Chicken Biryani' : 'e.g. Need breakfast tomorrow'} placeholderTextColor="rgba(255,255,255,0.25)" value={title} onChangeText={setTitle} />

              <Text style={styles.inputLabel}>DESCRIPTION (OPTIONAL)</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Add more details..." placeholderTextColor="rgba(255,255,255,0.25)" value={description} onChangeText={setDescription} multiline numberOfLines={3} />

              {modalType === 'share' && (
                <>
                  <Text style={styles.inputLabel}>PORTIONS AVAILABLE</Text>
                  <TextInput style={styles.input} placeholder="e.g. 4" placeholderTextColor="rgba(255,255,255,0.25)" value={portions} onChangeText={setPortions} keyboardType="numeric" />
                </>
              )}
              {modalType === 'share' && (
  <>
    <Text style={styles.inputLabel}>PHOTO (OPTIONAL)</Text>
    <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
      {image ? (
        <View style={styles.imagePreviewWrap}>
          <Image source={{ uri: image }} style={styles.imagePreview} />
          <TouchableOpacity
            style={styles.removeImage}
            onPress={() => setImage(null)}
          >
            <Ionicons name="close-circle" size={24} color="#ff4757" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.imagePickerEmpty}>
          <Ionicons name="camera-outline" size={32} color="rgba(255,255,255,0.3)" />
          <Text style={styles.imagePickerText}>Tap to add a photo</Text>
          <Text style={styles.imagePickerSub}>Makes your post more appealing!</Text>
        </View>
      )}
    </TouchableOpacity>
  </>
)}

              {modalType === 'request' && (
                <>
                  <Text style={styles.inputLabel}>PREFERENCES (OPTIONAL)</Text>
                  <TextInput style={styles.input} placeholder="e.g. Veg only, no nuts" placeholderTextColor="rgba(255,255,255,0.25)" value={preferences} onChangeText={setPreferences} />
                </>
              )}

              <Text style={styles.inputLabel}>CATEGORY</Text>
              <View style={styles.catGrid}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity key={cat} style={[styles.catChip, category === cat && styles.catChipActive]} onPress={() => setCategory(cat)}>
                    {category === cat && <LinearGradient colors={['#6c63ff', '#f093fb']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />}
                    <Text style={[styles.catChipText, category === cat && styles.catChipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

             <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
  <LinearGradient colors={['#f093fb', '#f5576c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitGrad}>
    {submitting
      ? uploading
        ? <Text style={styles.submitBtnText}>Uploading photo... ☁️</Text>
        : <ActivityIndicator color="#fff" />
      : <Text style={styles.submitBtnText}>{editingId ? 'Save Changes' : (modalType === 'share' ? 'Share Now' : 'Post Request')}</Text>
    }
  </LinearGradient>
</TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
      <Modal visible={offersModal} animationType="slide" presentationStyle="pageSheet">
  <View style={styles.modal}>
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>🙋 Offers received</Text>
        <TouchableOpacity onPress={() => setOffersModal(false)} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>

      {selectedPost && (
        <View style={styles.offerRequestInfo}>
          <Text style={styles.offerRequestTitle}>{selectedPost.title}</Text>
          <Text style={styles.offerRequestSub}>
            {`${postOffers.length} ${postOffers.length === 1 ? 'person' : 'people'} offered to help`}
          </Text>
        </View>
      )}

      {loadingOffers ? (
        <ActivityIndicator color="#6c63ff" style={{ marginTop: 40 }} />
      ) : postOffers.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="hand-left-outline" size={32} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyText}>No offers yet</Text>
        </View>
      ) : (
        <ScrollView style={styles.modalBody}>
          {postOffers.map((offer, i) => (
            <View key={i} style={styles.offerCard}>
              <View style={styles.offerCardHeader}>
                <View style={[styles.offerAvatar, { backgroundColor: offer.user?.avatarColor || '#6c63ff' }]}>
                  <Text style={styles.offerAvatarText}>{offer.user?.initials}</Text>
                </View>
                <View style={styles.offerInfo}>
                  <Text style={styles.offerName}>{offer.user?.name}</Text>
                  <Text style={styles.offerHouse}>{offer.user?.houseNo} · {offer.user?.block}</Text>
                </View>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={() => handleAcceptOffer(offer._id)}
                >
                  <LinearGradient
                    colors={['#6c63ff', '#a78bfa']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.acceptBtnGrad}
                  >
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              {!!offer.description && (
                <View style={styles.offerNoteBox}>
                  <Text style={styles.offerNoteText}>{offer.description}</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  </View>
</Modal>

      {/* Optional note when offering to help */}
      <Modal visible={offerModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.offerModalOverlay}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setOfferModal(false)}
            />
            <View style={styles.offerModalSheet}>
              <Text style={styles.offerModalTitle}>Offer to help</Text>
              <Text style={styles.offerModalSub}>
                Add a note if you like — it is optional. You can also just send your offer.
              </Text>
              <TextInput
                style={styles.offerModalInput}
                placeholder="e.g. I can drop it by this evening around 6pm"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={offerComment}
                onChangeText={setOfferComment}
                multiline
                autoFocus
              />
              <View style={styles.offerModalActions}>
                <TouchableOpacity
                  style={styles.offerModalCancel}
                  onPress={() => setOfferModal(false)}
                  disabled={offerSubmitting}
                >
                  <Text style={styles.offerModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.offerModalSubmit}
                  onPress={submitOffer}
                  disabled={offerSubmitting}
                >
                  <LinearGradient
                    colors={['#f5576c', '#f093fb']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.offerModalSubmitGrad}
                  >
                    {offerSubmitting
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.offerModalSubmitText}>Send offer</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* How many portions to collect */}
      <Modal visible={claimModal} animationType="slide" transparent>
        <View style={styles.offerModalOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setClaimModal(false)}
          />
          <View style={styles.offerModalSheet}>
            <Text style={styles.offerModalTitle}>Collect portions</Text>
            <Text style={styles.offerModalSub}>
              {claimTarget
                ? `${claimTarget.remainingPortions} of ${claimTarget.portions} portion${claimTarget.portions > 1 ? 's' : ''} left`
                : ''}
            </Text>

            <View style={styles.qtyStepperRow}>
              <TouchableOpacity
                style={[styles.qtyStepperBtn, claimQuantity <= 1 && styles.qtyStepperBtnDisabled]}
                onPress={() => setClaimQuantity(q => Math.max(1, q - 1))}
                disabled={claimQuantity <= 1}
              >
                <Ionicons name="remove" size={20} color={claimQuantity <= 1 ? 'rgba(255,255,255,0.2)' : '#fff'} />
              </TouchableOpacity>
              <Text style={styles.qtyStepperValue}>{claimQuantity}</Text>
              <TouchableOpacity
                style={[styles.qtyStepperBtn, claimQuantity >= (claimTarget?.remainingPortions || 1) && styles.qtyStepperBtnDisabled]}
                onPress={() => setClaimQuantity(q => Math.min(claimTarget?.remainingPortions || 1, q + 1))}
                disabled={claimQuantity >= (claimTarget?.remainingPortions || 1)}
              >
                <Ionicons name="add" size={20} color={claimQuantity >= (claimTarget?.remainingPortions || 1) ? 'rgba(255,255,255,0.2)' : '#fff'} />
              </TouchableOpacity>
            </View>

            <View style={styles.offerModalActions}>
              <TouchableOpacity
                style={styles.offerModalCancel}
                onPress={() => setClaimModal(false)}
                disabled={claimSubmitting}
              >
                <Text style={styles.offerModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.offerModalSubmit}
                onPress={submitClaim}
                disabled={claimSubmitting}
              >
                <LinearGradient
                  colors={['#2ed573', '#7bed9f']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.offerModalSubmitGrad}
                >
                  {claimSubmitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.offerModalSubmitText}>{`Collect ${claimQuantity}`}</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Filter & sort */}
      <Modal visible={filterModal} animationType="slide" transparent>
        <View style={styles.offerModalOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setFilterModal(false)}
          />
          <View style={styles.offerModalSheet}>
            <Text style={styles.offerModalTitle}>Filter & Sort</Text>

            <Text style={styles.inputLabel}>AREA</Text>
            <View style={styles.filterChipWrap}>
              {BLOCKS.map(b => (
                <TouchableOpacity
                  key={b}
                  style={[styles.blockChip, blockFilter === b && styles.blockChipActive]}
                  onPress={() => setBlockFilter(b)}
                >
                  <Text style={[styles.blockChipText, blockFilter === b && styles.blockChipTextActive]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>SORT</Text>
            <View style={styles.filterChipWrap}>
              {SORT_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.sortChip, sortBy === opt.key && styles.sortChipActive]}
                  onPress={() => setSortBy(opt.key)}
                >
                  <Text style={[styles.sortChipText, sortBy === opt.key && styles.sortChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.offerModalActions}>
              <TouchableOpacity
                style={styles.offerModalCancel}
                onPress={() => { setBlockFilter('All'); setSortBy('newest'); }}
              >
                <Text style={styles.offerModalCancelText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.offerModalSubmit}
                onPress={() => setFilterModal(false)}
              >
                <LinearGradient
                  colors={['#6c63ff', '#a78bfa']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.offerModalSubmitGrad}
                >
                  <Text style={styles.offerModalSubmitText}>Done</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
<Modal visible={detailModal} animationType="slide" presentationStyle="pageSheet">
  <View style={styles.modal}>
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      
      {/* Header */}
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>
          {detailPost?.type === 'share' ? '🍱 Food Details' : '🙋 Request Details'}
        </Text>
        <TouchableOpacity onPress={() => setDetailModal(false)} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.modalBody}>
        {detailPost && (
          <>
            {/* Photo */}
            {detailPost.photo && (
              <Image
                source={{ uri: detailPost.photo }}
                style={styles.detailImage}
                resizeMode="cover"
              />
            )}

            {/* Title and info */}
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{detailPost.title}</Text>
              <View style={[styles.badge, {
                backgroundColor: detailPost.type === 'share' ? 'rgba(46,213,115,0.15)' : 'rgba(245,87,108,0.15)',
                borderColor: detailPost.type === 'share' ? 'rgba(46,213,115,0.25)' : 'rgba(245,87,108,0.25)',
                alignSelf: 'flex-start', marginTop: 6
              }]}>
                <Text style={[styles.badgeText, { color: detailPost.type === 'share' ? '#2ed573' : '#f5576c' }]}>
                  {detailPost.type === 'share' ? (detailPost.category || 'Food') : 'Request'}
                </Text>
              </View>
            </View>

            {/* Posted by */}
            <View style={styles.detailPostedBy}>
              <View style={[styles.offerAvatar, { backgroundColor: detailPost.postedBy?.avatarColor || '#6c63ff' }]}>
                <Text style={styles.offerAvatarText}>{detailPost.postedBy?.initials}</Text>
              </View>
              <View>
                <Text style={styles.detailPostedName}>{detailPost.postedBy?.name}</Text>
                <Text style={styles.detailPostedHouse}>{detailPost.postedBy?.houseNo}</Text>
              </View>
              <Text style={styles.detailTime}>{getTimeAgo(detailPost.createdAt)}</Text>
            </View>

            {/* Description */}
            {detailPost.description && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Description</Text>
                <Text style={styles.detailDesc}>{detailPost.description}</Text>
              </View>
            )}

            {/* Portions */}
            {detailPost.type === 'share' && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Portions</Text>
                <View style={styles.portionsRow}>
                  <View style={styles.portionBox}>
                    <Text style={styles.portionNum}>{detailPost.portions}</Text>
                    <Text style={styles.portionLbl}>Total</Text>
                  </View>
                  <View style={styles.portionBox}>
                    <Text style={[styles.portionNum, { color: '#2ed573' }]}>{detailPost.remainingPortions}</Text>
                    <Text style={styles.portionLbl}>Remaining</Text>
                  </View>
                  <View style={styles.portionBox}>
                    <Text style={[styles.portionNum, { color: '#f5576c' }]}>
                      {detailPost.portions - detailPost.remainingPortions}
                    </Text>
                    <Text style={styles.portionLbl}>Claimed</Text>
                  </View>
                </View>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, {
                    width: `${((detailPost.portions - detailPost.remainingPortions) / detailPost.portions) * 100}%`
                  }]} />
                </View>
              </View>
            )}

            {/* Claimed by — only visible to poster */}
            {detailPost.type === 'share' &&
              detailPost.postedBy?._id === user?._id &&
              detailPost.claimedBy?.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>
                  {`Claimed by (${detailPost.claimedBy.length})`}
                </Text>
                {detailPost.claimedBy.map((claim, i) => (
                  <View key={i} style={styles.claimRow}>
                    <View style={[styles.claimedAvatar, { backgroundColor: claim.user?.avatarColor || '#6c63ff' }]}>
                      <Text style={styles.claimedAvatarText}>{claim.user?.initials || '?'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.claimName}>{claim.user?.name}</Text>
                      <Text style={styles.claimHouse}>{claim.user?.houseNo}</Text>
                    </View>
                    <View style={styles.claimQtyBadge}>
                      <Text style={styles.claimQtyText}>{`× ${claim.quantity}`}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Preferences for requests */}
            {detailPost.type === 'request' && detailPost.preferences && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Preferences</Text>
                <Text style={styles.detailDesc}>{detailPost.preferences}</Text>
              </View>
            )}

            {/* Offers received — only visible to the poster of a request */}
            {detailPost.type === 'request' &&
              detailPost.postedBy?._id === user?._id && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>
                  {detailPost.offers?.length
                    ? `Help offered (${detailPost.offers.length})`
                    : 'Help offered'}
                </Text>
                {!detailPost.offers?.length ? (
                  <Text style={styles.detailDesc}>No offers yet. You will be notified when someone offers to help.</Text>
                ) : (
                  detailPost.offers.map((offer, i) => (
                    <View key={i} style={[styles.detailOfferRow, offer.isSelected && styles.detailOfferRowSelected]}>
                      <View style={[styles.claimedAvatar, { backgroundColor: offer.user?.avatarColor || '#6c63ff' }]}>
                        <Text style={styles.claimedAvatarText}>{offer.user?.initials || '?'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.claimName}>{offer.user?.name}</Text>
                        <Text style={styles.claimHouse}>{offer.user?.houseNo}{offer.user?.block ? ` · ${offer.user.block}` : ''}</Text>
                        {!!offer.description && (
                          <Text style={styles.detailOfferNote}>{offer.description}</Text>
                        )}
                      </View>
                      {offer.isSelected && (
                        <View style={styles.acceptedBadge}>
                          <Ionicons name="checkmark-circle" size={18} color="#2ed573" />
                          <Text style={styles.acceptedText}>Chosen</Text>
                        </View>
                      )}
                    </View>
                  ))
                )}
                {/* "Choose a helper" only — once accepted, the coordination
                    thread below is already visible, nothing to click */}
                {detailPost.offers?.length > 0 && !detailPost.selectedOffer && (
                  <TouchableOpacity
                    style={styles.detailViewOffersBtn}
                    onPress={() => {
                      setDetailModal(false);
                      handleViewOffers(detailPost);
                    }}
                  >
                    <Text style={styles.detailViewOffersText}>Choose a helper</Text>
                    <Ionicons name="arrow-forward" size={16} color="#6c63ff" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Action button */}
            {detailPost.postedBy?._id !== user?._id && (
              detailPost.type === 'request' && detailPost.selectedOffer ? null : (
                <TouchableOpacity
                  style={styles.detailActionBtn}
                  onPress={() => {
                    setDetailModal(false);
                    if (detailPost.type === 'share') {
                      handleClaim(detailPost);
                    } else {
                      handleOffer(detailPost._id);
                    }
                  }}
                >
                  <LinearGradient
                    colors={detailPost.type === 'share' ? ['#2ed573', '#7bed9f'] : ['#6c63ff', '#a78bfa']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.detailActionGrad}
                  >
                    <Text style={styles.detailActionText}>
                      {detailPost.type === 'share' ? 'Collect' : 'Offer Help'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )
            )}

            {/* Inline coordination thread — always visible once a helper is
                accepted, either as poster or as the accepted helper */}
            {detailPost.type === 'request' && detailPost.selectedOffer &&
              (detailPost.selectedOffer?._id === user?._id || detailPost.postedBy?._id === user?._id) && (() => {
              const t = threads[detailPost._id];
              return (
                <ThreadPanel
                  loading={!t || t.loading}
                  comments={t?.comments || []}
                  currentUserId={user?._id}
                  inputValue={t?.input || ''}
                  onChangeInput={(text) => updateThreadInput(detailPost._id, text)}
                  onSend={() => sendThread(detailPost._id)}
                  sending={!!t?.sending}
                />
              );
            })()}

            {/* Out of stock — only for poster */}
{detailPost.type === 'share' && detailPost.postedBy?._id === user?._id && (
  <TouchableOpacity
    style={styles.outOfStockBtn}
    onPress={() => {
      setDetailModal(false);
      handleMarkOutOfStock(detailPost._id);
    }}
  >
    <Ionicons name="close-circle" size={16} color="#ff4757" />
    <Text style={styles.outOfStockText}>Mark as Out of Stock</Text>
  </TouchableOpacity>
)}

            {/* Edit / Delete — only for the person who posted it */}
            {detailPost.postedBy?._id === user?._id && (
              <View style={styles.ownerActionsRow}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => {
                    setDetailModal(false);
                    handleEditPost(detailPost);
                  }}
                >
                  <Ionicons name="create-outline" size={16} color="#6c63ff" />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => {
                    setDetailModal(false);
                    handleDeletePost(detailPost);
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color="#ff4757" />
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
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
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  orb: { position: 'absolute', borderRadius: 999 },
  orb1: { width: 300, height: 300, backgroundColor: 'rgba(52,211,153,0.20)', top: -60, right: -80 },
  orb2: { width: 250, height: 250, backgroundColor: 'rgba(45,212,191,0.13)', top: 300, left: -60 },
  header: { padding: 16 },
  headerGrad: { borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  actionBtn: { flex: 1, borderRadius: 16, padding: 16, gap: 8, borderWidth: 1 },
  requestBtn: { backgroundColor: 'rgba(245,87,108,0.08)', borderColor: 'rgba(245,87,108,0.2)' },
  shareBtn: { backgroundColor: 'rgba(46,213,115,0.08)', borderColor: 'rgba(46,213,115,0.2)' },
  actionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  actionSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#07231f',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  sectionCount: { fontSize: 12, color: '#6c63ff', fontWeight: '600' },
  acceptedSectionTitle: { color: '#2ed573' },
  card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', flexDirection: 'row' },
  cardAccent: { width: 3 },
  cardContent: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 3 },
  cardFlat: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  progressBg: { height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#6c63ff', borderRadius: 2 },
  cardDesc: { fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 20, marginBottom: 10 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 },
  countText: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  dot: { fontSize: 11, color: 'rgba(255,255,255,0.2)' },
  claimBtn: { backgroundColor: '#2ed573', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  claimBtnText: { color: '#000', fontSize: 12, fontWeight: '700' },
  offerBtn: { borderWidth: 1.5, borderColor: 'rgba(108,99,255,0.5)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  offerBtnText: { color: '#a78bfa', fontSize: 12, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.25)' },
  emptyHint: { fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 2, textAlign: 'center' },

  // Sub-tab navigation bar
  subTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 6,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 26,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    width: 200,
    position: 'relative',
  },
  segmentIndicator: {
    position: 'absolute', top: 4, left: 4, bottom: 4,
    backgroundColor: '#f5576c', borderRadius: 22,
  },
  segmentBtn: {
    width: 96,
    paddingVertical: 11,
    borderRadius: 22,
    alignItems: 'center',
  },
  segmentText: { fontSize: 15, fontWeight: '800', color: 'rgba(255,255,255,0.45)' },
  segmentTextActive: { color: '#fff' },
  myPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 24,
    backgroundColor: 'rgba(245,87,108,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,87,108,0.3)',
  },
  myPillActive: {
    backgroundColor: '#f5576c',
    borderColor: '#f5576c',
  },
  myPillText: { fontSize: 15, fontWeight: '800', color: '#f5576c' },
  myPillTextActive: { color: '#fff' },

  // Filter button — opens the Filter & Sort sheet
  filterBtnRow: { paddingHorizontal: 16, marginBottom: 10 },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  filterBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  filterBtnDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f5576c', marginLeft: 2 },

  // Filter & Sort sheet — area + sort chips
  filterChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  blockChip: {
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  blockChipActive: { backgroundColor: '#6c63ff', borderColor: '#6c63ff' },
  blockChipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  blockChipTextActive: { color: '#fff' },
  sortChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  sortChipActive: { backgroundColor: 'rgba(245,87,108,0.15)', borderColor: 'rgba(245,87,108,0.4)' },
  sortChipText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  sortChipTextActive: { color: '#f5576c' },

  // Toast — non-blocking success feedback
  toast: {
    position: 'absolute', left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(20,20,28,0.97)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16,
    zIndex: 999, elevation: 10,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },

  // Center-bottom FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    shadowColor: '#f5576c',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  fabGrad: {
    flex: 1,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modal: { flex: 1, backgroundColor: '#0a2a25' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 20 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 13, fontSize: 14, color: '#fff' },
  textArea: { height: 80, textAlignVertical: 'top' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  catChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden' },
  catChipActive: { borderColor: 'transparent' },
  catChipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  catChipTextActive: { color: '#fff' },
  submitBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 24, marginBottom: 40 },
  submitGrad: { padding: 16, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  detailImage: {
  width: '100%', height: 200,
  borderRadius: 16, marginBottom: 16,
},
detailHeader: { marginBottom: 14 },
detailTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
detailPostedBy: {
  flexDirection: 'row', alignItems: 'center', gap: 10,
  backgroundColor: 'rgba(255,255,255,0.04)',
  borderRadius: 14, padding: 12, marginBottom: 16,
},
detailPostedName: { fontSize: 14, fontWeight: '600', color: '#fff' },
detailPostedHouse: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
detailTime: { fontSize: 11, color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' },
detailSection: {
  marginBottom: 16,
  backgroundColor: 'rgba(255,255,255,0.04)',
  borderRadius: 14, padding: 14,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
},
detailSectionTitle: {
  fontSize: 11, fontWeight: '700',
  color: 'rgba(255,255,255,0.4)',
  textTransform: 'uppercase', letterSpacing: 1,
  marginBottom: 10,
},
detailDesc: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 20 },
portionsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
portionBox: {
  flex: 1, alignItems: 'center',
  backgroundColor: 'rgba(255,255,255,0.05)',
  borderRadius: 12, padding: 12,
},
portionNum: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 4 },
portionLbl: { fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: '600', textTransform: 'uppercase' },
claimRow: {
  flexDirection: 'row', alignItems: 'center', gap: 10,
  paddingVertical: 10,
  borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
},
claimName: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 2 },
claimHouse: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
claimQtyBadge: {
  backgroundColor: 'rgba(46,213,115,0.15)',
  borderWidth: 1, borderColor: 'rgba(46,213,115,0.25)',
  paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
},
claimQtyText: { fontSize: 12, color: '#2ed573', fontWeight: '700' },
detailActionBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8, marginBottom: 40 },
detailActionGrad: { padding: 16, alignItems: 'center' },
detailActionText: { color: '#fff', fontSize: 15, fontWeight: '700' },

coordinateBtn: {
  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  backgroundColor: '#2ed573', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
},
coordinateBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
viewOffersBtn: {
  flexDirection: 'row', alignItems: 'center', gap: 5,
  backgroundColor: '#6c63ff', paddingHorizontal: 12,
  paddingVertical: 7, borderRadius: 20,
},
viewOffersBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
offerRequestInfo: {
  padding: 16, paddingBottom: 8,
  borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
},
offerRequestTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 4 },
offerRequestSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
offerCard: {
  flexDirection: 'row', alignItems: 'center', gap: 12,
  backgroundColor: 'rgba(255,255,255,0.04)',
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  borderRadius: 16, padding: 14, marginBottom: 10,
},
offerCardSelected: {
  borderColor: 'rgba(46,213,115,0.3)',
  backgroundColor: 'rgba(46,213,115,0.05)',
},
offerAvatar: {
  width: 46, height: 46, borderRadius: 13,
  alignItems: 'center', justifyContent: 'center',
},
claimedSection: {
  marginTop: 8,
  marginBottom: 8,
  padding: 10,
  backgroundColor: 'rgba(46,213,115,0.05)',
  borderRadius: 10,
  borderWidth: 1,
  borderColor: 'rgba(46,213,115,0.15)',
},
claimedLabel: {
  fontSize: 10,
  color: '#2ed573',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 8,
},
claimedList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
claimedItem: {
  flexDirection: 'row', alignItems: 'center', gap: 5,
  backgroundColor: 'rgba(255,255,255,0.05)',
  borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
},
claimedAvatar: {
  width: 20, height: 20, borderRadius: 6,
  alignItems: 'center', justifyContent: 'center',
},
claimedAvatarText: { fontSize: 8, fontWeight: '700', color: '#fff' },
claimedName: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
claimedQty: { fontSize: 11, color: '#2ed573', fontWeight: '700' },
offerAvatarText: { fontSize: 15, fontWeight: '700', color: '#fff' },
offerInfo: { flex: 1 },
offerName: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 2 },
offerHouse: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 },
offerDesc: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' },
offerTime: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
acceptBtn: { borderRadius: 10, overflow: 'hidden' },
acceptBtnGrad: { paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
acceptBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
acceptedBadge: { alignItems: 'center', gap: 3 },
acceptedText: { fontSize: 10, color: '#2ed573', fontWeight: '600' },

  imagePicker: {
  borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
  borderStyle: 'dashed', borderRadius: 16,
  overflow: 'hidden', marginBottom: 4,
},
cardImage: {
  width: '100%',
  height: 200,
  borderRadius: 14,
  marginBottom: 12,
},
skeletonLine: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 6 },
imagePickerEmpty: {
  alignItems: 'center', justifyContent: 'center',
  padding: 30, gap: 8,
},
imagePickerText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
imagePickerSub: { fontSize: 11, color: 'rgba(255,255,255,0.2)' },
imagePreviewWrap: { position: 'relative' },
imagePreview: { width: '100%', height: 200, borderRadius: 14 },
removeImage: {
  position: 'absolute', top: 8, right: 8,
  backgroundColor: 'rgba(0,0,0,0.5)',
  borderRadius: 12,
},
filterRow: {
  flexDirection: 'row', gap: 10,
  paddingHorizontal: 16, marginBottom: 8,
},
filterTab: {
  flex: 1, flexDirection: 'row', alignItems: 'center',
  justifyContent: 'center', gap: 6,
  paddingVertical: 10, borderRadius: 20,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  backgroundColor: 'rgba(255,255,255,0.04)',
  overflow: 'hidden',
},
filterTabActive: { borderColor: 'transparent' },
filterTabText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
filterTabTextActive: { color: '#fff' },
filterBadge: {
  backgroundColor: 'rgba(255,255,255,0.08)',
  paddingHorizontal: 6, paddingVertical: 2,
  borderRadius: 10,
},
filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
filterBadgeText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
filterBadgeTextActive: { color: '#fff' },
outOfStockBtn: {
  flexDirection: 'row', alignItems: 'center', gap: 4,
  backgroundColor: 'rgba(255,71,87,0.12)',
  borderWidth: 1, borderColor: 'rgba(255,71,87,0.25)',
  paddingHorizontal: 10, paddingVertical: 6,
  borderRadius: 20,
},
outOfStockBtn: {
  flexDirection: 'row', alignItems: 'center',
  justifyContent: 'center', gap: 8,
  backgroundColor: 'rgba(255,71,87,0.12)',
  borderWidth: 1, borderColor: 'rgba(255,71,87,0.25)',
  borderRadius: 14, padding: 14,
  marginTop: 10, marginBottom: 40,
},
outOfStockText: { fontSize: 14, color: '#ff4757', fontWeight: '700' },

// Owner actions — edit / delete (shown to whoever posted the item)
ownerActionsRow: { flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 40 },
editBtn: {
  flex: 1, flexDirection: 'row', alignItems: 'center',
  justifyContent: 'center', gap: 8,
  backgroundColor: 'rgba(108,99,255,0.12)',
  borderWidth: 1, borderColor: 'rgba(108,99,255,0.25)',
  borderRadius: 14, padding: 14,
},
editBtnText: { fontSize: 14, color: '#6c63ff', fontWeight: '700' },
deleteBtn: {
  flex: 1, flexDirection: 'row', alignItems: 'center',
  justifyContent: 'center', gap: 8,
  backgroundColor: 'rgba(255,71,87,0.12)',
  borderWidth: 1, borderColor: 'rgba(255,71,87,0.25)',
  borderRadius: 14, padding: 14,
},
deleteBtnText: { fontSize: 14, color: '#ff4757', fontWeight: '700' },

// Offer card (pre-accept list) + optional note
offerCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
offerNoteBox: {
  marginTop: 10, marginLeft: 58,
  backgroundColor: 'rgba(255,255,255,0.04)',
  borderRadius: 12, padding: 10,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
},
offerNoteText: { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 18 },

// Inline coordination thread — expands within a card / the detail modal
// (Instagram/Messenger-style comment box, not a separate screen)
threadPanel: {
  marginTop: 10,
  backgroundColor: 'rgba(255,255,255,0.03)',
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  borderRadius: 14, overflow: 'hidden',
},
threadPanelScroll: { maxHeight: 220, paddingHorizontal: 12 },
threadHint: {
  textAlign: 'center', color: 'rgba(255,255,255,0.35)',
  fontSize: 13, paddingVertical: 20,
},
threadRow: { flexDirection: 'row', marginBottom: 8 },
threadRowMine: { justifyContent: 'flex-end' },
threadRowOther: { justifyContent: 'flex-start' },
threadBubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
threadBubbleMine: { backgroundColor: '#6c63ff', borderBottomRightRadius: 4 },
threadBubbleOther: {
  backgroundColor: 'rgba(255,255,255,0.08)', borderBottomLeftRadius: 4,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
},
threadAuthor: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '700', marginBottom: 2 },
threadText: { fontSize: 14, color: '#fff', lineHeight: 19 },
threadPanelInputRow: {
  flexDirection: 'row', alignItems: 'flex-end', gap: 8,
  padding: 10,
  borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
  backgroundColor: 'rgba(255,255,255,0.02)',
},
threadPanelInput: {
  flex: 1, maxHeight: 90,
  backgroundColor: 'rgba(255,255,255,0.06)',
  borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9,
  color: '#fff', fontSize: 13,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
},
threadPanelSendBtn: {
  width: 38, height: 38, borderRadius: 19,
  backgroundColor: '#6c63ff',
  alignItems: 'center', justifyContent: 'center',
},

// Offer note modal (optional comment when offering help)
offerModalOverlay: {
  flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
  justifyContent: 'flex-end',
},
offerModalSheet: {
  backgroundColor: '#1a1a2e',
  borderTopLeftRadius: 24, borderTopRightRadius: 24,
  padding: 24, paddingBottom: 32,
  borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
},
offerModalTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
offerModalSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 16 },
offerModalInput: {
  minHeight: 90, maxHeight: 160,
  backgroundColor: 'rgba(255,255,255,0.05)',
  borderRadius: 14, padding: 14,
  color: '#fff', fontSize: 15, textAlignVertical: 'top',
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  marginBottom: 18,
},
qtyStepperRow: {
  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24,
  marginBottom: 22,
},
qtyStepperBtn: {
  width: 44, height: 44, borderRadius: 22,
  backgroundColor: 'rgba(255,255,255,0.08)',
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  alignItems: 'center', justifyContent: 'center',
},
qtyStepperBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' },
qtyStepperValue: { fontSize: 28, fontWeight: '800', color: '#fff', minWidth: 40, textAlign: 'center' },
offerModalActions: { flexDirection: 'row', gap: 12 },
offerModalCancel: {
  flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
  backgroundColor: 'rgba(255,255,255,0.06)',
},
offerModalCancelText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '700' },
offerModalSubmit: { flex: 2, borderRadius: 14, overflow: 'hidden' },
offerModalSubmitGrad: { paddingVertical: 14, alignItems: 'center' },
offerModalSubmitText: { color: '#fff', fontSize: 15, fontWeight: '800' },

// Offers shown inside the request detail modal
detailOfferRow: {
  flexDirection: 'row', alignItems: 'flex-start', gap: 12,
  backgroundColor: 'rgba(255,255,255,0.04)',
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  borderRadius: 14, padding: 12, marginBottom: 8,
},
detailOfferRowSelected: {
  borderColor: 'rgba(46,213,115,0.3)',
  backgroundColor: 'rgba(46,213,115,0.05)',
},
detailOfferNote: {
  fontSize: 13, color: 'rgba(255,255,255,0.7)',
  marginTop: 6, lineHeight: 18,
},
detailViewOffersBtn: {
  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  marginTop: 6, paddingVertical: 12, borderRadius: 12,
  backgroundColor: 'rgba(108,99,255,0.12)',
  borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)',
},
detailViewOffersText: { color: '#6c63ff', fontSize: 14, fontWeight: '700' }

});