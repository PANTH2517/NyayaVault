import React, { useEffect, useState } from 'react';
import { Search, Filter, FileText, ChevronLeft, ChevronRight, ArrowRight, Clock, CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import { Document, DocumentClassification, DocumentStatus } from '../../types';
import { MotionReveal } from '../motion';
import { getEvidenceTypeLabel } from '../../utils/evidenceTypes';

interface SearchFilterViewProps {
  onSelectDocument: (documentId: string) => void;
}

export const SearchFilterView: React.FC<SearchFilterViewProps> = ({ onSelectDocument }) => {
  const [q, setQ] = useState('');
  const [classification, setClassification] = useState<DocumentClassification | ''>('');
  const [status, setStatus] = useState<DocumentStatus | ''>('');
  const [page, setPage] = useState(1);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const executeSearch = async (targetPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.searchDocuments({
        q: q || undefined,
        classification: (classification as DocumentClassification) || undefined,
        status: (status as DocumentStatus) || undefined,
        page: targetPage,
        limit: 8,
      });

      setDocuments(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      setError(err.message || 'Unable to search evidence files.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeSearch(1);
    setPage(1);
  }, [q, classification, status]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      executeSearch(newPage);
    }
  };

  const statusBadges: Record<DocumentStatus, { label: string; style: string; icon: any }> = {
    DRAFT: { label: 'DRAFT', style: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: Clock },
    UNDER_REVIEW: { label: 'UNDER REVIEW', style: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: Clock },
    APPROVED: { label: 'APPROVED', style: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: CheckCircle2 },
    SEALED: { label: 'SEALED', style: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30', icon: Lock },
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <Search className="w-7 h-7 text-amber-400" />
            Evidence Files
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Search and query evidence files across authorized cases, classification levels, and lifecycle status.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl font-mono">
          <ShieldCheck className="w-4 h-4" />
          <span>CBAC Scoped Search</span>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, case #, type..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          {/* Classification Filter */}
          <select
            value={classification}
            onChange={(e) => setClassification(e.target.value as any)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-mono"
          >
            <option value="">All Classification Levels</option>
            <option value="RESTRICTED">RESTRICTED</option>
            <option value="CONFIDENTIAL">CONFIDENTIAL</option>
            <option value="HIGHLY_CONFIDENTIAL">HIGHLY CONFIDENTIAL</option>
          </select>

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-mono"
          >
            <option value="">All Lifecycle Statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="UNDER_REVIEW">UNDER REVIEW</option>
            <option value="APPROVED">APPROVED</option>
            <option value="SEALED">SEALED</option>
          </select>
        </div>
      </div>

      {/* Results Count Bar */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-mono">
        <span>
          Found <strong className="text-white font-bold">{total}</strong> evidence file(s)
        </span>
        <span>
          Page {page} of {totalPages}
        </span>
      </div>

      {/* Results List */}
      {loading ? (
        <div className="text-center py-16 text-xs text-slate-400 font-sans">
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span>Searching evidence files...</span>
          </div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-sans">
          {error}
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 text-xs text-slate-500 bg-slate-900/40 rounded-3xl border border-slate-800 space-y-2 font-sans">
          <FileText className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="font-semibold text-slate-300">No Evidence Found</p>
          <p className="text-slate-500">No evidence files match your query or authorized case assignments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans">
          {documents.map((doc) => {
            const currentVer = doc.versions && doc.versions[0];
            const st = statusBadges[doc.currentStatus];
            const StatusIcon = st.icon;

            return (
              <div
                key={doc.id}
                onClick={() => onSelectDocument(doc.id)}
                className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 transition-all duration-300 cursor-pointer space-y-3 group shadow-xl backdrop-blur-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-mono font-bold text-amber-400 tracking-wider">
                      {getEvidenceTypeLabel(doc.documentType)} &bull; {doc.classification}
                    </div>
                    <h3 className="text-base font-extrabold text-white group-hover:text-amber-300 transition-colors">
                      {doc.title}
                    </h3>
                    {doc.case && (
                      <div className="text-[11px] text-amber-400/90 font-mono mt-0.5">
                        Case: {doc.case.caseNumber} &bull; {doc.case.title}
                      </div>
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 shrink-0 ${st.style}`}
                  >
                    <StatusIcon className="w-3.5 h-3.5" />
                    {st.label}
                  </span>
                </div>

                {currentVer && (
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Version {currentVer.versionNumber}</span>
                    <span className="text-emerald-400 font-bold">
                      Integrity Verified
                    </span>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/80">
                  <span>Created: {new Date(doc.createdAt).toLocaleDateString()}</span>
                  <span className="text-amber-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>Open Evidence</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4 font-mono">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-400">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
