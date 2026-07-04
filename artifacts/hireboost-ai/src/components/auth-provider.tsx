import React, { createContext, useContext, useEffect, useState } from "react";
import { getLocalStorageItem } from "@/lib/storage";

type AuthState = {
  user: {
    name?: string;
    email?: string;
  } | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthState>({
  user: null,
  isLoading: false,
  isAuthenticated: false,
});

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(getLocalStorageItem("authToken"));

    const syncAuth = () => {
      setToken(getLocalStorageItem("authToken"));
    };

    window.addEventListener("storage", syncAuth);

    return () => {
      window.removeEventListener("storage", syncAuth);
    };
  }, []);

  const storedName = token ? getLocalStorageItem("userName") : null;
  const storedEmail = token ? getLocalStorageItem("userEmail") : null;

  return (
    <AuthContext.Provider
      value={{
        user: token
          ? {
              name: storedName || undefined,
              email: storedEmail || undefined,
            }
          : null,
        isLoading: false,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = getLocalStorageItem("authToken");

  if (!token) {
    if (typeof window !== "undefined") {
      window.location.href = "/auth";
    }
    return null;
  }

  return <>{children}</>;
}