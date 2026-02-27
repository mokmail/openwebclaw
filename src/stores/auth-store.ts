// ---------------------------------------------------------------------------
// OpenWebClaw — Authentication state store
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { hasPassword, verifyPassword, setPassword, readSession, writeSession, clearSession } from '../auth.js';

type AuthPhase = 'loading' | 'setup' | 'login' | 'authenticated';

interface AuthState {
  phase: AuthPhase;
  error: string | null;

  /** Boot: check for existing password and existing session */
  init: () => Promise<void>;

  /** First-time: set a new password */
  setupPassword: (password: string, confirm: string) => Promise<void>;

  /** Login with password */
  login: (password: string, rememberMe: boolean) => Promise<boolean>;

  /** Log out and clear the session */
  logout: () => void;

  /** Change current password (requires the old password for verification) */
  changePassword: (oldPw: string, newPw: string, confirmPw: string) => Promise<void>;

  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  phase: 'loading',
  error: null,

  init: async () => {
    try {
      // If a valid session already exists, skip login
      if (readSession()) {
        set({ phase: 'authenticated', error: null });
        return;
      }
      const exists = await hasPassword();
      set({ phase: exists ? 'login' : 'setup', error: null });
    } catch {
      // DB or crypto error — default to setup so the user is never stuck
      set({ phase: 'setup', error: null });
    }
  },

  setupPassword: async (password, confirm) => {
    if (password !== confirm) {
      set({ error: 'Passwords do not match.' });
      return;
    }
    try {
      await setPassword(password);
      writeSession(false);
      set({ phase: 'authenticated', error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  login: async (password, rememberMe) => {
    const ok = await verifyPassword(password);
    if (ok) {
      writeSession(rememberMe);
      set({ phase: 'authenticated', error: null });
    } else {
      set({ error: 'Incorrect password. Please try again.' });
    }
    return ok;
  },

  logout: () => {
    clearSession();
    set({ phase: 'login', error: null });
  },

  changePassword: async (oldPw, newPw, confirmPw) => {
    if (newPw !== confirmPw) {
      set({ error: 'New passwords do not match.' });
      return;
    }
    const ok = await verifyPassword(oldPw);
    if (!ok) {
      set({ error: 'Current password is incorrect.' });
      return;
    }
    try {
      await setPassword(newPw);
      set({ error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  clearError: () => set({ error: null }),
}));
