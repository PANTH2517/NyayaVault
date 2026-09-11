import React, { useEffect, useState } from 'react';
import { Search, Filter, FileText, ChevronLeft, ChevronRight, ArrowRight, Clock, CheckCircle2, Lock, ShieldCheck, Tag, Hash, Fingerprint } from 'lucide-react';
import { api } from '../../services/api';
import { Document, DocumentClassification, DocumentStatus } from '../../types';
import { MotionReveal } from '../motion';
import { getEvidenceTypeLabel, AUTHORITATIVE_EVIDENCE_TYPES } from '../../utils/evidenceTypes';

interface SearchFilterViewProps {
  onSelectDocument: (documentId: string) => void;
}

export const SearchFilterView: React.FC<SearchFilterViewProps> = ({ onSelectDocument }) => {
  const [q, setQ] = useState('');
  const [documentTypeFilter, setDocumentTypeFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
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
        documentType: documentTypeFilter || undefined,
        tags: tagFilter.trim() || undefined,
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
  }, [q, documentTypeFilter, tagFilter, classification, status]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      executeSearch(newPage);
    }
  };

  const statusBadges: Record<DocumentStatus, { label: string; style: string; icon: any }> = {
    DRAFT: { label: 'DRAFT', style: 'bg-slate-500/15 text-slate-300 border-slate-500/30', icon: Clock },
    UNDER_REVIEW: { label: 'UNDER REVIEW', style: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: Clock },
    APPROVED: { label: 'APPROVED', style: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: CheckCircle2 },
    SEALED: { label: 'SEALED & IMMUTABLE', style: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40', icon: Lock },
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Header Bar */}
      <MotionReveal delayMs={0} className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 space-y-4 shadow-2xl backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" />
                FORENSIC DISCOVERY SEARCH
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                CBAC AUTHORIZED SCOPE
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              SEARCH DIGITAL EVIDENCE
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal">
              Query and discover protected digital evidence artifacts across authorized cases, classification levels, lifecycle states, and forensic tags.
            </p>
          </div>
        </div>
      </MotionReveal>

      {/* Filter Controls Bar */}
      <MotionReveal delayMs={50} className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl backdrop-blur-2xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, case #, description..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono transition-colors"
            />
          </div>

          {/* Classification Filter */}
          <select
            value={classification}
            onChange={(e) => setClassification(e.target.value as any)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-mono"
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
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-mono"
          >
            <option value="">All Lifecycle Statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="UNDER_REVIEW">UNDER REVIEW</option>
            <option value="APPROVED">APPROVED</option>
            <option value="SEALED">SEALED</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800/80">
          {/* Evidence Category / Type Filter */}
          <select
            value={documentTypeFilter}
            onChange={(e) => setDocumentTypeFilter(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-mono"
          >
            <option value="">All Evidence Categories / Types</option>
            {AUTHORITATIVE_EVIDENCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          {/* Tag Filter */}
          <div className="relative">
            <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              placeholder="Filter by tag (e.g. FORENSIC, CYBER)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono transition-colors"
            />
          </div>
        </div>
      </MotionReveal>

      {/* Results Count Bar */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-2 font-mono">
        <span>
          Found <strong className="text-amber-400 font-bold">{total}</strong> authorized evidence file(s)
        </span>
        <span>
          Page {page} of {totalPages}
        </span>
      </div>

      {/* Results List */}
      {loading ? (
        <div className="text-center py-20 text-xs text-slate-400 font-sans">
          <div className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 max-w-sm mx-auto shadow-2xl backdrop-blur-xl">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="font-mono font-bold text-slate-200">Executing Forensic Discovery Query...</span>
          </div>
        </div>
      ) : error ? (
        <div className="p-6 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-sans">
          {error}
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-20 text-xs text-slate-500 bg-slate-900/40 rounded-3xl border border-slate-800/80 space-y-3 font-sans">
          <FileText className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="font-extrabold text-sm text-slate-300">NO EVIDENCE ARTIFACTS FOUND</p>
          <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
            No evidence artifacts match your search query or authorized case assignments. Try broadening keyword or category filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
          {documents.map((doc) => {
            const currentVer = doc.versions && doc.versions[0];
            const st = statusBadges[doc.currentStatus];
            const StatusIcon = st.icon;

            return (
              <div
                key={doc.id}
                onClick={() => onSelectDocument(doc.id)}
                className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 hover:border-amber-500/40 transition-all duration-300 cursor-pointer space-y-4 group shadow-xl backdrop-blur-2xl relative"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-mono font-bold text-amber-400 tracking-wider flex items-center gap-2 flex-wrap">
                      <span>{getEvidenceTypeLabel(doc.documentType)} &bull; {doc.classification}</span>
                      {doc.exhibitNumber && (
                        <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          Ex #{doc.exhibitNumber}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-white group-hover:text-amber-300 transition-colors">
                      {doc.title}
                    </h3>
                    {doc.case && (
                      <div className="text-[11px] text-amber-400/90 font-mono mt-0.5">
                        Case {doc.case.caseNumber} &bull; {doc.case.title}
                      </div>
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-mono font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 shrink-0 ${st.style}`}
                  >
                    <StatusIcon className="w-3.5 h-3.5" />
                    {st.label}
                  </span>
                </div>

                {doc.description && (
                  <p className="text-xs text-slate-300 line-clamp-2 font-sans leading-relaxed">
                    {doc.description}
                  </p>
                )}

                {/* Technical Metadata */}
                {currentVer && (
                  <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800/80 font-mono text-[11px] text-slate-400 flex items-center justify-between">
                    <span>VERSION 0{currentVer.versionNumber}</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Fingerprint className="w-3 h-3" />
                      SHA-256 VERIFIED
                    </span>
                  </div>
                )}

                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {doc.tags.map((t, idx) => (
                      <span key={idx} className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="pt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80">
                  <span className="font-mono text-[11px]">Created: {new Date(doc.createdAt).toLocaleDateString()}</span>
                  <span className="text-amber-400 font-extrabold text-xs flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>OPEN ARTIFACT</span>
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
        <div className="flex items-center justify-center gap-4 pt-4 font-mono">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-300">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages}
            className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer hover:bg-slate-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
