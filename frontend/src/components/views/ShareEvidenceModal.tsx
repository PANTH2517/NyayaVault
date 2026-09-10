import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Share2,
  X,
  UserCheck,
  Clock,
  Key,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
  Ban,
  RefreshCw,
  Lock,
  Link as LinkIcon,
} from 'lucide-react';
import { api } from '../../services/api';
import { User, EvidenceShareItem } from '../../types';

interface ShareEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  versionId: string;
  documentTitle: string;
  versionNumber: number;
  caseId: string;
}

export const ShareEvidenceModal: React.FC<ShareEvidenceModalProps> = ({
  isOpen,
  onClose,
  versionId,
  documentTitle,
  versionNumber,
  caseId,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  // Recipient selection & creation states
  const [eligibleRecipients, setEligibleRecipients] = useState<User[]>([]);
  const [selectedTargetUserId, setSelectedTargetUserId] = useState<string>('');
  const [expirationHours, setExpirationHours] = useState<number>(24);
  const [loadingRecipients, setLoadingRecipients] = useState<boolean>(false);
  const [creatingShare, setCreatingShare] = useState<boolean>(false);

  // Generated secret state (Raw token shown ONCE only, never persisted)
  const [createdSecret, setCreatedSecret] = useState<{
    shareId: string;
    rawToken: string;
    expiresAt: string;
    targetUser: User;
  } | null>(null);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Shares history state
  const [sharesHistory, setSharesHistory] = useState<EvidenceShareItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [revokingShareId, setRevokingShareId] = useState<string | null>(null);

  // General error state
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setCreatedSecret(null);
      setCopiedToken(false);
      setCopiedLink(false);
      fetchEligibleRecipients();
      fetchSharesHistory();
    }
  }, [isOpen, versionId, caseId]);

  const fetchEligibleRecipients = async () => {
    setLoadingRecipients(true);
    try {
      const recipients = await api.getEligibleRecipients(caseId);
      setEligibleRecipients(recipients);
      if (recipients.length > 0) {
        setSelectedTargetUserId(recipients[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load eligible case recipients');
    } finally {
      setLoadingRecipients(false);
    }
  };

  const fetchSharesHistory = async () => {
    setLoadingHistory(true);
    try {
      const history = await api.getSharesForVersion(versionId);
      setSharesHistory(history);
    } catch (err: any) {
      // Non-critical, ignore or set soft error
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetUserId) {
      setError('Please select a recipient');
      return;
    }

    setCreatingShare(true);
    setError(null);
    try {
      const res = await api.createShare(versionId, selectedTargetUserId, expirationHours);
      setCreatedSecret(res);
      fetchSharesHistory();
    } catch (err: any) {
      setError(err.message || 'Failed to generate time-bound evidence share');
    } finally {
      setCreatingShare(false);
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    setRevokingShareId(shareId);
    try {
      await api.revokeShare(shareId);
      await fetchSharesHistory();
    } catch (err: any) {
      setError(err.message || 'Failed to revoke evidence share');
    } finally {
      setRevokingShareId(null);
    }
  };

  if (!isOpen) return null;

  const shareUrl = createdSecret
    ? `${window.location.origin}/#/shared-evidence#token=${createdSecret.rawToken}`
    : '';

  const copyToClipboard = (text: string, type: 'token' | 'link') => {
    navigator.clipboard.writeText(text);
    if (type === 'token') {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Time-Bound Evidence Sharing</h3>
              <p className="text-[11px] text-slate-400 font-mono">
                {documentTitle} &bull; v{versionNumber}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection Bar */}
        <div className="grid grid-cols-2 border-b border-slate-800 text-xs font-bold bg-slate-950/40">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`py-3 border-r border-slate-800 flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'create'
                ? 'bg-amber-500/10 text-amber-400 border-b-2 border-b-amber-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Generate New Share</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              fetchSharesHistory();
            }}
            className={`py-3 flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'bg-amber-500/10 text-amber-400 border-b-2 border-b-amber-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Share History & Revocation ({sharesHistory.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: CREATE SHARE */}
          {activeTab === 'create' && (
            <>
              {!createdSecret ? (
                <form onSubmit={handleCreateShare} className="space-y-5">
                  <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-slate-300 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-400">
                      <Lock className="w-3.5 h-3.5" />
                      Cryptographic Evidence Transport Security
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Share access is strictly bound to case-assigned active personnel. Only the hashed token is saved server-side.
                    </p>
                  </div>

                  {/* Recipient Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-amber-400" />
                      Target Recipient (Assigned Personnel Only) *
                    </label>
                    {loadingRecipients ? (
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 animate-pulse">
                        Loading assigned case personnel...
                      </div>
                    ) : eligibleRecipients.length === 0 ? (
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-rose-400">
                        No active assigned case recipients available for sharing.
                      </div>
                    ) : (
                      <select
                        value={selectedTargetUserId}
                        onChange={(e) => setSelectedTargetUserId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                      >
                        {eligibleRecipients.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.fullName} ({user.role}) — {user.email}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Expiration Window Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-400" />
                      Access Expiration Window *
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {[
                        { hours: 1, label: '1 Hour' },
                        { hours: 6, label: '6 Hours' },
                        { hours: 12, label: '12 Hours' },
                        { hours: 24, label: '24 Hours' },
                        { hours: 72, label: '3 Days' },
                        { hours: 168, label: '7 Days' },
                      ].map((opt) => (
                        <button
                          key={opt.hours}
                          type="button"
                          onClick={() => setExpirationHours(opt.hours)}
                          className={`py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                            expirationHours === opt.hours
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={creatingShare || eligibleRecipients.length === 0}
                    className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{creatingShare ? 'Generating Token...' : 'Generate Secure Time-Bound Share'}</span>
                  </button>
                </form>
              ) : (
                /* ONE-TIME SECRET DISPLAY PANEL */
                <div className="space-y-5">
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs space-y-1">
                    <div className="flex items-center gap-2 font-extrabold text-sm">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      Time-Bound Share Credentials Generated
                    </div>
                    <p className="text-slate-300 text-[11px]">
                      Share ID: <span className="font-mono text-emerald-300">{createdSecret.shareId}</span> &bull; Expires:{' '}
                      <span className="font-mono">{new Date(createdSecret.expiresAt).toLocaleString()}</span>
                    </p>
                  </div>

                  {/* WARNING BANNER */}
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      CRITICAL ONE-TIME DISPLAY WARNING
                    </div>
                    <p className="text-[11px] text-slate-300">
                      The raw token below will <strong className="text-white">NEVER be shown again</strong>. Only the SHA-256 hash is saved. Copy it now and deliver it securely to recipient <strong className="text-amber-400">{createdSecret.targetUser.fullName}</strong>.
                    </p>
                  </div>

                  {/* RAW TOKEN CONTAINER */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                      <span>Raw Access Token (32 Cryptographic Bytes)</span>
                      <span className="text-[10px] text-amber-400 font-mono">64 Hex Chars</span>
                    </label>
                    <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <input
                        type="text"
                        readOnly
                        value={createdSecret.rawToken}
                        className="w-full bg-transparent font-mono text-xs text-amber-400 focus:outline-none select-all"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(createdSecret.rawToken, 'token')}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-400 text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedToken ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedToken ? 'Copied' : 'Copy Token'}</span>
                      </button>
                    </div>
                  </div>

                  {/* SHARE LINK CONTAINER */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                      <span>Frontend Direct Share Link (Fragment Only)</span>
                      <span className="text-[10px] font-mono text-emerald-400">#token=&lt;secret&gt;</span>
                    </label>
                    <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-1.5 w-full overflow-hidden text-xs font-mono text-slate-300">
                        <LinkIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="truncate">{shareUrl}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(shareUrl, 'link')}
                        className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-400 text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCreatedSecret(null)}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Done / Create Another Share
                  </button>
                </div>
              )}
            </>
          )}

          {/* TAB 2: SHARE HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Historical Share Registry for Version {versionNumber}</span>
                <button
                  type="button"
                  onClick={fetchSharesHistory}
                  className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {loadingHistory ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Fetching historical share registry...
                </div>
              ) : sharesHistory.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No time-bound shares have been generated for this evidence version.
                </div>
              ) : (
                <div className="space-y-3">
                  {sharesHistory.map((share) => (
                    <div
                      key={share.id}
                      className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">
                            Recipient: {share.targetUser.fullName} ({share.targetUser.role})
                          </span>
                          {share.status === 'ACTIVE' && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold font-mono">
                              ACTIVE
                            </span>
                          )}
                          {share.status === 'EXPIRED' && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-extrabold font-mono">
                              EXPIRED
                            </span>
                          )}
                          {share.status === 'REVOKED' && (
                            <span className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-extrabold font-mono">
                              REVOKED
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono">
                          <span>Issued by: {share.issuedBy.fullName}</span>
                          <span>Created: {new Date(share.createdAt).toLocaleString()}</span>
                          <span>Expires: {new Date(share.expiresAt).toLocaleString()}</span>
                          {share.revokedAt && (
                            <span className="text-rose-400">
                              Revoked at: {new Date(share.revokedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {share.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => handleRevokeShare(share.id)}
                          disabled={revokingShareId === share.id}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>{revokingShareId === share.id ? 'Revoking...' : 'Revoke Share'}</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
