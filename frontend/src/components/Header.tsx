import React from 'react';
import { Shield, User as UserIcon, LogOut, ShieldCheck, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RoleName } from '../types';

export const Header: React.FC = () => {
  const { user, logout, switchDemoRole, loading } = useAuth();

  const roleColors: Record<RoleName, string> = {
    ADMIN: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    INVESTIGATING_OFFICER: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    SUPERVISOR: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    PROSECUTOR: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
      {/* Brand & Conceptual Tagline */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 shadow-lg shadow-amber-500/10">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            NyayaVault
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              Government Grade
            </span>
          </h1>
          <p className="text-xs text-amber-400/90 font-medium tracking-wide">
            Secure Evidence. Trusted Justice.
          </p>
        </div>
      </div>

      {/* Quick Authentic Demo Role Switcher */}
      {user && (
        <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <Zap className="w-3 h-3 text-amber-400" />
            Demo Auth:
          </div>
          {(['INVESTIGATING_OFFICER', 'SUPERVISOR', 'PROSECUTOR', 'ADMIN'] as RoleName[]).map((r) => {
            const isActive = user.role === r;
            return (
              <button
                key={r}
                onClick={() => switchDemoRole(r)}
                disabled={loading || isActive}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
                title={`Authenticate as ${r} via backend JWT login`}
              >
                {r === 'INVESTIGATING_OFFICER' ? 'IO' : r === 'SUPERVISOR' ? 'SUPER' : r}
              </button>
            );
          })}
        </div>
      )}

      {/* Authenticated User Profile Badge & Logout */}
      {user && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
            <UserIcon className="w-4 h-4 text-slate-400" />
            <div className="text-right leading-none">
              <div className="text-xs font-semibold text-slate-200">{user.fullName}</div>
              <div className="text-[10px] text-slate-400">{user.email}</div>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                roleColors[user.role]
              }`}
            >
              {user.role}
            </span>
          </div>

          <button
            onClick={logout}
            className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 border border-slate-700 transition-colors cursor-pointer"
            title="Logout session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </header>
  );
};
