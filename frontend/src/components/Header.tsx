import React, { useState, useEffect, useRef } from 'react';
import { Shield, User as UserIcon, LogOut, ShieldCheck, KeyRound, Search, Briefcase, FileText, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RoleName, Case, Document } from '../types';
import { api } from '../services/api';

interface HeaderProps {
  onSelectCase?: (caseId: string) => void;
  onSelectDocument?: (docId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onSelectCase, onSelectDocument }) => {
  const { user, logout } = useAuth();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchPopover, setShowSearchPopover] = useState(false);
  const [matchingCases, setMatchingCases] = useState<Case[]>([]);
  const [matchingDocs, setMatchingDocs] = useState<Document[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  const roleColors: Record<RoleName, string> = {
    ADMIN: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    INVESTIGATING_OFFICER: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    SUPERVISOR: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    PROSECUTOR: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  };

  // Close search popover on outside click
  useEffect(() => {
    const handleClickOutside = (evt: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(evt.target as Node)) {
        setShowSearchPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search logic over authorized backend endpoints
  useEffect(() => {
    if (!user || searchQuery.trim().length < 2) {
      setMatchingCases([]);
      setMatchingDocs([]);
      setShowSearchPopover(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setShowSearchPopover(true);
      try {
        const [casesRes, docsRes] = await Promise.all([
          api.getCases().catch(() => []),
          api.searchDocuments({ q: searchQuery.trim(), limit: 5 }).catch(() => ({ data: [] })),
        ]);

        const q = searchQuery.toLowerCase();
        const filteredCases = casesRes
          .filter(
            (c) =>
              c.caseNumber.toLowerCase().includes(q) ||
              c.title.toLowerCase().includes(q) ||
              (c.description && c.description.toLowerCase().includes(q))
          )
          .slice(0, 5);

        setMatchingCases(filteredCases);
        setMatchingDocs(docsRes.data || []);
      } catch (_) {
        setMatchingCases([]);
        setMatchingDocs([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, user]);

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    setSubmitting(true);
    try {
      await api.changePassword(currentPassword, newPassword, confirmPassword);
      alert('Password updated successfully.');
      setIsPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 font-sans">
      {/* Brand & System Title */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 shadow-lg shadow-amber-500/10">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            NyayaVault
          </h1>
          <p className="text-xs text-slate-400 font-semibold tracking-wide">
            Digital Evidence Management System
          </p>
        </div>
      </div>

      {/* Global Search Bar (Authorized Scoped) */}
      {user && (
        <div ref={searchRef} className="relative flex-1 max-w-md mx-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchQuery.trim().length >= 2) setShowSearchPopover(true);
              }}
              placeholder="Search authorized cases & evidence files..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Popover Drawer */}
          {showSearchPopover && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 p-2 text-xs space-y-2">
              {isSearching ? (
                <div className="p-4 text-center text-slate-400 flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <span>Searching authorized records...</span>
                </div>
              ) : matchingCases.length === 0 && matchingDocs.length === 0 ? (
                <div className="p-4 text-center text-slate-500 font-medium">
                  No matching authorized cases or evidence files found.
                </div>
              ) : (
                <div className="max-h-[320px] overflow-y-auto space-y-3 p-1">
                  {/* Cases Section */}
                  {matchingCases.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider px-2 flex items-center gap-1.5">
                        <Briefcase className="w-3 h-3" />
                        <span>Investigation Cases ({matchingCases.length})</span>
                      </div>
                      {matchingCases.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setShowSearchPopover(false);
                            setSearchQuery('');
                            if (onSelectCase) onSelectCase(c.id);
                          }}
                          className="w-full text-left p-2 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-between group cursor-pointer"
                        >
                          <div className="space-y-0.5 truncate pr-2">
                            <div className="text-xs font-bold text-slate-100 group-hover:text-amber-300 truncate">
                              {c.title}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              {c.caseNumber} &bull; {c.status}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded shrink-0">
                            OPEN
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Evidence Files Section */}
                  {matchingDocs.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-slate-800/80">
                      <div className="text-[10px] font-mono font-bold text-sky-400 uppercase tracking-wider px-2 flex items-center gap-1.5">
                        <FileText className="w-3 h-3" />
                        <span>Evidence Files ({matchingDocs.length})</span>
                      </div>
                      {matchingDocs.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => {
                            setShowSearchPopover(false);
                            setSearchQuery('');
                            if (onSelectDocument) onSelectDocument(d.id);
                          }}
                          className="w-full text-left p-2 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-between group cursor-pointer"
                        >
                          <div className="space-y-0.5 truncate pr-2">
                            <div className="text-xs font-bold text-slate-100 group-hover:text-sky-300 truncate">
                              {d.title}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              {d.documentType} &bull; {d.classification}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded shrink-0">
                            VIEW
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* User Profile & Actions */}
      {user && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
            <UserIcon className="w-4 h-4 text-slate-400" />
            <div className="text-right leading-none">
              <div className="text-xs font-bold text-slate-200">{user.fullName}</div>
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
            onClick={() => setIsPasswordModalOpen(true)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
            title="Change password"
          >
            <KeyRound className="w-4 h-4" />
          </button>

          <button
            onClick={() => logout()}
            className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 border border-slate-700 transition-all cursor-pointer"
            title="Logout session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                Change Account Password
              </h3>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handlePasswordChangeSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">New Password (min 8 chars)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
