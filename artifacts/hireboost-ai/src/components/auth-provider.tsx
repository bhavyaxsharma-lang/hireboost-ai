import React, { createContext, useContext } from "react";

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
  const [token, setToken] = React.useState(
    localStorage.getItem("authToken")
  );

  React.useEffect(() => {
    const syncAuth = () => {
      setToken(localStorage.getItem("authToken"));
    };

    window.addEventListener("storage", syncAuth);

    return () => {
      window.removeEventListener("storage", syncAuth);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: token
          ? {
              name: localStorage.getItem("userName") || undefined,
              email: localStorage.getItem("userEmail") || undefined,
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
  const token = localStorage.getItem("authToken");

  if (!token) {
    window.location.href = "/auth";
    return null;
  }

  return <>{children}</>;
}