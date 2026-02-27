// ---------------------------------------------------------------------------
// OpenWebClaw — Login / Setup page (OpenWebUI-inspired design)
// ---------------------------------------------------------------------------

import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store.js';

export function LoginPage() {
  const phase = useAuthStore((s) => s.phase);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const login = useAuthStore((s) => s.login);
  const setupPassword = useAuthStore((s) => s.setupPassword);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const isSetup = phase === 'setup';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    setLoading(true);
    try {
      if (isSetup) {
        await setupPassword(password, confirm);
      } else {
        await login(password, rememberMe);
      }
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    password.length >= 4 && (!isSetup || confirm.length >= 4) && !loading;

  return (
    <div className="flex items-center justify-center min-h-screen bg-base-100 px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-base-content text-base-100 mb-4 shadow-lg">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-base-content">OpenWebClaw</h1>
          <p className="text-sm text-base-content/50 mt-1">
            {isSetup
              ? 'Set a password to secure your assistant'
              : 'Enter your password to continue'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-base-100 border border-base-300 rounded-2xl shadow-sm p-6">
          {isSetup && (
            <div className="flex items-start gap-3 p-3 bg-base-200/60 rounded-xl mb-5 text-sm text-base-content/70">
              <ShieldCheck className="w-5 h-5 text-base-content/50 shrink-0 mt-0.5" />
              <span>Your password is hashed locally with PBKDF2 and never sent anywhere.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                {isSetup ? 'New Password' : 'Password'}
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="w-full px-4 py-2.5 pr-10 bg-base-200 border border-base-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-base-content/20 transition-all"
                  placeholder={isSetup ? 'Min. 4 characters' : '••••••••'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  autoComplete={isSetup ? 'new-password' : 'current-password'}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content/70 transition-colors"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm (setup only) */}
            {isSetup && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    className="w-full px-4 py-2.5 pr-10 bg-base-200 border border-base-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-base-content/20 transition-all"
                    placeholder="Repeat your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content/70 transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password && confirm && password !== confirm && (
                  <p className="text-xs text-error mt-1.5">Passwords do not match</p>
                )}
              </div>
            )}

            {/* Remember me (login only) */}
            {!isSetup && (
              <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                />
                <span className="text-sm text-base-content/70">Remember me</span>
              </label>
            )}

            {/* Error */}
            {error && (
              <div className="text-sm text-error bg-error/10 border border-error/20 rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-all bg-base-content text-base-100 hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={!canSubmit}
            >
              {loading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <>
                  {isSetup ? 'Set Password & Continue' : 'Sign In'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-base-content/30 mt-6">
          All data stays in your browser. Zero infrastructure.
        </p>
      </div>
    </div>
  );
}
