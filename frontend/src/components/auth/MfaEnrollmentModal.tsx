import React, { useState, useEffect } from 'react';
import { Shield, KeyRound, AlertCircle, CheckCircle2, Copy, RefreshCw, X, ShieldAlert } from 'lucide-react';
import { api } from '../../services/api';

interface MfaEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'PASSWORD' | 'SCAN_QR' | 'RECOVERY_CODES';

export const MfaEnrollmentModal: React.FC<MfaEnrollmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<Step>('PASSWORD');
  const [currentPassword, setCurrentPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enrollment data from backend
  const [enrollData, setEnrollData] = useState<{ qrCodeUrl: string; secret: string; otpauthUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');

  // Generated recovery codes (returned ONCE after confirmation)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copiedCodes, setCopiedCodes] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStep('PASSWORD');
      setCurrentPassword('');
      setLoading(false);
      setError(null);
      setEnrollData(null);
      setTotpCode('');
      setRecoveryCodes([]);
      setCopiedCodes(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInitiateEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.enrollMfa(currentPassword);
      setEnrollData(data);
      setStep('SCAN_QR');
    } catch (err: any) {
      setError(err.message || 'Failed to initiate MFA enrollment. Check password.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.confirmMfaEnrollment(totpCode.trim());
      setRecoveryCodes(res.recoveryCodes || []);
      setStep('RECOVERY_CODES');
    } catch (err: any) {
      setError(err.message || 'Invalid authentication code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 3000);
  };

  const handleFinish = () => {
    onSuccess();
    onClose();
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
            <h3 className="text-lg font-bold text-white">Enable Multi-Factor Authentication</h3>
            <p className="text-xs text-slate-400">TOTP Authenticator Setup</p>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 'PASSWORD' && (
          <form onSubmit={handleInitiateEnrollment} className="space-y-4 text-xs">
            <p className="text-slate-300 leading-relaxed">
              Confirm your current account password to initiate multi-factor authentication setup.
            </p>

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

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !currentPassword}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Verifying Password...' : 'Next: Scan QR Code'}
              </button>
            </div>
          </form>
        )}

        {step === 'SCAN_QR' && enrollData && (
          <form onSubmit={handleConfirmEnrollment} className="space-y-4 text-xs">
            <div className="text-center space-y-3">
              <p className="text-slate-300 leading-relaxed">
                Scan this QR code using Google Authenticator, Microsoft Authenticator, or any standard TOTP app.
              </p>

              {/* QR Code Container */}
              <div className="inline-block p-3 bg-white rounded-2xl border-4 border-slate-800 shadow-xl">
                <img
                  src={enrollData.qrCodeUrl}
                  alt="MFA QR Code"
                  className="w-44 h-44 mx-auto"
                />
              </div>

              {/* Manual Secret Key */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider font-bold">Manual Setup Key</p>
                <p className="font-mono text-amber-400 font-bold tracking-widest text-sm select-all">
                  {enrollData.secret}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-300">6-Digit Verification Code</label>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                required
                maxLength={6}
                placeholder="123456"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-center tracking-widest text-lg font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('PASSWORD')}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || totpCode.trim().length !== 6}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Enabling MFA...' : 'Confirm & Enable MFA'}
              </button>
            </div>
          </form>
        )}

        {step === 'RECOVERY_CODES' && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-400 text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-amber-400" />
                <span>Multi-Factor Authentication Enabled</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Save these emergency recovery codes in a secure location (e.g. password manager). They will <strong>NEVER</strong> be displayed again.
              </p>
            </div>

            {/* Recovery Codes Grid */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 font-mono text-xs text-amber-300 grid grid-cols-2 gap-2 text-center font-bold tracking-wider">
              {recoveryCodes.map((code, idx) => (
                <div key={idx} className="p-1.5 bg-slate-900 rounded-lg border border-slate-800/80">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleCopyRecoveryCodes}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Copy className="w-4 h-4" />
                <span>{copiedCodes ? 'Copied to Clipboard!' : 'Copy Recovery Codes'}</span>
              </button>

              <button
                type="button"
                onClick={handleFinish}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow-lg shadow-amber-500/20"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
