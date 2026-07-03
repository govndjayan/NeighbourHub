import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import SwipeWrapper from '../../components/SwipeWrapper';
import { io } from 'socket.io-client';
import { BASE_URL } from '../../constants/config';



import { getFoodPosts, createFoodPost, claimFood, offerFood, uploadImage, getFoodOffers, acceptOffer, markFoodOutOfStock} from '../../services/api';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Alert, Animated, Dimensions, Image
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
              {type === 'share' ? item.category : 'Request'}
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

        {/* Count row */}
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

        {/* Footer actions */}
        <View style={styles.cardFooter}>
          {/* Claim / Offer help — only for other users */}
          {item.postedBy?._id !== user?._id ? (
            <TouchableOpacity
              style={type === 'share' ? styles.claimBtn : styles.offerBtn}
              onPress={() => type === 'share' ? handleClaim(item._id) : handleOffer(item._id)}
            >
              <Text style={type === 'share' ? styles.claimBtnText : styles.offerBtnText}>
                {type === 'share' ? 'Claim' : 'Offer help'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Out of stock — only for poster on share posts */}


          {/* View offers — only for poster on request posts with offers */}
          {type === 'request' && item.postedBy?._id === user?._id && item.offers?.length > 0 ? (
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
const socketRef = useRef(null);
const [detailModal, setDetailModal] = useState(false);
const [detailPost, setDetailPost] = useState(null);

const [foodFilter, setFoodFilter] = useState('all');
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
    setRequestPosts(prev =>
      prev.map(post => post._id === updatedPost._id ? updatedPost : post)
    );
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
};

const handleSubmit = async () => {
  if (!title || !category) {
    Alert.alert('Error', 'Please fill in title and category');
    return;
  }
  setSubmitting(true);
      let photoUrl = null;

  try {


    // Upload image to Cloudinary if selected
if (image) {
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
    console.log('CREATING POST WITH PHOTO:', photoUrl);
    await createFoodPost({
      type: modalType,
      title,
      description,
      category,
      portions: parseInt(portions),
      preferences,
      photo: photoUrl,
      availableTill: new Date(Date.now() + 8 * 60 * 60 * 1000),
    });

    Alert.alert('Success', modalType === 'share' ? 'Food post shared!' : 'Request posted!');
    setModalType(null);
    resetForm();
    fetchFoodPosts();
  } catch (error) {
    Alert.alert('Error', error.response?.data?.message || 'Something went wrong');
  } finally {
    setSubmitting(false);
  }
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

  const handleOffer = async (postId) => {
    try {
      await offerFood(postId, { description: 'I can help!', portions: 1 });
      Alert.alert('Success', 'Offer sent!');
      fetchFoodPosts();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Could not send offer');
    }
  };
  const handleViewDetail = (post) => {
  setDetailPost(post);
  setDetailModal(true);
};
  const handlePickImage = async () => {
  Alert.alert(
    'Add Photo',
    'Choose an option',
    [
      {
        text: 'Take Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Camera permission is required');
            return;
          }
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
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Gallery permission is required');
            return;
          }
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
            Alert.alert('Success', 'Offer accepted! The helper will be notified.');
            setOffersModal(false);
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

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, styles.requestBtn]} onPress={() => setModalType('request')} activeOpacity={0.8}>
              <View style={styles.actionIcon}><Ionicons name="hand-left" size={22} color="#f5576c" /></View>
              <Text style={styles.actionTitle}>Request</Text>
              <Text style={styles.actionSub}>Ask neighbours</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.shareBtn]} onPress={() => setModalType('share')} activeOpacity={0.8}>
              <View style={styles.actionIcon}><Ionicons name="heart-sharp" size={22} color="#2ed573" /></View>
              <Text style={styles.actionTitle}>Share</Text>
              <Text style={styles.actionSub}>Post extras</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.filterRow}>
  {[
    { key: 'all', label: 'All',icon: 'grid-outline', count: sharePosts.length + requestPosts.length},
    { key: 'share', label: 'To Claim', icon: 'heart-sharp', count: sharePosts.length },
    { key: 'request', label: 'Requests', icon: 'hand-left', count: requestPosts.length },
  ].map(f => (
    <TouchableOpacity
      key={f.key}
      style={[styles.filterTab, foodFilter === f.key && styles.filterTabActive]}
      onPress={() => setFoodFilter(f.key)}
    >
      {foodFilter === f.key && (
        <LinearGradient
          colors={['#f093fb', '#f5576c']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Ionicons
        name={f.icon}
        size={13}
        color={foodFilter === f.key ? '#fff' : 'rgba(255,255,255,0.4)'}
      />
      <Text style={[styles.filterTabText, foodFilter === f.key && styles.filterTabTextActive]}>
        {f.label}
      </Text>
      <View style={[styles.filterBadge, foodFilter === f.key && styles.filterBadgeActive]}>
        <Text style={[styles.filterBadgeText, foodFilter === f.key && styles.filterBadgeTextActive]}>
          {f.count}
        </Text>
      </View>
    </TouchableOpacity>
  ))}
</View>

          {loading ? (
  <ActivityIndicator color="#f5576c" style={{ marginTop: 40 }} />
) : (
  <>
<View style={styles.sectionHeader}>
  <Text style={styles.sectionTitle}>
    {foodFilter === 'all' ? 'All posts' : foodFilter === 'share' ? 'Available to claim' : 'Open requests'}
  </Text>
  <Text style={styles.sectionCount}>
    {`${foodFilter === 'all' ? sharePosts.length + requestPosts.length : foodFilter === 'share' ? sharePosts.length : requestPosts.length} active`}
  </Text>
</View>

{foodFilter === 'all' ? (
  <>
    {sharePosts.length === 0 && requestPosts.length === 0 ? (
      <View style={styles.emptyState}>
        <Ionicons name="restaurant-outline" size={32} color="rgba(255,255,255,0.2)" />
        <Text style={styles.emptyText}>Nothing posted yet</Text>
      </View>
    ) : (
      <>
        {sharePosts.map(item => (
          <FoodCard key={item._id} item={item} type="share" user={user} getTimeAgo={getTimeAgo} handleClaim={handleClaim} handleOffer={handleOffer} handleViewOffers={handleViewOffers} handleViewDetail={handleViewDetail} handleMarkOutOfStock={handleMarkOutOfStock} />
        ))}
        {requestPosts.map(item => (
          <FoodCard key={item._id} item={item} type="request" user={user} getTimeAgo={getTimeAgo} handleClaim={handleClaim} handleOffer={handleOffer} handleViewOffers={handleViewOffers} handleViewDetail={handleViewDetail} handleMarkOutOfStock={handleMarkOutOfStock} />
        ))}
      </>
    )}
  </>
) : foodFilter === 'share' ? (
  sharePosts.length === 0 ? (
    <View style={styles.emptyState}>
      <Ionicons name="restaurant-outline" size={32} color="rgba(255,255,255,0.2)" />
      <Text style={styles.emptyText}>Nothing shared yet</Text>
    </View>
  ) : sharePosts.map(item => (
    <FoodCard key={item._id} item={item} type="share" user={user} getTimeAgo={getTimeAgo} handleClaim={handleClaim} handleOffer={handleOffer} handleViewOffers={handleViewOffers} handleViewDetail={handleViewDetail} handleMarkOutOfStock={handleMarkOutOfStock} />
  ))
) : (
  requestPosts.length === 0 ? (
    <View style={styles.emptyState}>
      <Ionicons name="hand-left-outline" size={32} color="rgba(255,255,255,0.2)" />
      <Text style={styles.emptyText}>No requests yet</Text>
    </View>
  ) : requestPosts.map(item => (
    <FoodCard key={item._id} item={item} type="request" user={user} getTimeAgo={getTimeAgo} handleClaim={handleClaim} handleOffer={handleOffer} handleViewOffers={handleViewOffers} handleViewDetail={handleViewDetail} handleMarkOutOfStock={handleMarkOutOfStock} />
  ))
)}
  </>
)}         
 <View style={{ height: 24 }} />
          

        </ScrollView>
      </SafeAreaView>

      {/* Modal */}
      <Modal visible={!!modalType} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalType === 'share' ? '🍱 Share Food' : '🙋 Request Food'}</Text>
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
      : <Text style={styles.submitBtnText}>{modalType === 'share' ? 'Share Now' : 'Post Request'}</Text>
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
          <Text style={styles.offerRequestSub}>{postOffers.length} people offered to help</Text>
        </View>
      )}

      <ScrollView style={styles.modalBody}>
        {loadingOffers ? (
          <ActivityIndicator color="#6c63ff" style={{ marginTop: 40 }} />
        ) : postOffers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="hand-left-outline" size={32} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyText}>No offers yet</Text>
          </View>
        ) : (
          postOffers.map((offer, i) => (
            <View key={i} style={[styles.offerCard, offer.isSelected && styles.offerCardSelected]}>
              <View style={[styles.offerAvatar, { backgroundColor: offer.user?.avatarColor || '#6c63ff' }]}>
                <Text style={styles.offerAvatarText}>{offer.user?.initials}</Text>
              </View>
              <View style={styles.offerInfo}>
                <Text style={styles.offerName}>{offer.user?.name}</Text>
                <Text style={styles.offerHouse}>{offer.user?.houseNo} · {offer.user?.block}</Text>
                {offer.description && (
                  <Text style={styles.offerDesc}>{offer.description}</Text>
                )}
                {offer.pickupTime && (
                  <Text style={styles.offerTime}>⏰ {offer.pickupTime}</Text>
                )}
              </View>
              {offer.isSelected ? (
                <View style={styles.acceptedBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#2ed573" />
                  <Text style={styles.acceptedText}>Accepted</Text>
                </View>
              ) : (
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
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
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
                  {detailPost.type === 'share' ? detailPost.category : 'Request'}
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

            {/* Action button */}
            {detailPost.postedBy?._id !== user?._id && (
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
                    {detailPost.type === 'share' ? 'Claim Now' : 'Offer Help'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  orb: { position: 'absolute', borderRadius: 999 },
  orb1: { width: 300, height: 300, backgroundColor: 'rgba(240,147,251,0.15)', top: -60, right: -80 },
  orb2: { width: 250, height: 250, backgroundColor: 'rgba(245,87,108,0.12)', top: 300, left: -60 },
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
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  countText: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  dot: { fontSize: 11, color: 'rgba(255,255,255,0.2)' },
  claimBtn: { backgroundColor: '#2ed573', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  claimBtnText: { color: '#000', fontSize: 12, fontWeight: '700' },
  offerBtn: { borderWidth: 1.5, borderColor: 'rgba(108,99,255,0.5)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  offerBtnText: { color: '#a78bfa', fontSize: 12, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.25)' },
  modal: { flex: 1, backgroundColor: '#0f0f1e' },
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
outOfStockText: { fontSize: 14, color: '#ff4757', fontWeight: '700' }

});