import axios from 'axios';
import { CLOUDINARY_URL, CLOUDINARY_PRESET } from '../constants/config';

import { API_URL } from '../constants/config';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach token to every request automatically
api.interceptors.request.use(
  (config) => {
    const token = global.authToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Auth
export const register = (data) => api.post('/auth/register', data);
export const login = (data) => api.post('/auth/login', data);
export const getMe = () => api.get('/auth/me');

// Announcements
export const getAnnouncements = () => api.get('/announcements');
export const createAnnouncement = (data) => api.post('/announcements', data);
export const deleteAnnouncement = (id) => api.delete(`/announcements/${id}`);
export const updateAnnouncement = (id, data) => api.put(`/announcements/${id}`, data);

// Food
export const getFoodPosts = (type) => api.get(`/food${type ? `?type=${type}` : ''}`);
export const createFoodPost = (data) => api.post('/food', data);
export const claimFood = (id, data) => api.post(`/food/${id}/claim`, data);
export const offerFood = (id, data) => api.post(`/food/${id}/offer`, data);
export const getFoodOffers = (id) => api.get(`/food/${id}/offers`);
export const acceptOffer = (id, offerId) => api.post(`/food/${id}/offer/accept`, { offerId });
export const markFoodOutOfStock = (id) => api.put(`/food/${id}/outofstock`);

// Complaints
export const getComplaints = () => api.get('/complaints');
export const createComplaint = (data) => api.post('/complaints', data);
export const updateComplaintStatus = (id, data) => api.put(`/complaints/${id}/status`, data);
export const addComplaintComment = (id, data) => api.post(`/complaints/${id}/comment`, data);

// Users
export const getAllUsers = () => api.get('/users');
export const getProfessionals = (category) => api.get(`/users/professionals${category ? `?category=${category}` : ''}`);
export const updateUserRole = (id, role) => api.put(`/users/${id}/role`, { role });
export const getStats = () => api.get('/users/stats');

// Chat
export const getMessages = (userId) => api.get(`/chat/${userId}`);
export const sendMessage = (userId, data) => api.post(`/chat/${userId}`, data);
export const getConversations = () => api.get('/chat/conversations');
//Push Token
export const savePushToken = (token) => api.put('/users/push-token', { pushToken: token });

export const BASE_URL = 'https://neighbourhub-backend-49fh.onrender.com';
export const API_URL = `${BASE_URL}/api`;

export const uploadImage = async (uri) => {
  console.log('UPLOADING IMAGE URI:', uri);
  const formData = new FormData();
  formData.append('file', {
    uri,
    type: 'image/jpeg',
    name: 'food_photo.jpg',
  });
  formData.append('upload_preset', CLOUDINARY_PRESET);
    console.log('CLOUDINARY URL:', CLOUDINARY_URL);
  console.log('PRESET:', CLOUDINARY_PRESET);

  const res = await fetch(CLOUDINARY_URL, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  console.log('CLOUDINARY RESPONSE:', JSON.stringify(data));
  console.log('SECURE URL:', data.secure_url);
  return data.secure_url;
};

export default api; 
