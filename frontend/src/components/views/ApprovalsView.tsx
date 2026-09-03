import React, { useEffect, useState } from 'react';
import { CheckSquare, Clock, CheckCircle2, FileText, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import { Document } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface ApprovalsViewProps {
  onSelectDocument: (docId: string) => void;
}

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({ onSelectDocument }) => {
  const { user } = useAuth();
  const [reviewDocs, setReviewDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadPendingApprovals = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.searchDocuments({ status: 'UNDER_REVIEW', limit: 20 });
      setReviewDocs(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Unable to load pending approval queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingApprovals();
  }, []);

  const handleApprove = async (e: React.MouseEvent, doc: Document) => {
    e.stopPropagation();
    const currentVer = doc.versions && doc.versions[0];
    if (!currentVer) return;

    setActionLoadingId(doc.id);
    try {
      await api.approveDocument(doc.id, currentVer.id, 'Approved by Supervisor after cryptographic review');
      loadPendingApprovals();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const canApprove = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  return (
    <div className="space-y-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <CheckSquare className="w-7 h-7 text-amber-400" />
            Pending Approvals
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Task queue for evidence versions submitted for supervisor review and signoff.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 font-bold">
            Pending: {reviewDocs.length}
          </span>
        </div>
      </div>

      {!canApprove && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          Notice: Account role <strong>{user?.role}</strong> has view-only access. Only SUPERVISOR and ADMIN roles can issue approval decisions.
        </div>
      )}

      {/* Queue List */}
      {loading ? (
        <div className="text-center py-16 text-xs text-slate-400 font-sans">
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading approval queue...</span>
          </div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-sans">
          {error}
        </div>
      ) : reviewDocs.length === 0 ? (
        <div className="text-center py-16 text-xs text-slate-500 bg-slate-900/40 rounded-3xl border border-slate-800 space-y-2 font-sans">
          <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto" />
          <p className="font-semibold text-slate-300">No Approvals Pending</p>
          <p className="text-slate-500">No evidence is currently awaiting review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans">
          {reviewDocs.map((doc) => {
            const currentVer = doc.versions && doc.versions[0];
            const isProcessing = actionLoadingId === doc.id;

            return (
              <div
                key={doc.id}
                onClick={() => onSelectDocument(doc.id)}
                className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 transition-all duration-300 cursor-pointer space-y-4 group shadow-xl backdrop-blur-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                      {doc.documentType} &bull; {doc.classification}
                    </span>
                    <h3 className="text-base font-extrabold text-white group-hover:text-amber-300 transition-colors mt-1">
                      {doc.title}
                    </h3>
                    {doc.case && (
                      <div className="text-[11px] text-slate-400 font-mono">
                        Case: {doc.case.caseNumber} &bull; {doc.case.title}
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-amber-500/20 text-amber-300 border-amber-500/30 flex items-center gap-1 shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    UNDER REVIEW
                  </span>
                </div>

                {currentVer && (
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Target: Version {currentVer.versionNumber}</span>
                    <span className="text-amber-400/90 font-bold truncate max-w-[180px]">
                      SHA-256: {currentVer.sha256Hash.substring(0, 16)}...
                    </span>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/80">
                  <span>Submitted: {new Date(doc.updatedAt).toLocaleDateString()}</span>
                  
                  {canApprove ? (
                    <button
                      type="button"
                      onClick={(e) => handleApprove(e, doc)}
                      disabled={isProcessing}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer shadow-md shadow-emerald-500/20 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isProcessing ? 'Approving...' : 'Approve Version'}</span>
                    </button>
                  ) : (
                    <span className="text-amber-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      <span>Review Details</span>
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
