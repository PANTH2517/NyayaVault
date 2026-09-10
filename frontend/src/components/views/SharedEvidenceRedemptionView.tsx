import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Download,
  AlertTriangle,
  Lock,
  FileCheck,
  X,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../services/api';

interface SharedEvidenceRedemptionViewProps {
  initialToken?: string;
  onClose?: () => void;
}

export const SharedEvidenceRedemptionView: React.FC<SharedEvidenceRedemptionViewProps> = ({
  initialToken,
  onClose,
}) => {
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<{
    filename: string;
    sha256Hash?: string;
  } | null>(null);

  useEffect(() => {
    // Extract token secret strictly from URL fragment (#token=<secret>)
    let extractedToken = initialToken || '';
    if (!extractedToken && window.location.hash) {
      const match = window.location.hash.match(/token=([a-fA-F0-9]{64})/);
      if (match && match[1]) {
        extractedToken = match[1];
      }
    }
    setToken(extractedToken);
  }, [initialToken]);

  const handleRedeem = async () => {
    if (!token || token.length !== 64) {
      setError('Invalid or missing 64-character hex share token');
      return;
    }

    setLoading(true);
    setError(null);
    setDownloadSuccess(null);

    try {
      const result = await api.accessSharedEvidence(token);

      // Trigger browser file download
      const url = window.URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloadSuccess({
        filename: result.filename,
        sha256Hash: result.sha256Hash,
      });

      // Clear sensitive token fragment from browser location history
      if (window.location.hash.includes('token=')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid or unusable evidence share token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Redeem Shared Evidence</h3>
              <p className="text-[11px] text-slate-400">Time-Bound Secret Verification</p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {downloadSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                Evidence Retrieved & SHA-256 Verified
              </div>
              <p className="text-[11px] text-slate-300">
                Downloaded file: <strong className="text-white">{downloadSuccess.filename}</strong>
              </p>
              {downloadSuccess.sha256Hash && (
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[10px] text-emerald-400 break-all">
                  SHA-256: {downloadSuccess.sha256Hash}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3 text-xs text-slate-300">
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Authoritative Redemption Policy
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Redemption requires an authenticated session belonging strictly to the designated recipient user.
                The server will verify recipient identity, case permissions, revocation, expiration, and dynamic SHA-256 evidence integrity before releasing bytes.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Share Token (Hex)</label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter 64-character raw share token..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-amber-400 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleRedeem}
            disabled={loading || !token}
            className="ml-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{loading ? 'Verifying & Downloading...' : 'Redeem & Download Evidence'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
