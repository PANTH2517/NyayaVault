import React, { useState } from 'react';
import { Shield, Lock, Key, AlertCircle, ArrowRight, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RoleName } from '../../types';

export const LoginView: React.FC = () => {
  const { login, switchDemoRole, loading } = useAuth();
  const [email, setEmail] = useState('admin@nyayavault.gov.in');
  const [password, setPassword] = useState('Admin@Nyaya2026');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    }
  };

  const handleQuickLogin = async (role: RoleName) => {
    setError(null);
    try {
      await switchDemoRole(role);
    } catch (err: any) {
      setError(err.message || `Quick login for ${role} failed`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 relative font-sans">
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full space-y-6">
        {/* Logo Branding Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 shadow-xl shadow-amber-500/10">
            <Shield className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            NyayaVault
          </h1>
          <p className="text-xs text-amber-400 font-semibold tracking-wider uppercase">
            Secure Evidence. Trusted Justice.
          </p>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Government-Grade Digital Evidence & Document Security Management System
          </p>
        </div>

        {/* Login Form Container */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 space-y-6 shadow-2xl backdrop-blur-md">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Official Email</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="user@nyayavault.gov.in"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Argon2 Hashed Password</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In with Credentials'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
              <span className="bg-slate-900 px-3 text-slate-500">
                Hackathon Demo Quick Login (Authentic JWT)
              </span>
            </div>
          </div>

          {/* Quick Login Role Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => handleQuickLogin('ADMIN')}
              disabled={loading}
              className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800/80 hover:border-rose-500/40 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-rose-400 font-bold text-xs">
                <span>ADMIN</span>
                <UserCheck className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">System Admin</p>
            </button>

            <button
              onClick={() => handleQuickLogin('INVESTIGATING_OFFICER')}
              disabled={loading}
              className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800/80 hover:border-amber-500/40 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-amber-400 font-bold text-xs">
                <span>OFFICER</span>
                <UserCheck className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Inspector Sharma</p>
            </button>

            <button
              onClick={() => handleQuickLogin('SUPERVISOR')}
              disabled={loading}
              className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800/80 hover:border-emerald-500/40 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-emerald-400 font-bold text-xs">
                <span>SUPERVISOR</span>
                <UserCheck className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Supt. Verma</p>
            </button>

            <button
              onClick={() => handleQuickLogin('PROSECUTOR')}
              disabled={loading}
              className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800/80 hover:border-sky-500/40 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-sky-400 font-bold text-xs">
                <span>PROSECUTOR</span>
                <UserCheck className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Prosecutor Mehta</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
