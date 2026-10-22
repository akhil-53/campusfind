import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe, loginStudent, registerStudent, loginStaff, loginAdmin, completeProfile, logoutUser } from '../api/client';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('cf_token'));
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('cf_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Sync token and verify on mount
  useEffect(() => {
    async function loadUser() {
      const storedToken = localStorage.getItem('cf_token');
      if (storedToken) {
        try {
          const res = await getMe();
          setUser(res.user);
          localStorage.setItem('cf_user', JSON.stringify(res.user));
        } catch (err) {
          console.warn('[Auth] Session expired or invalid:', err.message);
          setToken(null);
          setUser(null);
          localStorage.removeItem('cf_token');
          localStorage.removeItem('cf_user');
        }
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  const handleAuthSuccess = (data) => {
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('cf_token', data.token);
    localStorage.setItem('cf_user', JSON.stringify(data.user));
    toast.success(`Welcome back, ${data.user.fullName}!`);
  };

  const loginStudentUser = async (email, password, fullName, regNo) => {
    const data = await loginStudent(email, password, fullName, regNo);
    handleAuthSuccess(data);
    return data.user;
  };

  const registerStudentUser = async (formData) => {
    const data = await registerStudent(formData);
    handleAuthSuccess(data);
    return data.user;
  };

  const loginStaffUser = async (email, password) => {
    const data = await loginStaff(email, password);
    handleAuthSuccess(data);
    return data.user;
  };

  const loginWithAdminCredentials = async (email, password) => {
    const data = await loginAdmin(email, password);
    handleAuthSuccess(data);
    return data.user;
  };

  const updateStudentProfile = async (regNo) => {
    const data = await completeProfile(regNo);
    setUser(data.user);
    localStorage.setItem('cf_user', JSON.stringify(data.user));
    toast.success('Registration number saved!');
    return data.user;
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (e) {}
    setToken(null);
    setUser(null);
    localStorage.removeItem('cf_token');
    localStorage.removeItem('cf_user');
    toast.success('Logged out successfully');
  };

  const value = {
    token,
    user,
    loading,
    isAuthenticated: !!token && !!user,
    loginStudentUser,
    registerStudentUser,
    loginStaffUser,
    loginWithAdminCredentials,
    updateStudentProfile,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
