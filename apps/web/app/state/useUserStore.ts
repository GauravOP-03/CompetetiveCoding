import { create } from "zustand/react";
import api from "@repo/api/src/client";

export interface userData {
  name: string;
  email: string;
  id: string;
}

interface AuthStore {
  userData: userData | null;
  isAuthenticated: boolean;
  clearUser: () => void;
  isLoading: boolean;
  fetchUser: () => Promise<void>;
}

export const Authdata = create<AuthStore>((set) => ({
  userData: null,
  isAuthenticated: false,
  fetchUser: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get("auth/me");
      const data = res.data;
      set({ userData: data, isLoading: false });
    } catch (e) {
      console.error(e);
      set({ userData: null, isLoading: false });
    }
  },
  isLoading: false,
  clearUser: () => set({ userData: null, isLoading: false }),
}));
