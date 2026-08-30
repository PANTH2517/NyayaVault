import React, { useEffect, useState } from 'react';
import {
  History,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  Zap,
  Activity,
  AlertCircle,
  FileCode,
  Lock,
} from 'lucide-react';
import { api } from '../../services/api';
import { AuditEvent } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const AuditTrailView: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Audit Chain Verification Modal State
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean;
    totalEvents?: number;
    brokenAtSequence?: number;
    reason?: string;
    checkedAt: string;
  } | null>(null);

  // Tamper Simulator Modal State
  const [isTamperOpen, setIsTamperOpen] = useState(false);
  const [tamperVersionId, setTamperVersionId] = useState('');
  const [tampering, setTampering] = useState(false);
  const [tamperSuccessMsg, setTamperSuccessMsg] = useState<string | null>(null);

  // Hash Copy State
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [fullHashModal, setFullHashModal] = useState<AuditEvent | null>(null);

  const loadAuditTrail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAuditEvents();
      setEvents(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch audit events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditTrail();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleVerifyChain = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await api.verifyAuditChain();
      setVerifyResult(res);
    } catch (err: any) {
      alert(`Audit verification failed: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  const handleSimulateTamper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tamperVersionId.trim()) {
      alert('Please enter a valid Document Version UUID');
      return;
    }
    setTampering(true);
    setTamperSuccessMsg(null);
    try {
      const res = await api.simulateTamper(tamperVersionId.trim());
      setTamperSuccessMsg(res.message);
      setIsTamperOpen(false);
      setTamperVersionId('');
      loadAuditTrail();
    } catch (err: any) {
      alert(`Tamper simulation failed: ${err.message}`);
    } finally {
      setTampering(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-amber-400" />
            Hash-Chained Audit Trail & Cryptographic Verification
          </h2>
          <p className="text-xs text-slate-400">
            Tamper-evident audit chain derived via SHA256(Data || H_prev).
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {user?.role === 'ADMIN' && (
            <>
              <button
                onClick={() => setIsTamperOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold border border-rose-500/40 transition-all cursor-pointer"
                title="Hackathon controlled byte tampering demonstration tool"
              >
                <Zap className="w-4 h-4 text-rose-400" />
                <span>Tamper Simulator (Demo)</span>
              </button>

              <button
                onClick={handleVerifyChain}
                disabled={verifying}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{verifying ? 'Verifying Chain...' : 'VERIFY AUDIT CHAIN'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tamper Success Alert Notice */}
      {tamperSuccessMsg && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs space-y-1">
          <div className="font-bold text-rose-400 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Tamper Simulation Triggered
          </div>
          <p className="text-[11px] leading-relaxed">{tamperSuccessMsg}</p>
        </div>
      )}

      {/* Audit Chain Verification Modal/Banner Result */}
      {verifyResult && (
        <div
          className={`p-5 rounded-2xl border text-xs space-y-2 shadow-2xl ${
            verifyResult.valid
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-extrabold text-sm">
              {verifyResult.valid ? (
                <>
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>AUDIT CHAIN VERIFIED</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-5 h-5 text-rose-400" />
                  <span>AUDIT CHAIN VERIFICATION FAILED</span>
                </>
              )}
            </div>

            <button
              onClick={() => setVerifyResult(null)}
              className="text-[11px] font-bold text-slate-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>

          {verifyResult.valid ? (
            <p className="text-xs text-emerald-300 font-semibold">
              No cryptographic inconsistencies detected across {verifyResult.totalEvents} audit events. (Checked at {new Date(verifyResult.checkedAt).toLocaleTimeString()})
            </p>
          ) : (
            <div className="font-mono text-xs space-y-1 text-rose-300">
              <div>&bull; Broken Sequence Number: #{verifyResult.brokenAtSequence}</div>
              <div>&bull; Discrepancy Reason: {verifyResult.reason}</div>
              <div>&bull; Incident Created: AUDIT_CHAIN_VERIFICATION_FAILED security incident appended.</div>
            </div>
          )}
        </div>
      )}

      {/* Audit Events Timeline List */}
      {loading ? (
        <div className="text-center py-16 text-xs text-slate-400">Loading audit trail...</div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          {error}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
          No audit events logged yet.
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((evt) => (
            <div
              key={evt.id}
              className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 shadow-lg hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 text-xs shrink-0">
                    Seq #{evt.sequenceNumber}
                  </span>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {evt.eventType}
                    </span>
                    <h3 className="font-bold text-white text-sm mt-1">{evt.action}</h3>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-400">
                  <div>User: <strong className="text-slate-200">{evt.user?.fullName || 'System'}</strong> ({evt.user?.role || 'SYSTEM'})</div>
                  <div>{new Date(evt.createdAt).toLocaleString()}</div>
                </div>
              </div>

              {/* Truncated Cryptographic Hashes (Requirement 6: Readable UI with copy & full view) */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="flex items-center justify-between text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500">Previous Hash:</span>
                  <span className="text-slate-300 truncate max-w-[160px]">
                    {evt.previousEventHash
                      ? `${evt.previousEventHash.substring(0, 14)}...`
                      : 'GENESIS'}
                  </span>
                  {evt.previousEventHash && (
                    <button
                      onClick={() => handleCopy(evt.previousEventHash!)}
                      className="text-amber-400 hover:text-amber-300 ml-1 cursor-pointer"
                      title="Copy Previous Hash"
                    >
                      {copiedHash === evt.previousEventHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500">Current Event Hash:</span>
                  <span className="text-amber-400 font-semibold truncate max-w-[160px]">
                    {evt.currentEventHash.substring(0, 14)}...
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopy(evt.currentEventHash)}
                      className="text-amber-400 hover:text-amber-300 cursor-pointer"
                      title="Copy Current Hash"
                    >
                      {copiedHash === evt.currentEventHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => setFullHashModal(evt)}
                      className="text-[10px] font-sans font-semibold text-slate-400 hover:text-white underline ml-1 cursor-pointer"
                    >
                      Full Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Audit Event Detail Modal */}
      {fullHashModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl font-mono text-xs text-slate-300">
            <div className="flex items-center justify-between font-sans text-white font-bold border-b border-slate-800 pb-3">
              <span className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-amber-400" />
                Audit Event Record #{fullHashModal.sequenceNumber}
              </span>
              <button
                onClick={() => setFullHashModal(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-2">
              <div><strong>Event Type:</strong> {fullHashModal.eventType}</div>
              <div><strong>Action:</strong> {fullHashModal.action}</div>
              <div><strong>User:</strong> {fullHashModal.user?.fullName} ({fullHashModal.user?.email})</div>
              <div><strong>Timestamp:</strong> {new Date(fullHashModal.createdAt).toISOString()}</div>
              <div>
                <strong>Previous Event Hash:</strong>
                <div className="bg-slate-950 p-2 rounded text-slate-400 break-all select-all mt-1">
                  {fullHashModal.previousEventHash || 'GENESIS_HASH'}
                </div>
              </div>
              <div>
                <strong>Current Event Hash:</strong>
                <div className="bg-slate-950 p-2 rounded text-amber-300 break-all select-all mt-1">
                  {fullHashModal.currentEventHash}
                </div>
              </div>
              {fullHashModal.metadata && (
                <div>
                  <strong>Metadata JSON:</strong>
                  <pre className="bg-slate-950 p-2 rounded text-slate-400 mt-1 overflow-x-auto text-[11px]">
                    {JSON.stringify(fullHashModal.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tamper Simulator Modal */}
      {isTamperOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-rose-400 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Tamper Simulator (Hackathon Demo Tool)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Mutates <strong>ONLY</strong> the stored file bytes in storage for a given document version. Database SHA-256 hash and audit logs remain <strong>UNTOUCHED</strong>.
              </p>
            </div>

            <form onSubmit={handleSimulateTamper} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Target Document Version UUID</label>
                <input
                  type="text"
                  value={tamperVersionId}
                  onChange={(e) => setTamperVersionId(e.target.value)}
                  required
                  placeholder="Paste DocumentVersion ID UUID"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px]">
                Expected behavior: The next time any user attempts to download or verify this document version, the system will compute SHA-256 from modified bytes, detect a hash mismatch, trigger <strong>403 ACCESS BLOCKED</strong>, flag <strong>INTEGRITY COMPROMISED</strong>, and record a <strong>CRITICAL Security Incident</strong>!
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTamperOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={tampering}
                  className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
                >
                  {tampering ? 'Mutating Storage Bytes...' : 'Mutate Storage File Bytes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
