import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMySociety } from '../services/api';
import { useAuth } from './AuthContext';

const SocietyContext = createContext();

export const useSociety = () => useContext(SocietyContext);

// Single source of truth for "which society is this user in" — every screen
// that used to hardcode a community name or block list reads it from here
// instead, so the same app build works for any society.
export const SocietyProvider = ({ children }) => {
  const { user } = useAuth();
  const [society, setSociety] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?._id) {
      setSociety(null);
      return;
    }
    setLoading(true);
    try {
      const res = await getMySociety();
      setSociety(res.data.society);
    } catch (error) {
      console.log('Error loading society:', error.message);
    } finally {
      setLoading(false);
    }
  }, [user?._id]);

  useEffect(() => { refresh(); }, [refresh]);

  // 'All' first so screens can spread this straight into a filter chip list.
  const blockOptions = ['All', ...(society?.blocks || [])];

  return (
    <SocietyContext.Provider value={{ society, blockOptions, loading, refresh }}>
      {children}
    </SocietyContext.Provider>
  );
};
