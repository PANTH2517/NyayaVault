import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertCircle, Eye, EyeOff, KeyRound, ArrowLeft, CheckCircle2, UserPlus, LogIn, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { RoleName } from '../../types';

type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD';

export const LoginView: React.FC = () => {
  const { login, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>('LOGIN');

  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Registration State
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState<RoleName>('INVESTIGATING_OFFICER');
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  // Password Recovery State
  const [resetEmail, setResetEmail] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setLoginError(err.message || 'Invalid email or password');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);

    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match');
      return;
    }

    if (regRole === 'ADMIN') {
      setRegError('Administrator accounts cannot be requested via public registration');
      return;
    }

    setRegSubmitting(true);
    try {
      const res = await api.register({
        email: regEmail.trim(),
        fullName: regFullName.trim(),
        password: regPassword,
        requestedRole: regRole,
      });

      setRegSuccess(res.detail || 'Registration submitted. Your account is pending administrator approval.');
      setRegFullName('');
      setRegEmail('');
      setRegPassword('');
      setRegConfirmPassword('');
    } catch (err: any) {
      setRegError(err.message || 'Unable to submit registration request');
    } finally {
      setRegSubmitting(false);
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 relative font-sans">
      <div className="max-w-md w-full space-y-6 z-10">
        {/* Branding Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 bg-slate-900 border border-slate-800 rounded-2xl text-amber-400 shadow-lg">
            <Shield className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            NyayaVault
          </h1>
          <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">
            Secure Digital Evidence Management System
          </p>
        </div>

        {/* Auth Mode Tabs */}
        {mode !== 'FORGOT_PASSWORD' && (
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-bold">
            <button
              onClick={() => {
                setMode('LOGIN');
                setLoginError(null);
              }}
              className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                mode === 'LOGIN'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </button>
            <button
              onClick={() => {
                setMode('REGISTER');
                setRegError(null);
                setRegSuccess(null);
              }}
              className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                mode === 'REGISTER'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Request Account</span>
            </button>
          </div>
        )}

        {/* Card Body */}
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-8 space-y-6 shadow-2xl backdrop-blur-xl">
          {mode === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">Official Sign In</h2>
                <p className="text-xs text-slate-400">Enter your credentials to access assigned evidence cases.</p>
              </div>

              {loginError && (
                <div
                  className={`p-4 rounded-2xl text-xs flex items-start gap-3 border ${
                    loginError.includes('awaiting administrator approval')
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      : loginError.includes('not approved')
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  {loginError.includes('awaiting administrator approval') ? (
                    <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="font-bold text-xs">
                      {loginError.includes('awaiting administrator approval')
                        ? 'Registration Pending Approval'
                        : loginError.includes('not approved')
                        ? 'Registration Rejected'
                        : 'Authentication Error'}
                    </h4>
                    <p className="mt-0.5 leading-relaxed">{loginError}</p>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Official Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="officer@nyayavault.gov.in"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => setMode('FORGOT_PASSWORD')}
                    className="text-[11px] font-medium text-amber-400 hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 font-medium pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 mt-2"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          )}

          {mode === 'REGISTER' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">Request Account Registration</h2>
                <p className="text-xs text-slate-400">
                  Your account will remain pending until an administrator reviews and approves your requested role.
                </p>
              </div>

              {regSuccess ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-3 font-medium">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>Registration Submitted</span>
                  </div>
                  <p className="leading-relaxed">{regSuccess}</p>
                  <button
                    type="button"
                    onClick={() => setMode('LOGIN')}
                    className="w-full py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors cursor-pointer"
                  >
                    Return to Sign In
                  </button>
                </div>
              ) : (
                <>
                  {regError && (
                    <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{regError}</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Full Name & Rank/Designation</label>
                    <input
                      type="text"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      required
                      placeholder="e.g. Inspector R. Sharma"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Official Email Address</label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                      placeholder="officer@nyayavault.gov.in"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Requested Official Role</label>
                    <select
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value as RoleName)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 font-medium"
                    >
                      <option value="INVESTIGATING_OFFICER">Investigating Officer (IO)</option>
                      <option value="SUPERVISOR">Supervising Officer (Superintendent)</option>
                      <option value="PROSECUTOR">Public Prosecutor</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-300">Password</label>
                      <input
                        type="password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="••••••••••••"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 font-medium"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-300">Confirm Password</label>
                      <input
                        type="password"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="••••••••••••"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 font-medium"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={regSubmitting}
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 mt-2"
                  >
                    {regSubmitting ? 'Submitting Registration...' : 'Submit Registration Request'}
                  </button>
                </>
              )}
            </form>
          )}

          {mode === 'FORGOT_PASSWORD' && (
            <form onSubmit={handleResetRequest} className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode('LOGIN')}
                  className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="space-y-0.5">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    Account Recovery
                  </h2>
                  <p className="text-[11px] text-slate-400">Request password reset link</p>
                </div>
              </div>

              {resetMessage ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-3 font-medium">
                  <div className="flex items-center gap-2 font-bold text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Instructions Dispatched</span>
                  </div>
                  <p className="leading-relaxed">{resetMessage}</p>
                  <button
                    type="button"
                    onClick={() => setMode('LOGIN')}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Return to Sign In
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Provide your registered official email address. A single-use password reset link will be generated.
                  </p>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Registered Email Address</label>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      placeholder="officer@nyayavault.gov.in"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 font-medium"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={resetSubmitting}
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 mt-2"
                  >
                    {resetSubmitting ? 'Sending Request...' : 'Send Password Reset Email'}
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
