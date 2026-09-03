import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertCircle, ArrowRight, Eye, EyeOff, Lock, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { CinematicBackground } from '../motion';

export const LoginView: React.FC = () => {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password Recovery Mode State
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError('Invalid email or password');
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetSubmitting(true);
    setResetMessage(null);
    try {
      const res = await api.requestPasswordReset(resetEmail.trim());
      setResetMessage(res.message);
    } catch (err: any) {
      setResetMessage('If an active account exists for this official email, password reset instructions will be sent.');
    } finally {
      setResetSubmitting(false);
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

        {/* Login / Reset Card */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl bg-slate-900/90 border border-slate-800 p-8 space-y-6 shadow-2xl backdrop-blur-xl"
        >
          {!isResetMode ? (
            /* Sign In Mode */
            <>
              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Official Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 transition-all font-mono"
                    placeholder="user@nyayavault.gov.in"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetMode(true);
                        setError(null);
                      }}
                      className="text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98] cursor-pointer disabled:opacity-50 mt-2"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{loading ? 'Authenticating Credentials...' : 'Sign In to Vault'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            /* Forgot Password Recovery Mode */
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setIsResetMode(false)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors cursor-pointer font-bold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Sign In</span>
                </button>
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-white">Reset Account Password</h3>
                <p className="text-xs text-slate-400">
                  Enter your registered official email address to receive password recovery instructions.
                </p>
              </div>

              {resetMessage ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-3">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Instructions Dispatched</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{resetMessage}</p>
                </div>
              ) : (
                <form onSubmit={handleResetRequest} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Official Email Address</label>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      autoFocus
                      className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 transition-all font-mono"
                      placeholder="user@nyayavault.gov.in"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={resetSubmitting}
                    className="w-full py-3 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                  >
                    <span>{resetSubmitting ? 'Sending Request...' : 'Send Password Reset Link'}</span>
                  </button>
                </form>
              )}
            </div>
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
