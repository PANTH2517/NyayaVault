import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Folder,
  Shield,
  AlertCircle,
  ArrowRight,
  UserCheck,
  Lock,
  Filter,
  CheckCircle2,
  Clock,
  Activity,
  Users,
} from 'lucide-react';
import { api } from '../../services/api';
import { Case, CaseStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { MotionCard, MotionReveal, MotionStagger, MotionStatus } from '../motion';

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

  // Modal State for Admin Create Case
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCaseNumber, setNewCaseNumber] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

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

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      await api.createCase({
        caseNumber: newCaseNumber,
        title: newTitle,
        description: newDescription,
      });
      setIsCreateOpen(false);
      setNewCaseNumber('');
      setNewTitle('');
      setNewDescription('');
      loadCases();
    } catch (err: any) {
      alert(`Create case failed: ${err.message}`);
    } finally {
      setCreateLoading(false);
    }
  };

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
      {/* 1. CASE COMMAND HEADER */}
      <MotionReveal delayMs={0} className="p-6 rounded-2xl layer-shell border space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                Case Command Center
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                {cases.length} Accessible Investigation Case(s)
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Case Records & Authorization Scope
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every investigation case forms an isolated Case-Based Access Control (CBAC) boundary protecting associated document versions and audit entries.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {user?.role === 'ADMIN' && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all duration-micro ease-cinematic active:scale-[0.97] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Case</span>
              </button>
            )}
          </div>
        </div>
      </MotionReveal>

      {/* 2. CBAC EXPLAINER HERO */}
      <MotionReveal delayMs={50} className="p-5 rounded-2xl layer-panel border border-slate-800 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 font-extrabold text-xs text-amber-400 uppercase tracking-wider">
            <Shield className="w-4 h-4" />
            <span>Case-Based Access Control (CBAC) Model</span>
          </div>

          <MotionStatus status="APPROVED" label="CBAC PROTECTION ACTIVE" />
        </div>

        <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
          Access is case-scoped. Non-administrative users can only retrieve evidence for cases explicitly assigned to them by an administrator. System API endpoints strictly evaluate JWT role claims and case assignment tables.
        </p>

        <div className="pt-2 flex items-center gap-2 overflow-x-auto text-[10px] font-mono text-slate-400 scrollbar-none border-t border-slate-800/80">
          <span className="text-slate-200 font-bold flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-amber-400" /> {user?.role || 'OFFICER'}
          </span>
          <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
          <span className="text-slate-200 font-bold flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-sky-400" /> CBAC API GUARD
          </span>
          <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
          <span className="text-slate-200 font-bold flex items-center gap-1">
            <Folder className="w-3.5 h-3.5 text-amber-400" /> CASE BOUNDARY
          </span>
          <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> AUTHORIZED EVIDENCE ACCESS
          </span>
        </div>
      </MotionReveal>

      {/* 3. FILTERS & SEARCH TOOLBAR */}
      <MotionReveal delayMs={100} className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl layer-panel border">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter by case number, title, or description..."
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

      {/* 4. CASE COLLECTION GRID */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center space-y-3 text-slate-400 text-xs">
          <Activity className="w-6 h-6 animate-spin text-amber-400" />
          <p className="font-semibold text-slate-300">Loading Case Command Records...</p>
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
              : 'No assigned cases found under current CBAC authorization scope.'}
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
                className="p-6 space-y-4 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                        {c.caseNumber}
                      </span>

                      {/* Access Scope Indicator */}
                      {user?.role === 'ADMIN' ? (
                        <span className="text-[10px] font-bold text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                          ADMIN VISIBILITY
                        </span>
                      ) : isAssigned ? (
                        <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
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
                    <span>Team Members: <strong className="text-slate-200">{c.assignments ? c.assignments.length : 0}</strong></span>
                  </span>

                  <span className="flex items-center gap-1 text-amber-400 font-bold text-xs group-hover:translate-x-1 transition-transform">
                    <span>Open Case File</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </MotionCard>
            );
          })}
        </MotionStagger>
      )}

      {/* Admin Create Case Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl animate-fade-in-scale">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Folder className="w-5 h-5 text-amber-400" />
              Create New Investigation Case
            </h3>

            <form onSubmit={handleCreateCase} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Case Number (Unique)</label>
                <input
                  type="text"
                  value={newCaseNumber}
                  onChange={(e) => setNewCaseNumber(e.target.value)}
                  required
                  placeholder="e.g. CR-2026-0412"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Case Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  placeholder="e.g. State vs. Digital Fraud Ring"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  placeholder="Brief summary of investigation details..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
                >
                  {createLoading ? 'Creating...' : 'Create Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
