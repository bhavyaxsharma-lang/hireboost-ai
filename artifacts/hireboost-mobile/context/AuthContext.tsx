import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { createContext, useContext, useEffect, useState } from "react";

interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<string>;
  sendOtp: (email: string) => Promise<void>;
  verifyOtpReset: (email: string, otp: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = "hireboost_auth_token";
const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(TOKEN_KEY);
        if (stored) {
          setAuthTokenGetter(() => stored);
          const res = await fetch(`${BASE}/api/auth/me`, {
            headers: { Authorization: `Bearer ${stored}` },
          });
          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
            setToken(stored);
          } else {
            await AsyncStorage.removeItem(TOKEN_KEY);
            setAuthTokenGetter(null);
          }
        }
      } catch {
        // network error on boot — silently ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Login failed");
    const { user: u, token: t } = data as { user: User; token: string; message: string };
    queryClient.clear();
    await AsyncStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
    setAuthTokenGetter(() => t);
  };

  const logout = async () => {
    const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      // Tell the server to increment tokenVersion, which invalidates this JWT
      // and any copies of it. Failure is non-fatal — local state is always cleared.
      try {
        await fetch(`${BASE}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${storedToken}` },
        });
      } catch {
        // Network error — proceed with local logout anyway
      }
    }
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setAuthTokenGetter(null);
    queryClient.clear();
  };

  const register = async (name: string, email: string, password: string): Promise<string> => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Registration failed");
    return (data as { message: string }).message;
  };

  const sendOtp = async (email: string) => {
    const res = await fetch(`${BASE}/api/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to send OTP");
    }
  };

  const verifyOtpReset = async (email: string, otp: string, newPassword: string) => {
    const res = await fetch(`${BASE}/api/auth/verify-otp-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp, newPassword }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to reset password");
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, register, sendOtp, verifyOtpReset }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
