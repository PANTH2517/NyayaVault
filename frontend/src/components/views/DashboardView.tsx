import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  FileText,
  Clock,
  CheckCircle2,
  Lock,
  AlertTriangle,
  Activity,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../../services/api';
import { DashboardStats } from '../../types';
import { ViewTab } from '../Sidebar';

interface DashboardViewProps {
  onNavigate: (tab: ViewTab, param?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDashboard();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-xs">
        <Activity className="w-5 h-5 animate-spin text-amber-400 mr-2" />
        Loading Live Prisma Dashboard Metrics...
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs space-y-3">
        <div className="flex items-center gap-2 font-bold text-sm">
          <AlertTriangle className="w-5 h-5" />
          Dashboard Metric Error
        </div>
        <p>{error}</p>
        <button
          onClick={loadStats}
          className="px-3 py-1.5 rounded-lg bg-rose-500 text-white font-semibold text-xs cursor-pointer"
        >
          Retry Load
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-amber-950/20 border border-slate-800 p-6 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-1 max-w-xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Role: {stats.role}
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Evidentiary Accountability Dashboard
            </h2>
            <p className="text-xs text-slate-400">
              Live statistics derived directly from Supabase PostgreSQL via NestJS backend services.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('search')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
            >
              <span>Search Documents</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Critical Security Incident Alert Banner (if open incidents exist) */}
      {stats.openIncidentsCount > 0 && (
        <div
          onClick={() => onNavigate('incidents')}
          className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center justify-between gap-4 cursor-pointer hover:border-rose-500/60 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-rose-400">
                Action Required: {stats.openIncidentsCount} Open Security Incident(s)
              </div>
              <div className="text-[11px] text-slate-300">
                Cryptographic hash mismatch or audit chain discrepancy detected. Click to review.
              </div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-rose-400 shrink-0" />
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Cases */}
        <div
          onClick={() => onNavigate('cases')}
          className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 transition-all cursor-pointer space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Assigned Cases</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">{stats.totalCases}</div>
          <p className="text-[11px] text-slate-500">Accessible within current authorization scope</p>
        </div>

        {/* Total Documents */}
        <div
          onClick={() => onNavigate('search')}
          className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-sky-500/40 transition-all cursor-pointer space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Documents</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">{stats.totalDocuments}</div>
          <p className="text-[11px] text-slate-500">Immutable versions under protection</p>
        </div>

        {/* Under Review */}
        <div
          onClick={() => onNavigate('approvals')}
          className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 transition-all cursor-pointer space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Under Review</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">{stats.underReviewCount}</div>
          <p className="text-[11px] text-slate-500">Pending supervisor approval</p>
        </div>

        {/* Approved */}
        <div
          onClick={() => onNavigate('search')}
          className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all cursor-pointer space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Approved Documents</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">{stats.approvedCount}</div>
          <p className="text-[11px] text-slate-500">Verified and approved versions</p>
        </div>

        {/* Sealed */}
        <div
          onClick={() => onNavigate('search')}
          className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Sealed Documents</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Lock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">{stats.sealedCount}</div>
          <p className="text-[11px] text-slate-500">Immutable final sealed state</p>
        </div>

        {/* Open Incidents */}
        <div
          onClick={() => onNavigate('incidents')}
          className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-rose-500/40 transition-all cursor-pointer space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Open Incidents</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">{stats.openIncidentsCount}</div>
          <p className="text-[11px] text-slate-500">Active tamper/security warnings</p>
        </div>
      </div>

      {/* Recent Cryptographic Audit Log */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <Activity className="w-4 h-4 text-amber-400" />
            <span>Recent Cryptographic Audit Trail Events</span>
          </div>
          <button
            onClick={() => onNavigate('audit')}
            className="text-xs font-semibold text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View Full Audit Chain</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          {stats.recentActivity.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4">No recent audit events recorded.</p>
          ) : (
            stats.recentActivity.map((evt) => (
              <div
                key={evt.id}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] font-bold text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 shrink-0">
                    #{evt.sequenceNumber}
                  </span>
                  <div>
                    <div className="font-semibold text-slate-200">{evt.action}</div>
                    <div className="text-[10px] text-slate-500">
                      User: {evt.user?.fullName || 'System'} ({evt.user?.role || 'SYSTEM'}) •{' '}
                      {new Date(evt.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800 shrink-0">
                  {evt.currentEventHash.substring(0, 12)}...
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
