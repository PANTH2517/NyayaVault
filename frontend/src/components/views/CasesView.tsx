import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase,
  Plus,
  Search,
  Folder,
  Shield,
  ArrowRight,
  UserCheck,
  Lock,
  Filter,
  CheckCircle2,
  Activity,
  Users,
  Clock,
  ShieldAlert,
  FileCheck2,
} from 'lucide-react';
import { api } from '../../services/api';
import { Case } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { MotionCard, MotionReveal, MotionStagger, MotionStatus } from '../motion';
import { CreateCaseModal } from './CreateCaseModal';

interface CasesViewProps {
  onSelectCase: (caseId: string) => void;
}

export const CasesView: React.FC<CasesViewProps> = ({ onSelectCase }) => {
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal State for Create Case Workflow
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const loadCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCases();
      setCases(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch authorized cases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      searchFilter === '' ||
      c.caseNumber.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchFilter.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 font-sans">
      {/* 1. INVESTIGATIONS PAGE HEADER */}
      <MotionReveal delayMs={0} className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 space-y-5 shadow-2xl backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                DIGITAL INVESTIGATION WORKSPACE
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-300 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
                {cases.length} AUTHORIZED CASE(S)
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              INVESTIGATIONS
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal">
              Secure case boundaries protected by cryptographic role and attribute access policies. Explore assigned investigation files, evidence logs, and personnel assignments.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {user?.role === 'ADMIN' && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Case</span>
              </button>
            )}
          </div>
        </div>
      </MotionReveal>

      {/* 2. FILTERS & SEARCH TOOLBAR */}
      <MotionReveal delayMs={50} className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-2xl">
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search by case number, title, or summary..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-mono"
          >
            <option value="ALL">All Statuses ({cases.length})</option>
            <option value="OPEN">OPEN Only</option>
            <option value="UNDER_INVESTIGATION">UNDER INVESTIGATION</option>
            <option value="CLOSED">CLOSED Only</option>
            <option value="ARCHIVED">ARCHIVED Only</option>
          </select>
        </div>
      </MotionReveal>

      {/* 3. CASE COLLECTION GRID */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center space-y-3 text-slate-400 text-xs font-sans">
          <Activity className="w-6 h-6 animate-spin text-amber-400" />
          <p className="font-mono font-bold text-slate-300">Loading Authorized Case Workspaces...</p>
        </div>
      ) : error ? (
        <MotionReveal className="p-6 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-sans">
          {error}
        </MotionReveal>
      ) : filteredCases.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-3xl border border-slate-800/80 space-y-3 font-sans">
          <Briefcase className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="font-extrabold text-sm text-slate-300">NO CASES FOUND</p>
          <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
            {user?.role === 'ADMIN'
              ? 'No active cases match your search filter criteria. Adjust search parameters or create a new case.'
              : 'No assigned cases match your current filter criteria under your authorized scope.'}
          </p>
        </div>
      ) : (
        <MotionStagger staggerMs={50} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredCases.map((c) => {
            const isAssigned = c.assignments && c.assignments.some((a) => a.userId === user?.id);

            return (
              <MotionCard
                key={c.id}
                onClick={() => onSelectCase(c.id)}
                className="p-6 sm:p-7 space-y-5 group cursor-pointer rounded-3xl bg-slate-900/80 border border-slate-800/80 hover:border-amber-500/40 transition-all duration-300 shadow-xl backdrop-blur-2xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono font-bold text-amber-400 tracking-wider bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
                        {c.caseNumber}
                      </span>

                      {/* Access Scope Indicator */}
                      {user?.role === 'ADMIN' ? (
                        <span className="text-[10px] font-mono font-bold text-rose-300 bg-rose-500/15 px-2.5 py-0.5 rounded-lg border border-rose-500/30">
                          ADMIN SCOPE
                        </span>
                      ) : isAssigned ? (
                        <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
                          ASSIGNED OFFICER
                        </span>
                      ) : null}
                    </div>

                    <h2 className="text-lg font-extrabold text-white group-hover:text-amber-300 transition-colors">
                      {c.title}
                    </h2>
                  </div>

                  <MotionStatus status={c.status} />
                </div>

                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed font-normal">
                  {c.description || 'No detailed investigation summary provided.'}
                </p>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Personnel: <strong className="text-slate-200">{c.assignments ? c.assignments.length : 0}</strong></span>
                  </div>

                  <span className="flex items-center gap-1.5 text-amber-400 font-extrabold text-xs group-hover:translate-x-1 transition-transform">
                    <span>OPEN WORKSPACE</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </MotionCard>
            );
          })}
        </MotionStagger>
      )}

      {/* Multi-Step Case Creation Operational Workflow */}
      <CreateCaseModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCaseCreated={(newCaseId) => {
          loadCases();
          onSelectCase(newCaseId);
        }}
      />
    </div>
  );
};
