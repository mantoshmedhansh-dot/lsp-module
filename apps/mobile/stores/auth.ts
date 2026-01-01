import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type UserRole = 'PICKUP_AGENT' | 'DELIVERY_AGENT' | 'HUB_OPERATOR' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  hubId?: string;
  hubCode?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  setUser: (user: User) => void;
}

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// Storage helper that works on both web and native
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    try {
      set({ isLoading: true });

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      console.log('[Auth] Logging in to:', `${apiUrl}/api/auth/login`);

      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      console.log('[Auth] Login response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      const { user, token } = data.data;
      console.log('[Auth] User:', user);

      // Store in storage
      await storage.setItem(TOKEN_KEY, token);
      await storage.setItem(USER_KEY, JSON.stringify(user));
      console.log('[Auth] Stored token and user');

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
      console.log('[Auth] State updated, isAuthenticated: true');
    } catch (error) {
      console.error('[Auth] Login error:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      const token = get().token;

      // Call logout API
      if (token) {
        await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }).catch(() => {});
      }
    } finally {
      // Clear storage
      await storage.deleteItem(TOKEN_KEY);
      await storage.deleteItem(USER_KEY);

      set({
        user: null,
        token: null,
        isAuthenticated: false,
      });
    }
  },

  loadStoredAuth: async () => {
    try {
      set({ isLoading: true });

      const token = await storage.getItem(TOKEN_KEY);
      const userStr = await storage.getItem(USER_KEY);

      if (token && userStr) {
        const user = JSON.parse(userStr);

        // Verify token is still valid
        const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          set({
            user: data.data,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
      }

      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
    }
  },

  setUser: (user: User) => {
    set({ user });
  },
}));
