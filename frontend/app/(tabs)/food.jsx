import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import SwipeWrapper from '../../components/SwipeWrapper';
import { io } from 'socket.io-client';
import { BASE_URL } from '../../constants/config';



import { getFoodPosts, createFoodPost, updateFoodPost, deleteFoodPost, claimFood, offerFood, uploadImage, getFoodOffers, acceptOffer, markFoodOutOfStock, commentOnOffer } from '../../services/api';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Alert, Animated, Dimensions, Image,
  KeyboardAvoidingView, Platform, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');
const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Produce', 'Item'];

 const FoodCard = ({ item, type, user, getTimeAgo, handleClaim, handleOffer, handleViewOffers, handleViewDetail, handleMarkOutOfStock }) => (
  <TouchableOpacity onPress={() => handleViewDetail(item)} activeOpacity={0.85}>
    <View style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: type === 'share' ? '#2ed573' : '#f5576c' }]} />
      <View style={styles.cardContent}>

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

        {/* Photo */}
        {item.photo ? (
          <Image source={{ uri: item.photo }} style={styles.cardImage} resizeMode="cover" />
        ) : null}

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
              // A helper has already been chosen for this request.
              // If it's ME, give me a way into the coordination thread.
              // If it's someone else, offers are closed — nothing to show.
              item.selectedOffer?._id === user?._id ? (
                <TouchableOpacity
                  style={styles.chatHelperBtn}
                  onPress={() => handleViewOffers(item)}
                >
                  <Ionicons name="chatbubble-ellipses" size={13} color="#fff" />
                  <Text style={styles.viewOffersBtnText}>
                    {'Chat with ' + (item.postedBy?.name || 'requester')}
                  </Text>
                </TouchableOpacity>
              ) : null
            ) : (
              <TouchableOpacity
                style={type === 'share' ? styles.claimBtn : styles.offerBtn}
                onPress={() => type === 'share' ? handleClaim(item._id) : handleOffer(item._id)}
              >
                <Text style={type === 'share' ? styles.claimBtnText : styles.offerBtnText}>
                  {type === 'share' ? 'Collect' : 'Offer help'}
                </Text>
              </TouchableOpacity>
            )
          ) : null}

          {/* Poster of a request: chat with chosen helper, or view pending offers */}
          {type === 'request' && item.postedBy?._id === user?._id && item.selectedOffer ? (
            <TouchableOpacity
              style={styles.chatHelperBtn}
              onPress={() => handleViewOffers(item)}
            >
              <Ionicons name="chatbubble-ellipses" size={13} color="#fff" />
              <Text style={styles.viewOffersBtnText}>
                {'Chat with ' + (item.selectedOffer?.name || 'helper')}
              </Text>
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
    </View>
  </TouchableOpacity>
);

export default function FoodScreen() {
  const { user } = useAuth();
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
// Live coordination thread input
const [threadInput, setThreadInput] = useState('');
const [threadSending, setThreadSending] = useState(false);
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
    // If we're viewing this request's offers, refresh the modal too — keep
    // postOffers in sync with selectedPost so the thread doesn't get stuck
    // showing the stale "pending offers" list after acceptance.
    setSelectedPost(prev => {
      if (prev && prev._id === updatedPost._id) {
        setPostOffers(updatedPost.offers || []);
        return updatedPost;
      }
      return prev;
    });
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
    setSelectedPost(prev => {
      if (prev && prev._id === postId) {
        setPostOffers(updatedPost.offers || []);
        return updatedPost;
      }
      return prev;
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
      Alert.alert('Success', 'Changes saved!');
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
      Alert.alert('Success', modalType === 'share' ? 'Food post shared!' : 'Request posted!');
    }
    setModalType(null);
    resetForm();
    fetchFoodPosts();
  } catch (error) {
    Alert.alert('Error', error.response?.data?.message || 'Something went wrong');
  } finally {
    setSubmitting(false);
  }
};

const handleDeletePost = (post) => {
  // A helper who already accepted (and hasn't marked it fulfilled yet) is
  // mid-coordination — make sure the poster knows deleting cuts that off.
  const acceptedOffer = post.offers?.find(o => o.isSelected);
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
          } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'Could not delete');
          }
        }
      }
    ]
  );
};

  const handleClaim = async (postId) => {
    try {
      await claimFood(postId, { quantity: 1 });
      Alert.alert('Success', 'Claimed successfully!');
      fetchFoodPosts();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Could not claim');
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
      Alert.alert('Success', 'Offer sent!');
      fetchFoodPosts();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Could not send offer');
    } finally {
      setOfferSubmitting(false);
    }
  };

  // Post a message into the accepted offer's live coordination thread
  const sendThreadComment = async () => {
    const text = threadInput.trim();
    if (!text || !selectedPost) return;
    const acceptedOffer = (postOffers || []).find(o => o.isSelected) || postOffers[0];
    if (!acceptedOffer?._id) return;
    setThreadSending(true);
    try {
      const res = await commentOnOffer(selectedPost._id, acceptedOffer._id, text);
      const updated = res.data.post;
      setSelectedPost(updated);
      setPostOffers(updated.offers || []);
      setThreadInput('');
    } catch (error) {
      // Keep full detail in the console for troubleshooting; show the user
      // a clean message (the server's reason when it gives one).
      console.log('Error sending thread comment:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        postId: selectedPost?._id,
        offerId: acceptedOffer?._id,
      });
      Alert.alert('Error', error.response?.data?.message || 'Could not send message. Please try again.');
    } finally {
      setThreadSending(false);
    }
  };
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
            Alert.alert('Success', 'Offer accepted! You can now coordinate directly.');
            // Reload offers so the modal switches to the live coordination thread
            try {
              const res = await getFoodOffers(selectedPost._id);
              setPostOffers(res.data.offers);
            } catch (e) {}
            fetchFoodPosts();
          } catch (error) {
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
            Alert.alert('Done', 'Post marked as out of stock');
            fetchFoodPosts();
          } catch (error) {
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
  const visibleRequests = showMine ? requestPosts.filter(mine) : requestPosts;

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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f5576c" />}
        >
          {/* Header */}
          <View style={styles.header}>
            <LinearGradient colors={['rgba(240,147,251,0.3)', 'rgba(245,87,108,0.3)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGrad}>
              <Text style={styles.headerTitle}>MarketPlace 🍱</Text>
              <Text style={styles.headerSub}>Share and request food, products and lot more</Text>
            </LinearGradient>
          </View>

          {/* Sub-tab navigation bar: segmented toggle + My pill */}
          <View style={styles.subTabBar}>
            <View style={styles.segment}>
              <TouchableOpacity
                style={[styles.segmentBtn, activeSubTab === 'posts' && styles.segmentBtnActive]}
                onPress={() => { setActiveSubTab('posts'); setShowMine(false); }}
                activeOpacity={0.85}
              >
                <Text style={[styles.segmentText, activeSubTab === 'posts' && styles.segmentTextActive]}>Posts</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, activeSubTab === 'requests' && styles.segmentBtnActive]}
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

          {loading ? (
  <ActivityIndicator color="#f5576c" style={{ marginTop: 40 }} />
) : (
  <>
<View style={styles.sectionHeader}>
  <Text style={styles.sectionTitle}>
    {activeSubTab === 'posts'
      ? (showMine ? 'My shared posts' : 'Available to claim')
      : (showMine ? 'My requests' : 'Open requests')}
  </Text>
  <Text style={styles.sectionCount}>
    {`${activeSubTab === 'posts' ? visibleShares.length : visibleRequests.length} active`}
  </Text>
</View>

{activeSubTab === 'posts' ? (
  visibleShares.length === 0 ? (
    <View style={styles.emptyState}>
      <Ionicons name="restaurant-outline" size={32} color="rgba(255,255,255,0.2)" />
      <Text style={styles.emptyText}>{showMine ? "You haven't shared anything yet" : 'Nothing shared yet'}</Text>
      <Text style={styles.emptyHint}>Tap the + button to share food or items</Text>
    </View>
  ) : visibleShares.map(item => (
    <FoodCard key={item._id} item={item} type="share" user={user} getTimeAgo={getTimeAgo} handleClaim={handleClaim} handleOffer={handleOffer} handleViewOffers={handleViewOffers} handleViewDetail={handleViewDetail} handleMarkOutOfStock={handleMarkOutOfStock} />
  ))
) : (
  visibleRequests.length === 0 ? (
    <View style={styles.emptyState}>
      <Ionicons name="hand-left-outline" size={32} color="rgba(255,255,255,0.2)" />
      <Text style={styles.emptyText}>{showMine ? "You haven't requested anything yet" : 'No requests yet'}</Text>
      <Text style={styles.emptyHint}>Tap the + button to ask your neighbours</Text>
    </View>
  ) : visibleRequests.map(item => (
    <FoodCard key={item._id} item={item} type="request" user={user} getTimeAgo={getTimeAgo} handleClaim={handleClaim} handleOffer={handleOffer} handleViewOffers={handleViewOffers} handleViewDetail={handleViewDetail} handleMarkOutOfStock={handleMarkOutOfStock} />
  ))
)}
  </>
)}         
 <View style={{ height: 24 }} />
          

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

      {selectedPost && (() => {
        const accepted = (postOffers || []).find(o => o.isSelected);
        // Show the OTHER party in the conversation, not myself — I might be
        // viewing this as the poster (other party = helper) or as the
        // accepted helper (other party = the poster).
        const iAmPoster = (selectedPost.postedBy?._id || selectedPost.postedBy) === user?._id;
        const otherParty = accepted ? (iAmPoster ? accepted.user : selectedPost.postedBy) : null;
        return (
          <View style={styles.offerRequestInfo}>
            <Text style={styles.offerRequestTitle}>{selectedPost.title}</Text>
            <Text style={styles.offerRequestSub}>
              {accepted
                ? `Coordinating with ${otherParty?.name || 'the other person'}`
                : `${postOffers.length} ${postOffers.length === 1 ? 'person' : 'people'} offered to help`}
            </Text>
          </View>
        );
      })()}

      {loadingOffers ? (
        <ActivityIndicator color="#6c63ff" style={{ marginTop: 40 }} />
      ) : postOffers.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="hand-left-outline" size={32} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyText}>No offers yet</Text>
        </View>
      ) : ((postOffers || []).find(o => o.isSelected)) ? (
        (() => {
          const accepted = (postOffers || []).find(o => o.isSelected);
          const comments = accepted?.comments || [];
          const iAmPoster = (selectedPost?.postedBy?._id || selectedPost?.postedBy) === user?._id;
          const otherParty = iAmPoster ? accepted.user : selectedPost?.postedBy;
          return (
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={90}
            >
              <View style={styles.threadHelperCard}>
                <View style={[styles.offerAvatar, { backgroundColor: otherParty?.avatarColor || '#6c63ff' }]}>
                  <Text style={styles.offerAvatarText}>{otherParty?.initials}</Text>
                </View>
                <View style={styles.offerInfo}>
                  <Text style={styles.offerName}>{otherParty?.name}</Text>
                  <Text style={styles.offerHouse}>{otherParty?.houseNo}{otherParty?.block ? ` · ${otherParty.block}` : ''}</Text>
                </View>
                <View style={styles.acceptedBadge}>
                  <Ionicons name="checkmark-circle" size={18} color="#2ed573" />
                  <Text style={styles.acceptedText}>{iAmPoster ? 'Chosen' : 'Requester'}</Text>
                </View>
              </View>

              <ScrollView style={styles.threadBody} contentContainerStyle={{ paddingVertical: 12 }}>
                {comments.length === 0 ? (
                  <Text style={styles.threadHint}>Say hello to coordinate the pickup 👋</Text>
                ) : (
                  comments.map((c, i) => {
                    const cid = c.user?._id || c.user;
                    const mine = cid && user?._id && cid.toString() === user._id.toString();
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

              <View style={styles.threadInputBar}>
                <TextInput
                  style={styles.threadTextInput}
                  placeholder="Type a message..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={threadInput}
                  onChangeText={setThreadInput}
                  multiline
                />
                <TouchableOpacity
                  style={styles.threadSendBtn}
                  onPress={sendThreadComment}
                  disabled={threadSending || !threadInput.trim()}
                >
                  {threadSending
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Ionicons name="send" size={18} color="#fff" />}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          );
        })()
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
                {detailPost.offers?.length > 0 && (
                  <TouchableOpacity
                    style={styles.detailViewOffersBtn}
                    onPress={() => {
                      setDetailModal(false);
                      handleViewOffers(detailPost);
                    }}
                  >
                    {detailPost.selectedOffer ? (
                      <>
                        <Ionicons name="chatbubble-ellipses" size={16} color="#6c63ff" />
                        <Text style={styles.detailViewOffersText}>Message helper</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.detailViewOffersText}>Choose a helper</Text>
                        <Ionicons name="arrow-forward" size={16} color="#6c63ff" />
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Action button */}
            {detailPost.postedBy?._id !== user?._id && (
              detailPost.type === 'request' && detailPost.selectedOffer ? (
                // Offers are closed. If I'm the chosen helper, let me into the thread.
                detailPost.selectedOffer?._id === user?._id ? (
                  <TouchableOpacity
                    style={styles.detailActionBtn}
                    onPress={() => {
                      setDetailModal(false);
                      handleViewOffers(detailPost);
                    }}
                  >
                    <LinearGradient
                      colors={['#6c63ff', '#a78bfa']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.detailActionGrad}
                    >
                      <Text style={styles.detailActionText}>
                        {'Chat with ' + (detailPost.postedBy?.name || 'requester')}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : null
              ) : (
                <TouchableOpacity
                  style={styles.detailActionBtn}
                  onPress={() => {
                    setDetailModal(false);
                    if (detailPost.type === 'share') {
                      handleClaim(detailPost._id);
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
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  sectionCount: { fontSize: 12, color: '#6c63ff', fontWeight: '600' },
  card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', flexDirection: 'row' },
  cardAccent: { width: 3 },
  cardContent: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 2 },
  cardFlat: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  progressBg: { height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#6c63ff', borderRadius: 2 },
  cardDesc: { fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 18, marginBottom: 10 },
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
  },
  segmentBtn: {
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 22,
  },
  segmentBtnActive: {
    backgroundColor: '#f5576c',
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

  chatHelperBtn: {
  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  backgroundColor: '#2ed573', borderRadius: 12, paddingVertical: 10, marginTop: 8,
},
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
  height: 160,
  borderRadius: 12,
  marginBottom: 10,
},
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

// Live coordination thread (post-accept)
threadHelperCard: {
  flexDirection: 'row', alignItems: 'center', gap: 12,
  marginHorizontal: 20, marginTop: 4, marginBottom: 8,
  backgroundColor: 'rgba(46,213,115,0.05)',
  borderWidth: 1, borderColor: 'rgba(46,213,115,0.25)',
  borderRadius: 16, padding: 12,
},
threadBody: { flex: 1, paddingHorizontal: 20 },
threadHint: {
  textAlign: 'center', color: 'rgba(255,255,255,0.35)',
  fontSize: 13, marginTop: 30,
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
threadInputBar: {
  flexDirection: 'row', alignItems: 'flex-end', gap: 10,
  paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 16,
  borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
},
threadTextInput: {
  flex: 1, maxHeight: 100,
  backgroundColor: 'rgba(255,255,255,0.06)',
  borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
  color: '#fff', fontSize: 14,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
},
threadSendBtn: {
  width: 44, height: 44, borderRadius: 22,
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