import React, { useEffect, useState } from 'react';
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
      setError(err.message || 'Failed to fetch cases');
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
    <div className="space-y-6 font-sans">
      {/* 1. CASE HEADER */}
      <MotionReveal delayMs={0} className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                Case Operations Hub
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                {cases.length} Accessible Investigation Case(s)
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Investigation Cases & Records
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Case-scoped evidence boundaries protected by NestJS backend authorization guards.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {user?.role === 'ADMIN' && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all duration-micro ease-cinematic active:scale-[0.97] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Case</span>
              </button>
            )}
          </div>
        </div>
      </MotionReveal>

      {/* 2. FILTERS & SEARCH TOOLBAR */}
      <MotionReveal delayMs={50} className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search by case number, title, or summary..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-mono"
          >
            <option value="ALL">All Case Statuses ({cases.length})</option>
            <option value="OPEN">OPEN Only</option>
            <option value="UNDER_INVESTIGATION">UNDER INVESTIGATION</option>
            <option value="CLOSED">CLOSED Only</option>
            <option value="ARCHIVED">ARCHIVED Only</option>
          </select>
        </div>
      </MotionReveal>

      {/* 3. CASE COLLECTION GRID */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center space-y-3 text-slate-400 text-xs">
          <Activity className="w-6 h-6 animate-spin text-amber-400" />
          <p className="font-semibold text-slate-300">Loading Investigation Cases...</p>
        </div>
      ) : error ? (
        <MotionReveal className="p-5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          {error}
        </MotionReveal>
      ) : filteredCases.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2">
          <Briefcase className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="font-semibold text-slate-300">No Cases Found</p>
          <p className="text-slate-500">
            {user?.role === 'ADMIN'
              ? 'No cases match the search criteria.'
              : 'No assigned cases found under your authorized case assignments.'}
          </p>
        </div>
      ) : (
        <MotionStagger staggerMs={50} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCases.map((c) => {
            const isAssigned = c.assignments && c.assignments.some((a) => a.userId === user?.id);

            return (
              <MotionCard
                key={c.id}
                onClick={() => onSelectCase(c.id)}
                className="p-6 space-y-4 group cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                        {c.caseNumber}
                      </span>

                      {/* Access Scope Indicator */}
                      {user?.role === 'ADMIN' ? (
                        <span className="text-[10px] font-bold text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 font-mono">
                          ADMIN ACCESS
                        </span>
                      ) : isAssigned ? (
                        <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                          AUTHORIZED ASSIGNED
                        </span>
                      ) : null}
                    </div>

                    <h3 className="text-base font-extrabold text-white group-hover:text-amber-300 transition-colors">
                      {c.title}
                    </h3>
                  </div>

                  <MotionStatus status={c.status} />
                </div>

                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {c.description || 'No detailed description provided for this case.'}
                </p>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 font-mono text-[11px]">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Assigned Personnel: <strong className="text-slate-200">{c.assignments ? c.assignments.length : 0}</strong></span>
                  </span>

                  <span className="flex items-center gap-1 text-amber-400 font-bold text-xs group-hover:translate-x-1 transition-transform">
                    <span>Open Case Operational Hub</span>
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
