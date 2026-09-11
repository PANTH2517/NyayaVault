import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
  UserPlus,
  LogIn,
  Clock,
  Lock,
  FileCheck2,
  Database,
  Fingerprint,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { RoleName } from '../../types';

type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD';

export const LoginView: React.FC = () => {
  const { login, verifyMfa, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>('LOGIN');

  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // MFA Challenge State
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

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
      const res = await login(email.trim(), password);
      if (res && res.mfaRequired && res.mfaChallengeToken) {
        setMfaChallengeToken(res.mfaChallengeToken);
        setMfaCode('');
        setMfaError(null);
      }
    } catch (err: any) {
      setLoginError(err.message || 'Invalid email or password');
    }
  };

  const handleMfaVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallengeToken) return;
    setMfaError(null);
    try {
      await verifyMfa(mfaChallengeToken, mfaCode.trim());
    } catch (err: any) {
      setMfaError(err.message || 'Verification failed. Invalid code or challenge expired.');
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

  const pipelineSteps = [
    { label: 'EVIDENCE', sub: 'Digital Artifact', icon: FileCheck2 },
    { label: 'HASH', sub: 'SHA-256 Digest', icon: Fingerprint },
    { label: 'ENCRYPT', sub: 'AES-256 Envelope', icon: Lock },
    { label: 'AUDIT', sub: 'Immutable Log', icon: Clock },
    { label: 'BLOCKCHAIN', sub: 'Consensus Proof', icon: Database },
  ];

  return (
    <div className="min-h-screen bg-[#060911] text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-12 relative font-sans">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center z-10">
        {/* LEFT COLUMN: ~55% Desktop Hero Presentation */}
        <div className="lg:col-span-7 space-y-8 pr-0 lg:pr-6">

          <div className="space-y-4">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-semibold">
              <Shield className="w-4 h-4" />
              <span>NYAYAVAULT EVIDENCE ENGINE</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
              Trust every <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500">
                digital artifact.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-xl font-normal">
              The national operating system for secure digital evidence custody. Protecting chain-of-custody integrity through end-to-end cryptographic signatures and distributed ledger validation.
            </p>
          </div>

          {/* Architectural Evidence Pipeline Visualizer */}
          <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800/80 space-y-4 backdrop-blur-xl">
            <div className="text-[11px] font-mono font-bold text-slate-400 tracking-wider uppercase flex items-center justify-between">
              <span>CRYPTOGRAPHIC ARCHITECTURE PIPELINE</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ACTIVE ENGINE
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2 relative">
              {pipelineSteps.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1, duration: 0.4 }}
                    className="flex flex-col items-center text-center space-y-2 group"
                  >
                    <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800/90 group-hover:border-amber-500/50 group-hover:bg-amber-500/10 transition-all text-slate-300 group-hover:text-amber-400 shadow-lg">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-mono font-bold text-slate-200 group-hover:text-amber-300">
                        {step.label}
                      </div>
                      <div className="text-[9px] text-slate-500 hidden sm:block">
                        {step.sub}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ~45% Authentication Panel Terminal */}
        <div className="lg:col-span-5 w-full">
          <div className="rounded-3xl bg-slate-900/90 border border-slate-800/90 p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-2xl relative">
            {/* Header Controls */}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono font-extrabold text-amber-400 tracking-widest uppercase flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  <span>SECURE ACCESS TERMINAL</span>
                </div>
              </div>

              {/* Mode Selector Tabs */}
              {mode !== 'FORGOT_PASSWORD' && !mfaChallengeToken && (
                <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-xs font-bold">
                  <button
                    onClick={() => {
                      setMode('LOGIN');
                      setLoginError(null);
                    }}
                    className={`py-2 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      mode === 'LOGIN'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>
                  <button
                    onClick={() => {
                      setMode('REGISTER');
                      setRegError(null);
                      setRegSuccess(null);
                    }}
                    className={`py-2 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      mode === 'REGISTER'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Request Account</span>
                  </button>
                </div>
              )}
            </div>

            {/* MFA Challenge Form */}
            {mfaChallengeToken ? (
              <form onSubmit={handleMfaVerifySubmit} className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-amber-400" />
                    <h2 className="text-base font-bold text-white">Multi-Factor Authentication</h2>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {useRecoveryCode
                      ? 'Enter an unused 32-character single-use emergency recovery code.'
                      : 'Enter the 6-digit verification code generated by your authenticator application.'}
                  </p>
                </div>

                {mfaError && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{mfaError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    {useRecoveryCode ? 'Recovery Code' : '6-Digit Verification Code'}
                  </label>
                  <input
                    type="text"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    required
                    autoFocus
                    maxLength={useRecoveryCode ? 40 : 8}
                    placeholder={useRecoveryCode ? 'e.g. A1B2C3D4-E5F67890-12345678-90ABCDEF' : '123456'}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-center tracking-widest text-base font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setUseRecoveryCode(!useRecoveryCode);
                      setMfaCode('');
                      setMfaError(null);
                    }}
                    className="text-amber-400 hover:underline cursor-pointer font-medium"
                  >
                    {useRecoveryCode ? 'Use TOTP App' : 'Use recovery code'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMfaChallengeToken(null);
                      setMfaCode('');
                      setMfaError(null);
                    }}
                    className="text-slate-400 hover:text-slate-200 cursor-pointer font-medium"
                  >
                    Back to Sign In
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || !mfaCode.trim()}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 mt-2"
                >
                  {loading ? 'Verifying Credentials...' : 'Verify & Complete Sign In'}
                </button>
              </form>
            ) : mode === 'LOGIN' ? (
              /* Official Sign In Form */
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-white">Official Sign In</h2>
                  <p className="text-xs text-slate-400">Provide official credentials to access assigned evidence.</p>
                </div>

                {loginError && (
                  <div
                    className={`p-3.5 rounded-2xl text-xs flex items-start gap-3 border ${
                      loginError.includes('awaiting administrator approval')
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        : loginError.includes('not approved')
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}
                  >
                    {loginError.includes('awaiting administrator approval') ? (
                      <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h4 className="font-bold text-xs">
                        {loginError.includes('awaiting administrator approval')
                          ? 'Registration Pending Approval'
                          : loginError.includes('not approved')
                          ? 'Registration Rejected'
                          : 'Authentication Failed'}
                      </h4>
                      <p className="mt-0.5 leading-relaxed">{loginError}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Official Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="officer@nyayavault.gov.in"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 font-medium transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
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
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 font-medium pr-10 transition-colors"
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
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 mt-2"
                >
                  {loading ? 'Authenticating...' : 'Sign In to NyayaVault'}
                </button>
              </form>
            ) : mode === 'REGISTER' ? (
              /* Registration Form */
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-white">Request Official Account</h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Submitted requests require review and role authorization by an official administrator.
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
                      <label className="text-xs font-semibold text-slate-300">Official Email</label>
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
                        <option value="SUPERVISOR font-medium">Supervising Officer (Superintendent)</option>
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
            ) : (
              /* Forgot Password Form */
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
                    <p className="text-[11px] text-slate-400">Request password reset instructions</p>
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
                      Enter your registered official email address. A secure single-use recovery link will be issued.
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
                      {resetSubmitting ? 'Sending Request...' : 'Send Reset Link'}
                    </button>
                  </>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
