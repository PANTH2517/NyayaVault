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
  Search,
  Filter,
  ArrowRight,
  Shield,
  FileText,
  User,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { api } from '../../services/api';
import { AuditEvent } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { MotionCard, MotionReveal, MotionStagger, MotionStatus } from '../motion';

export const AuditTrailView: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Client-side filter & search state
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Audit Chain Verification State
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

  // Hash Copy State & Details Modal
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

  // Filter events client-side without API modifications
  const filteredEvents = events.filter((evt) => {
    const matchesSearch =
      searchTerm === '' ||
      evt.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.sequenceNumber.toString().includes(searchTerm) ||
      evt.eventType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (evt.user?.fullName && evt.user.fullName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = typeFilter === 'ALL' || evt.eventType === typeFilter;
    return matchesSearch && matchesType;
  });

  // Extract unique event types for filter dropdown
  const uniqueEventTypes = Array.from(new Set(events.map((e) => e.eventType)));

  return (
    <div className="space-y-6 font-sans">
      {/* 1. LEDGER HEADER */}
      <MotionReveal delayMs={0} className="p-6 rounded-2xl layer-shell border space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                Cryptographic Evidence Ledger
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                {events.length} Sequential Events
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Tamper-Evident Audit Chain
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every system event is cryptographically bound to its predecessor via SHA-256 hash chaining: <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-400 font-mono">H_n = SHA256(Data_n || H_n-1)</code>.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {user?.role === 'ADMIN' && (
              <>
                <button
                  onClick={() => setIsTamperOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold border border-rose-500/40 transition-all duration-micro ease-cinematic active:scale-[0.97] cursor-pointer"
                  title="Hackathon controlled byte tampering demonstration tool"
                >
                  <Zap className="w-4 h-4 text-rose-400" />
                  <span>Tamper Simulator (Demo)</span>
                </button>

                <button
                  onClick={handleVerifyChain}
                  disabled={verifying}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all duration-micro ease-cinematic active:scale-[0.97] cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{verifying ? 'Verifying Chain...' : 'VERIFY AUDIT CHAIN'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </MotionReveal>

      {/* 2. SIGNATURE JUDGE MOMENT: CONCEPTUAL INTEGRITY EXPLAINER */}
      <MotionReveal delayMs={50} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl layer-panel border border-slate-800 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Document Byte Integrity</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Verifies document authenticity by computing live SHA-256 against stored PDF byte arrays on every download attempt.
          </p>
        </div>

        <div className="p-4 rounded-xl layer-panel border border-slate-800 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <Lock className="w-4 h-4" />
            <span>Audit Chain Integrity</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Ensures historical audit log immutability by linking each sequence event hash to the previous event's hash (<code className="text-amber-300 font-mono">H_n = SHA256(Data_n || H_n-1)</code>).
          </p>
        </div>
      </MotionReveal>

      {/* Tamper Success Alert Notice */}
      {tamperSuccessMsg && (
        <MotionReveal delayMs={75} className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs space-y-1">
          <div className="font-bold text-rose-400 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Tamper Simulation Triggered
          </div>
          <p className="text-[11px] leading-relaxed">{tamperSuccessMsg}</p>
        </MotionReveal>
      )}

      {/* 3. AUDIT CHAIN VERIFICATION HERO RESULT */}
      {verifyResult && (
        <MotionReveal
          delayMs={100}
          className={`p-5 rounded-2xl border text-xs space-y-2 shadow-2xl transition-all duration-standard ease-cinematic ${
            verifyResult.valid
              ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/30 border-2 border-rose-500 text-rose-200 animate-status-pulse'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-extrabold text-sm">
              {verifyResult.valid ? (
                <>
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>AUDIT CHAIN VERIFIED & INTACT</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-5 h-5 text-rose-400" />
                  <span>AUDIT CHAIN VERIFICATION FAILED — DISCREPANCY DETECTED</span>
                </>
              )}
            </div>

            <button
              onClick={() => setVerifyResult(null)}
              className="text-[11px] font-bold text-slate-400 hover:text-white cursor-pointer px-2 py-0.5 rounded bg-slate-900 border border-slate-800"
            >
              Dismiss
            </button>
          </div>

          {verifyResult.valid ? (
            <p className="text-xs text-emerald-300 font-semibold leading-relaxed">
              No cryptographic sequence breaks or hash discrepancies detected across {verifyResult.totalEvents} audit events. Verified at {new Date(verifyResult.checkedAt).toLocaleTimeString()}.
            </p>
          ) : (
            <div className="font-mono text-xs space-y-1 text-rose-300 pt-1 border-t border-rose-500/30">
              <div>&bull; Broken Sequence Number: #{verifyResult.brokenAtSequence}</div>
              <div>&bull; Discrepancy Reason: {verifyResult.reason}</div>
              <div>&bull; Incident Escalated: AUDIT_CHAIN_VERIFICATION_FAILED security incident recorded.</div>
            </div>
          )}
        </MotionReveal>
      )}

      {/* 4. SEARCH & FILTER TOOLBAR */}
      <MotionReveal delayMs={120} className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl layer-panel border">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by action, sequence #, user, or type..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-mono"
          >
            <option value="ALL">All Event Types ({events.length})</option>
            {uniqueEventTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </MotionReveal>

      {/* 5. CRYPTOGRAPHIC EVENT CHAIN TIMELINE */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center space-y-3 text-slate-400 text-xs">
          <Activity className="w-6 h-6 animate-spin text-amber-400" />
          <p className="font-semibold text-slate-300">Constructing Cryptographic Ledger Timeline...</p>
        </div>
      ) : error ? (
        <MotionReveal className="p-5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          {error}
        </MotionReveal>
      ) : filteredEvents.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2">
          <History className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="font-semibold text-slate-300">No Audit Events Found</p>
          <p className="text-slate-500">No events matched the current ledger filter criteria.</p>
        </div>
      ) : (
        <div className="space-y-4 relative before:absolute before:left-7 before:top-6 before:bottom-6 before:w-0.5 before:bg-slate-800">
          <MotionStagger staggerMs={40} className="space-y-4">
            {filteredEvents.map((evt) => {
              const isCriticalEvent =
                evt.eventType.includes('TAMPER') ||
                evt.eventType.includes('FAILED') ||
                evt.eventType.includes('INCIDENT');

              return (
                <div
                  key={evt.id}
                  className={`relative pl-14 p-5 rounded-2xl border transition-all duration-standard ease-cinematic shadow-lg ${
                    isCriticalEvent
                      ? 'bg-rose-950/20 border-rose-500/50 shadow-rose-500/10'
                      : 'layer-panel border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Sequence Node Marker */}
                  <div
                    className={`absolute left-5 top-6 w-5 h-5 rounded-full border-2 -translate-x-1/2 flex items-center justify-center text-[9px] font-mono font-bold ${
                      isCriticalEvent
                        ? 'bg-rose-500 text-slate-950 border-rose-400 animate-status-pulse'
                        : 'bg-slate-950 text-amber-400 border-amber-500/40'
                    }`}
                  >
                    #{evt.sequenceNumber}
                  </div>

                  <div className="space-y-3">
                    {/* Header Row */}
                    <div className="flex items-start justify-between flex-wrap gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20 text-xs">
                            Seq #{evt.sequenceNumber}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                              isCriticalEvent
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-extrabold'
                                : 'bg-slate-950 text-slate-400 border-slate-800'
                            }`}
                          >
                            {evt.eventType}
                          </span>
                        </div>

                        <h3 className="font-extrabold text-white text-sm pt-0.5">{evt.action}</h3>
                      </div>

                      <div className="text-right text-[11px] text-slate-400">
                        <div>
                          User: <strong className="text-slate-200">{evt.user?.fullName || 'System'}</strong> ({evt.user?.role || 'SYSTEM'})
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {new Date(evt.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Cryptographic Hash Chaining Block (H_n = SHA256(Data_n || H_n-1)) */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="flex items-center justify-between text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Previous Hash (H_{Number(evt.sequenceNumber) - 1}):</span>
                        <span className="text-slate-300 truncate max-w-[150px] font-semibold">
                          {evt.previousEventHash
                            ? `${evt.previousEventHash.substring(0, 14)}...`
                            : 'GENESIS'}
                        </span>
                        {evt.previousEventHash && (
                          <button
                            onClick={() => handleCopy(evt.previousEventHash!)}
                            className="text-amber-400 hover:text-amber-300 ml-1 cursor-pointer transition-colors"
                            title="Copy Previous Hash"
                          >
                            {copiedHash === evt.previousEventHash ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Current Event Hash (H_{evt.sequenceNumber}):</span>
                        <span className="text-amber-300 font-bold truncate max-w-[150px]">
                          {evt.currentEventHash.substring(0, 14)}...
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCopy(evt.currentEventHash)}
                            className="text-amber-400 hover:text-amber-300 cursor-pointer transition-colors"
                            title="Copy Current Hash"
                          >
                            {copiedHash === evt.currentEventHash ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
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
                </div>
              );
            })}
          </MotionStagger>
        </div>
      )}

      {/* Full Audit Event Detail Modal */}
      {fullHashModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl font-mono text-xs text-slate-300 animate-fade-in-scale">
            <div className="flex items-center justify-between font-sans text-white font-bold border-b border-slate-800 pb-3">
              <span className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-amber-400" />
                Audit Event Record #{fullHashModal.sequenceNumber}
              </span>
              <button
                onClick={() => setFullHashModal(null)}
                className="text-slate-400 hover:text-white cursor-pointer px-2 py-0.5 rounded bg-slate-800"
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
                <strong>Previous Event Hash (H_{Number(fullHashModal.sequenceNumber) - 1}):</strong>
                <div className="bg-slate-950 p-2.5 rounded text-slate-400 break-all select-all mt-1 border border-slate-800">
                  {fullHashModal.previousEventHash || 'GENESIS_HASH'}
                </div>
              </div>
              <div>
                <strong>Current Event Hash (H_{fullHashModal.sequenceNumber}):</strong>
                <div className="bg-slate-950 p-2.5 rounded text-amber-300 break-all select-all mt-1 border border-slate-800">
                  {fullHashModal.currentEventHash}
                </div>
              </div>
              {fullHashModal.metadata && (
                <div>
                  <strong>Metadata JSON:</strong>
                  <pre className="bg-slate-950 p-2.5 rounded text-slate-400 mt-1 overflow-x-auto text-[11px] border border-slate-800">
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
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl animate-fade-in-scale">
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
