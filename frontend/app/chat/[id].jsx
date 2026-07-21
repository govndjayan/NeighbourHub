import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, FlatList, ActivityIndicator, Animated,
  Linking, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { getMessages, sendMessage as sendMessageApi, markAsRead } from '../../services/api';
import { useBadges } from '../../context/BadgeContext';
import { io } from 'socket.io-client';
import { BASE_URL } from '../../constants/config';

const SOCKET_URL = BASE_URL;

export default function ChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { refreshExperts } = useBadges();
  const { id, name, designation, initials, color, phone } = useLocalSearchParams();
  const flatListRef = useRef(null);
  const socketRef = useRef(null);
  const inputRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeout = useRef(null);

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1, duration: 400, useNativeDriver: true,
    }).start();

    fetchMessages();
    setupSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const getRoomId = () => {
    return [user._id, id].sort().join('_');
  };

  const setupSocket = () => {
    // Guard against creating a duplicate socket (e.g. effect re-run in dev),
    // which would register a second 'receive_message' listener and duplicate
    // incoming messages.
    if (socketRef.current) return;
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket'],
    });

    const roomId = getRoomId();
    socketRef.current.emit('join_room', roomId);

    socketRef.current.on('receive_message', (message) => {
      if (!message?._id) return;
      // Ignore the echo of our OWN message — the sender already shows it
      // optimistically and finalizes it via the REST response. Handling it
      // here too would briefly show it twice before reconciling.
      const senderId = message.sender?._id || message.sender;
      if (senderId && user?._id && senderId.toString() === user._id.toString()) return;
      setMessages(prev => {
        // De-dup: skip if we already have this message
        if (prev.some(m => m._id === message._id)) return prev;
        return [...prev, message];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    socketRef.current.on('user_typing', () => {
      setIsTyping(true);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => setIsTyping(false), 2000);
    });
  };

  const fetchMessages = async () => {
    try {
      const res = await getMessages(id);
      setMessages(res.data.messages);
      // Mark incoming messages as read, then refresh the experts badge
      try {
        await markAsRead(id);
        refreshExperts();
      } catch (e) {
        console.log('markAsRead failed:', e.message);
      }
    } catch (error) {
      console.log('Error fetching messages:', error.message);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    // Optimistic UI — show message immediately
    const tempMsg = {
      _id: Date.now().toString(),
      text,
      sender: { _id: user._id },
      createdAt: new Date().toISOString(),
      temp: true,
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      // REST call persists the message AND broadcasts it via the server
      // (req.io.to(roomId).emit('receive_message')). That is the single
      // source of truth — do NOT also emit over the socket, or the receiver
      // gets the message twice.
      const res = await sendMessageApi(id, { text });
      const saved = res.data?.message;
      if (saved?._id) {
        // Reconcile: drop the optimistic temp, and add the real persisted
        // message only if the server echo hasn't already added it. This is
        // race-safe whether the REST response or the socket echo arrives first.
        setMessages(prev => {
          const withoutTemp = prev.filter(m => m._id !== tempMsg._id);
          if (withoutTemp.some(m => m._id === saved._id)) return withoutTemp;
          return [...withoutTemp, saved];
        });
      }
    } catch (error) {
      console.log('Error sending message:', error.message);
      // Roll back the optimistic message on failure
      setMessages(prev => prev.filter(m => m._id !== tempMsg._id));
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (text) => {
    setInput(text);
    const roomId = getRoomId();
    socketRef.current?.emit('typing', { roomId, userId: user._id });
  };

  const handleCall = () => {
    if (!phone) {
      Alert.alert('No phone number', 'This contact has no phone number on file.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const formatTime = (date) => {
    const d = new Date(date);
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m < 10 ? '0' + m : m} ${ampm}`;
  };

  const isSentByMe = (msg) => {
    const senderId = msg.sender?._id || msg.sender;
    return senderId === user._id || senderId?.toString() === user._id?.toString();
  };

  const renderMessage = ({ item, index }) => {
    const sent = isSentByMe(item);
    const showAvatar = !sent && (index === 0 || isSentByMe(messages[index - 1]));

    return (
      <View style={[styles.msgRow, sent && styles.msgRowSent]}>
        {!sent && (
          <View style={[styles.msgAvatar, { backgroundColor: color || '#6c63ff', opacity: showAvatar ? 1 : 0 }]}>
            <Text style={styles.msgAvatarText}>{initials}</Text>
          </View>
        )}
        <View style={[styles.bubble, sent ? styles.bubbleSent : styles.bubbleReceived]}>
          {sent ? (
            <LinearGradient
              colors={['#6c63ff', '#a78bfa']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bubbleGrad}
            >
              <Text style={styles.bubbleTextSent}>{item.text}</Text>
              <Text style={styles.bubbleTimeSent}>{formatTime(item.createdAt)}</Text>
            </LinearGradient>
          ) : (
            <View style={styles.bubbleReceivedInner}>
              <Text style={styles.bubbleTextReceived}>{item.text}</Text>
              <Text style={styles.bubbleTimeReceived}>{formatTime(item.createdAt)}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const headerOpacity = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const headerY = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] });

  return (
    <View style={styles.container}>

      {/* Background */}
      <View style={styles.bg}>
        <View style={styles.orb1} />
        <View style={styles.orb2} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerOpacity, transform: [{ translateY: headerY }] }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={[styles.headerAvatar, { backgroundColor: color || '#6c63ff' }]}>
            <Text style={styles.headerAvatarText}>{initials}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{name}</Text>
            <Text style={styles.headerDesig}>{designation}</Text>
          </View>
          <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
            <Ionicons name="call" size={16} color="#fff" />
          </TouchableOpacity>

        </Animated.View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {/* Messages */}
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color="#6c63ff" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item, index) => item._id?.toString() || index.toString()}
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <View style={styles.dateChip}>
                  <Text style={styles.dateChipText}>Today</Text>
                </View>
              }
              ListEmptyComponent={
                <View style={styles.emptyChat}>
                  <View style={[styles.emptyChatAvatar, { backgroundColor: color || '#6c63ff' }]}>
                    <Text style={styles.emptyChatAvatarText}>{initials}</Text>
                  </View>
                  <Text style={styles.emptyChatName}>{name}</Text>
                  <Text style={styles.emptyChatDesig}>{designation}</Text>
                  <Text style={styles.emptyChatHint}>Send a message to start the conversation</Text>
                </View>
              }
            />
          )}

          {/* Typing indicator */}
          {isTyping && (
            <View style={styles.typingWrap}>
              <View style={[styles.msgAvatar, { backgroundColor: color || '#6c63ff' }]}>
                <Text style={styles.msgAvatarText}>{initials}</Text>
              </View>
              <View style={styles.typingBubble}>
                <View style={styles.typingDots}>
                  {[0, 1, 2].map(i => (
                    <View key={i} style={[styles.typingDot, { opacity: 0.4 + i * 0.2 }]} />
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Input */}
          <View style={styles.inputRow}>
            <View style={styles.inputWrap}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={input}
                onChangeText={handleTyping}
                multiline
                maxHeight={100}
                returnKeyType="send"
                onSubmitEditing={handleSend}
              />
            </View>
            <TouchableOpacity
              style={[styles.sendBtn, input.trim() && styles.sendBtnActive]}
              onPress={handleSend}
              disabled={!input.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <LinearGradient
                  colors={input.trim() ? ['#6c63ff', '#a78bfa'] : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.08)']}
                  style={styles.sendBtnGrad}
                >
                  <Ionicons name="send" size={16} color={input.trim() ? '#fff' : 'rgba(255,255,255,0.3)'} />
                </LinearGradient>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07231f' },
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  orb1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(52,211,153,0.15)', top: -60, left: -60 },
  orb2: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(45,212,191,0.10)', bottom: 100, right: -60 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, paddingHorizontal: 16, gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerAvatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  headerDesig: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  callBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(46,213,115,0.12)',
    borderWidth: 1, borderColor: 'rgba(46,213,115,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },


  // Messages
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messagesList: { padding: 16, gap: 6, flexGrow: 1 },
  dateChip: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 20, marginBottom: 16,
  },
  dateChipText: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },

  // Empty state
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 8 },
  emptyChatAvatar: { width: 70, height: 70, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyChatAvatarText: { fontSize: 24, fontWeight: '800', color: '#fff' },
  emptyChatName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  emptyChatDesig: { fontSize: 13, color: '#a78bfa', fontWeight: '600' },
  emptyChatHint: { fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 8 },

  // Message rows
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  msgRowSent: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  msgAvatarText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  // Bubbles
  bubble: { maxWidth: '75%', borderRadius: 18, overflow: 'hidden' },
  bubbleSent: { borderBottomRightRadius: 4 },
  bubbleReceived: { borderBottomLeftRadius: 4 },
  bubbleGrad: { padding: 12, paddingHorizontal: 14 },
  bubbleReceivedInner: {
    padding: 12, paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18, borderBottomLeftRadius: 4,
  },
  bubbleTextSent: { fontSize: 14, color: '#fff', lineHeight: 20 },
  bubbleTextReceived: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  bubbleTimeSent: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4, textAlign: 'right' },
  bubbleTimeReceived: { fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4, textAlign: 'right' },

  // Typing
  typingWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  typingBubble: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18, borderBottomLeftRadius: 4,
    padding: 12, paddingHorizontal: 14,
  },
  typingDots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },

  // Input
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12, paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  inputWrap: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
  },
  input: { fontSize: 14, color: '#fff', maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden' },
  sendBtnActive: {},
  sendBtnGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});