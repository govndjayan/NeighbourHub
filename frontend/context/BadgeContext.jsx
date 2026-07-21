import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import { getFoodPosts, getComplaints, getConversations } from '../services/api';
import { BASE_URL } from '../constants/config';
import { useAuth } from './AuthContext';

const BadgeContext = createContext();

export const useBadges = () => useContext(BadgeContext);

// Per-user storage key for the "last time this tab was opened" timestamps
const seenKey = (userId) => `tabLastSeen_${userId}`;

export const BadgeProvider = ({ children }) => {
  const { user } = useAuth();

  // Unread counts shown as tab badges
  const [counts, setCounts] = useState({ food: 0, experts: 0, complaints: 0 });

  // last-seen timestamps per tab (ms). experts uses server read-state instead.
  const lastSeenRef = useRef({ food: 0, complaints: 0 });
  const socketRef = useRef(null);

  const refreshExperts = useCallback(async () => {
    if (!user?._id) return;
    try {
      const convRes = await getConversations();
      const experts = (convRes.data.conversations || [])
        .reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      setCounts((prev) => ({ ...prev, experts }));
    } catch {}
  }, [user?._id]);

  // Count items created after `since`, excluding the user's own posts
  const countNewSince = (items, since, userId) => {
    if (!since) return 0; // first run: treat history as already seen
    return items.filter((it) => {
      const created = new Date(it.createdAt).getTime();
      const mine = (it.postedBy?._id || it.postedBy) === userId ||
                   (it.createdBy?._id || it.createdBy) === userId;
      return created > since && !mine;
    }).length;
  };

  // Recompute all three badge counts from the backend
  const refreshAll = useCallback(async () => {
    if (!user?._id) return;
    try {
      const [foodShare, foodReq, complaintsRes, convRes] = await Promise.all([
        getFoodPosts('share').catch(() => ({ data: { posts: [] } })),
        getFoodPosts('request').catch(() => ({ data: { posts: [] } })),
        getComplaints().catch(() => ({ data: { complaints: [] } })),
        getConversations().catch(() => ({ data: { conversations: [] } })),
      ]);

      const foodPosts = [
        ...(foodShare.data.posts || []),
        ...(foodReq.data.posts || []),
      ];
      const complaints = complaintsRes.data.complaints || [];
      const conversations = convRes.data.conversations || [];

      setCounts({
        food: countNewSince(foodPosts, lastSeenRef.current.food, user._id),
        complaints: countNewSince(complaints, lastSeenRef.current.complaints, user._id),
        experts: conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
      });
    } catch (e) {
      // leave existing counts on failure
    }
  }, [user?._id]);

  // Load stored last-seen timestamps when the user changes
  useEffect(() => {
    if (!user?._id) {
      setCounts({ food: 0, experts: 0, complaints: 0 });
      return;
    }
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(seenKey(user._id));
        lastSeenRef.current = raw ? JSON.parse(raw) : { food: 0, complaints: 0 };
      } catch {
        lastSeenRef.current = { food: 0, complaints: 0 };
      }
      refreshAll();
    })();
  }, [user?._id, refreshAll]);

  const persistSeen = useCallback(async () => {
    if (!user?._id) return;
    try {
      await AsyncStorage.setItem(seenKey(user._id), JSON.stringify(lastSeenRef.current));
    } catch {}
  }, [user?._id]);

  // Live increments while the user is on another tab
  useEffect(() => {
    if (!user?._id) return;
    const socket = io(BASE_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    const bump = (tab) => setCounts((prev) => ({ ...prev, [tab]: prev[tab] + 1 }));

    socket.on('new_food_post', (post) => {
      const mine = (post?.postedBy?._id || post?.postedBy) === user._id;
      if (!mine) bump('food');
    });
    socket.on('new_complaint', (c) => {
      const mine = (c?.postedBy?._id || c?.postedBy) === user._id;
      if (!mine) bump('complaints');
    });
    socket.on('receive_message', async () => {
      try {
        const convRes = await getConversations();
        const experts = (convRes.data.conversations || [])
          .reduce((sum, c) => sum + (c.unreadCount || 0), 0);
        setCounts((prev) => ({ ...prev, experts }));
      } catch {}
    });

    return () => socket.disconnect();
  }, [user?._id]);

  // Call when a tab is focused — clears that tab's badge
  const markSeen = useCallback((tab) => {
    if (tab === 'experts') {
      setTimeout(() => refreshExperts(), 400);
      return;
    }
    if (tab === 'food' || tab === 'complaints') {
      lastSeenRef.current[tab] = Date.now();
      persistSeen();
      setCounts((prev) => ({ ...prev, [tab]: 0 }));
    }
  }, [persistSeen, refreshExperts]);

  return (
    <BadgeContext.Provider value={{ counts, markSeen, refreshAll, refreshExperts }}>
      {children}
    </BadgeContext.Provider>
  );
};
