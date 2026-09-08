import React, { useState, useEffect } from 'react';
import { Shield, KeyRound, AlertCircle, CheckCircle2, RefreshCw, X, ShieldAlert, Lock, Trash2, Copy } from 'lucide-react';
import { api } from '../../services/api';
import { MfaEnrollmentModal } from './MfaEnrollmentModal';

interface MfaSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MfaSettingsModal: React.FC<MfaSettingsModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<{ enabled: boolean; enrolledAt: string | null; recoveryCodesRemaining: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sub-modals & actions
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Form inputs for Disable / Regenerate
  const [currentPassword, setCurrentPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Regenerated recovery codes display
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[]>([]);
  const [copiedCodes, setCopiedCodes] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMfaStatus();
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch MFA status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setIsDisabling(false);
      setIsRegenerating(false);
      setNewRecoveryCodes([]);
      setCurrentPassword('');
      setTotpCode('');
      setActionError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError(null);
    try {
      await api.disableMfa(currentPassword, totpCode.trim());
      alert('Multi-Factor Authentication has been disabled.');
      setIsDisabling(false);
      fetchStatus();
    } catch (err: any) {
      setActionError(err.message || 'Failed to disable MFA. Check password and TOTP code.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerateRecoveryCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await api.regenerateRecoveryCodes(currentPassword, totpCode.trim());
      setNewRecoveryCodes(res.recoveryCodes || []);
      fetchStatus();
    } catch (err: any) {
      setActionError(err.message || 'Failed to regenerate recovery codes.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Multi-Factor Security (MFA)</h3>
            <p className="text-xs text-slate-400">RFC 6238 TOTP Protection</p>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span>Checking security configuration...</span>
          </div>
        ) : isDisabling ? (
          <form onSubmit={handleDisableMfa} className="space-y-4 text-xs">
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 font-medium">
              <div className="font-bold flex items-center gap-1.5 text-rose-400">
                <Trash2 className="w-4 h-4" />
                <span>Disable Multi-Factor Authentication</span>
              </div>
              <p className="text-[11px] mt-1">
                Disabling MFA reduces account security. You will be required to confirm your password and a valid TOTP code.
              </p>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold">
                {actionError}
              </div>
            )}

            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Authentication Code (TOTP or Recovery)</label>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                required
                placeholder="123456"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono text-center tracking-widest text-base focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDisabling(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading || !currentPassword || !totpCode.trim()}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Disabling...' : 'Confirm Disable MFA'}
              </button>
            </div>
          </form>
        ) : isRegenerating ? (
          <div className="space-y-4 text-xs">
            {newRecoveryCodes.length > 0 ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-amber-400 text-sm">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-amber-400" />
                    <span>New Recovery Codes Generated</span>
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    Previous recovery codes have been invalidated. Save these new single-use recovery codes safely.
                  </p>
                </div>

                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 font-mono text-xs text-amber-300 grid grid-cols-2 gap-2 text-center font-bold tracking-wider">
                  {newRecoveryCodes.map((code, idx) => (
                    <div key={idx} className="p-1.5 bg-slate-900 rounded-lg border border-slate-800/80">
                      {code}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(newRecoveryCodes.join('\n'));
                      setCopiedCodes(true);
                      setTimeout(() => setCopiedCodes(false), 3000);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-bold text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copiedCodes ? 'Copied!' : 'Copy Codes'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsRegenerating(false)}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegenerateRecoveryCodes} className="space-y-4">
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-medium">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4" />
                    <span>Regenerate Emergency Recovery Codes</span>
                  </div>
                  <p className="text-[11px] mt-1">
                    This will immediately invalidate all existing recovery codes and generate 8 new single-use codes.
                  </p>
                </div>

                {actionError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold">
                    {actionError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Current TOTP Code</label>
                  <input
                    type="text"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    required
                    placeholder="123456"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono text-center tracking-widest text-base focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRegenerating(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !currentPassword || !totpCode.trim()}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? 'Regenerating...' : 'Generate New Codes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-5 text-xs">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-400">MFA Status</span>
                {status?.enabled ? (
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Enabled</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 font-bold text-xs">
                    Disabled
                  </span>
                )}
              </div>

              {status?.enabled && (
                <>
                  <div className="flex items-center justify-between text-slate-300 pt-2 border-t border-slate-800">
                    <span className="text-slate-400">Enrolled On</span>
                    <span className="font-mono">{status.enrolledAt ? new Date(status.enrolledAt).toLocaleDateString() : 'Active'}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Unused Recovery Codes</span>
                    <span className="font-mono text-amber-400 font-bold">{status.recoveryCodesRemaining} remaining</span>
                  </div>
                </>
              )}
            </div>

            {status?.enabled ? (
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => {
                    setIsRegenerating(true);
                    setCurrentPassword('');
                    setTotpCode('');
                    setActionError(null);
                    setNewRecoveryCodes([]);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Regenerate Emergency Recovery Codes</span>
                </button>

                <button
                  onClick={() => {
                    setIsDisabling(true);
                    setCurrentPassword('');
                    setTotpCode('');
                    setActionError(null);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Disable Multi-Factor Authentication</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEnrolling(true)}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Lock className="w-4 h-4" />
                <span>Enable Multi-Factor Authentication</span>
              </button>
            )}
          </div>
        )}

        <MfaEnrollmentModal
          isOpen={isEnrolling}
          onClose={() => setIsEnrolling(false)}
          onSuccess={() => {
            setIsEnrolling(false);
            fetchStatus();
          }}
        />
      </div>
    </div>
  );
};
