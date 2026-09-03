import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertCircle, ArrowRight, Eye, EyeOff, Lock, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';
import { CinematicBackground } from '../motion';

interface ResetPasswordViewProps {
  onReturnToLogin: () => void;
}

export const ResetPasswordView: React.FC<ResetPasswordViewProps> = ({ onReturnToLogin }) => {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    // Parse raw token from window.location.search (?token=...)
    const params = new URLSearchParams(window.location.search);
    const rawToken = params.get('token');
    if (rawToken) {
      setToken(rawToken);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Password confirmation does not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    if (!token) {
      setError('Missing or invalid password reset token in URL');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.confirmPasswordReset({
        token,
        newPassword,
        confirmPassword,
      });
      setSuccessMessage(res.message);
      // Clear token from component state for security
      setToken('');
    } catch (err: any) {
      setError(err.message || 'Invalid or expired password reset token');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 relative font-sans overflow-hidden">
      <CinematicBackground />

      <div className="max-w-md w-full space-y-6 z-10">
        {/* Logo Branding Header */}
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center space-y-3"
        >
          <div className="inline-flex p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-3xl text-amber-400 shadow-2xl shadow-amber-500/20">
            <Shield className="w-12 h-12 drop-shadow-md" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            NyayaVault
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed font-semibold">
            Digital Evidence Management System
          </p>
        </motion.div>

        {/* Reset Password Form Container */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl bg-slate-900/90 border border-slate-800 p-8 space-y-6 shadow-2xl backdrop-blur-xl"
        >
          <div className="space-y-1">
            <h2 className="text-lg font-extrabold text-white">Set New Password</h2>
            <p className="text-xs text-slate-400">
              Provide a new password for your official NyayaVault account.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-4">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Password Reset Complete</span>
              </div>
              <p className="text-slate-300 leading-relaxed">{successMessage}</p>
              <button
                onClick={onReturnToLogin}
                className="w-full py-3 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">New Password (min 8 chars)</label>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoFocus
                    className="w-full px-4 py-3 pr-12 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 transition-all"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 transition-all"
                  placeholder="••••••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !token}
                className="w-full py-3 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98] cursor-pointer disabled:opacity-50 mt-2"
              >
                <span>{submitting ? 'Updating Password...' : 'Reset Password'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="pt-2 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5 font-medium">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Authorized Personnel Only &bull; Argon2 Protected</span>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
