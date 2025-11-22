/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type AppUser = {
  id: number;
  email: string;
  full_name: string;
  role: "admin" | "staff";
};

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("currentUser");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AppUser;
        setUser(parsed);
      } catch {
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error || "Login gagal");
    }

    const data = (await res.json()) as { user: AppUser };
    setUser(data.user);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("currentUser", JSON.stringify(data.user));
    }
  };

  const logout = (): void => {
    setUser(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("currentUser");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
