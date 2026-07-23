import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as loginApi, register as registerApi, getMe } from '../services/api';
import { registerForPushNotifications } from '../services/notifications';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load token on app start
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        global.authToken = storedToken;

        // Refresh from the server so the cached user picks up fields it may
        // predate — notably societyId, which sessions created before
        // multi-tenancy won't have stored and which the socket layer needs.
        try {
          const res = await getMe();
          if (res.data?.user) {
            setUser(res.data.user);
            await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
          }
        } catch (e) {
          // Offline or token expired — keep the cached user and let the
          // normal request flow surface any auth failure.
        }
      }
    } catch (error) {
      console.log('Error loading auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (phone, password) => {
    try {
      const res = await loginApi({ phone, password });
      const { token, user } = res.data;
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      global.authToken = token;
      setToken(token);
      setUser(user);
      registerForPushNotifications();
      return { success: true };
    } catch (error) {
      console.log('LOGIN ERROR STATUS:', error.response?.status);
      console.log('LOGIN ERROR DATA:', JSON.stringify(error.response?.data));
      console.log('LOGIN ERROR MESSAGE:', error.message);  
      return { success: false, message: error.response?.data?.message || 'Login failed' };
    }
  };

  const register = async (data) => {
    try {
      const res = await registerApi(data);
      const { token, user } = res.data;
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      global.authToken = token;
      setToken(token);
      setUser(user);
      registerForPushNotifications();
      return { success: true };
    } catch (error) {
    console.log('REGISTER ERROR:', JSON.stringify(error.response?.data));
    console.log('REGISTER ERROR STATUS:', error.response?.status);
    console.log('REGISTER ERROR MESSAGE:', error.message);
      return { success: false, message: error.response?.data?.message || 'Registration failed' };
    }
  };

 const logout = async () => {
  try {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    global.authToken = null;
    setToken(null);
    setUser(null);
    console.log('LOGOUT SUCCESS — user set to null');
  } catch (error) {
    console.log('Logout error:', error);

  }
};

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}; 
