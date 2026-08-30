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

  const loadPendingApprovals = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.searchDocuments({ status: 'UNDER_REVIEW', limit: 20 });
      setReviewDocs(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pending approval queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingApprovals();
  }, []);

  const canApprove = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <CheckSquare className="w-6 h-6 text-amber-400" />
          Pending Approvals Queue
        </h2>
        <p className="text-xs text-slate-400">
          Documents submitted for official review. Approvals are strictly version-bound.
        </p>
      </div>

      {!canApprove && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          Notice: Role <strong className="text-white">{user?.role}</strong> has view-only access. Only SUPERVISOR and ADMIN roles can execute official document approvals.
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-xs text-slate-400">Loading pending reviews...</div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          {error}
        </div>
      ) : reviewDocs.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto" />
          <p className="font-semibold text-slate-300">Approval Queue Clear</p>
          <p className="text-slate-500">There are no documents currently awaiting review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reviewDocs.map((doc) => {
            const currentVer = doc.versions && doc.versions[0];
            return (
              <div
                key={doc.id}
                onClick={() => onSelectDocument(doc.id)}
                className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 transition-all cursor-pointer space-y-3 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {doc.documentType} • {doc.classification}
                    </span>
                    <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors mt-1">
                      {doc.title}
                    </h3>
                    {doc.case && (
                      <div className="text-[11px] text-slate-400 font-mono">
                        Case: {doc.case.caseNumber}
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-amber-500/20 text-amber-300 border-amber-500/30 flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" />
                    UNDER REVIEW
                  </span>
                </div>

                {currentVer && (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Target: Version {currentVer.versionNumber}</span>
                    <span className="text-amber-400/90 truncate max-w-[180px]">
                      {currentVer.sha256Hash.substring(0, 14)}...
                    </span>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Submitted: {new Date(doc.updatedAt).toLocaleDateString()}</span>
                  <span className="text-amber-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>Review & Approve</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
