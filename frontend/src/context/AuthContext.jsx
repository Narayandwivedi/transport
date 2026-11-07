import { createContext, useContext, useEffect, useState } from 'react';
import apiClient from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // A staff login: { name, canAdd, canEdit, seeOwnerEntries, needsApproval }; null for the owner
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const response = await apiClient.get('/auth/me');
      setUser(response.user || null);
      setStaff(response.staff || null);
    } catch {
      setUser(null);
      setStaff(null);
    }
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const login = async (login, password) => {
    try {
      const response = await apiClient.post('/auth/login', { login, password });
      setUser(response.user);
      setStaff(null);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  // Staff sign in with their mobile and the password the owner gave them
  const staffLogin = async (mobile, password) => {
    try {
      const response = await apiClient.post('/auth/staff-login', { mobile, password });
      setUser(response.user);
      setStaff(response.staff);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const register = async (data) => {
    try {
      const response = await apiClient.post('/auth/register', data);
      setUser(response.user);
      setStaff(null);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const logout = async () => {
    await apiClient.post('/auth/logout').catch(() => {});
    setUser(null);
    setStaff(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, staff, isStaff: Boolean(staff), refresh, loading, isAuthenticated: Boolean(user), login, staffLogin, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
