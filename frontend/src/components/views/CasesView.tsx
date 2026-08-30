import React, { useEffect, useState } from 'react';
import { Briefcase, Plus, Search, Folder, Shield, AlertCircle, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';
import { Case, CaseStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface CasesViewProps {
  onSelectCase: (caseId: string) => void;
}

export const CasesView: React.FC<CasesViewProps> = ({ onSelectCase }) => {
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

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

  const filteredCases = cases.filter(
    (c) =>
      c.caseNumber.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const statusBadges: Record<CaseStatus, string> = {
    OPEN: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    UNDER_INVESTIGATION: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    CLOSED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    ARCHIVED: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-amber-400" />
            Case Management & Access Control
          </h2>
          <p className="text-xs text-slate-400">
            Cases accessible under Case-Based Access Control (CBAC) rules.
          </p>
        </div>

        {user?.role === 'ADMIN' && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Case</span>
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Filter cases by case number or title..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-xs text-slate-400">Loading cases...</div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          {error}
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="text-center py-16 text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
          No cases found under current search/authorization filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCases.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelectCase(c.id)}
              className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 transition-all cursor-pointer space-y-4 group"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 inline-block mb-1">
                    {c.caseNumber}
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                    {c.title}
                  </h3>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    statusBadges[c.status]
                  }`}
                >
                  {c.status.replace('_', ' ')}
                </span>
              </div>

              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {c.description || 'No detailed description provided.'}
              </p>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Team Members:{' '}
                  <strong className="text-slate-300">
                    {c.assignments ? c.assignments.length : 0}
                  </strong>
                </span>
                <span className="flex items-center gap-1 text-amber-400 font-semibold group-hover:translate-x-1 transition-transform">
                  <span>Open Case File</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin Create Case Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl">
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
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
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
