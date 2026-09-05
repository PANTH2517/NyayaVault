import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase,
  FileText,
  Clock,
  AlertTriangle,
  Activity,
  ArrowRight,
  Shield,
  Search,
  CheckSquare,
  History,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import { DashboardStats } from '../../types';
import { ViewTab } from '../Sidebar';
import { useAuth } from '../../context/AuthContext';
import {
  MotionCard,
  MotionReveal,
  MotionStagger,
  MotionStaggerItem,
  AnimatedNumber,
  SecurityPostureRing,
} from '../motion';

interface DashboardViewProps {
  onNavigate: (tab: ViewTab, param?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDashboard();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Unable to load operational dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4 text-slate-400 font-sans">
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-2xl">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-200">Loading Dashboard Operations...</span>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <MotionReveal className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs space-y-4 font-sans">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-rose-300">Unable to load dashboard</h3>
            <p className="text-xs text-rose-400/90">{error}</p>
          </div>
        </div>
        <button
          onClick={loadStats}
          className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs transition-all cursor-pointer"
        >
          Try Again
        </button>
      </MotionReveal>
    );
  }

  const hasAttentionItems = stats.underReviewCount > 0 || stats.openIncidentsCount > 0;
  const isHealthy = stats.openIncidentsCount === 0;

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Attention Required Banner */}
      {hasAttentionItems && (
        <MotionReveal className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 font-extrabold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4" />
              <span>Attention Required</span>
            </div>
            <span className="text-[11px] font-mono text-amber-300/80">Pending Operational Actions</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stats.underReviewCount > 0 && (
              <div
                onClick={() => onNavigate('approvals')}
                className="p-3.5 rounded-xl bg-slate-950/80 border border-amber-500/20 hover:border-amber-500/40 flex items-center justify-between cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <div>
                    <div className="text-xs font-bold text-white">
                      {stats.underReviewCount} Evidence File(s) Awaiting Review
                    </div>
                    <div className="text-[11px] text-slate-400">Supervisor approval required</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-400" />
              </div>
            )}

            {stats.openIncidentsCount > 0 && (
              <div
                onClick={() => onNavigate('incidents')}
                className="p-3.5 rounded-xl bg-slate-950/80 border border-rose-500/20 hover:border-rose-500/40 flex items-center justify-between cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <div>
                    <div className="text-xs font-bold text-white">
                      {stats.openIncidentsCount} Open Security Incident(s)
                    </div>
                    <div className="text-[11px] text-slate-400">Integrity verification alert</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-rose-400" />
              </div>
            )}
          </div>
        </MotionReveal>
      )}

      {/* 2. Hero Overview & Integrity Posture */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <MotionReveal className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-slate-900/90 border border-slate-800 p-7 shadow-2xl backdrop-blur-xl flex flex-col justify-between space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                Role: {user?.role || stats.role}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Investigation & Evidence Dashboard
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
              Welcome, <strong className="text-slate-200">{user?.fullName || 'Officer'}</strong>. Operational overview of assigned cases, evidence files, approvals, and audit trail events.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap pt-1">
            <button
              onClick={() => onNavigate('search')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Search Evidence</span>
            </button>
            <button
              onClick={() => onNavigate('cases')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-all cursor-pointer"
            >
              <Briefcase className="w-4 h-4 text-amber-400" />
              <span>View Cases ({stats.totalCases})</span>
            </button>
          </div>
        </MotionReveal>

        {/* Security Posture Ring */}
        <MotionReveal delayMs={100} className="lg:col-span-1">
          <SecurityPostureRing
            status={isHealthy ? 'SECURE' : 'COMPROMISED'}
            totalIncidents={stats.openIncidentsCount}
          />
        </MotionReveal>
      </div>

      {/* 3. Operational KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cases */}
        <MotionCard onClick={() => onNavigate('cases')} className="p-5 space-y-3 rounded-2xl bg-slate-900/80 border border-slate-800 cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">My Cases</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            <AnimatedNumber value={stats.totalCases} />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
            <span>Authorized Scope</span>
            <span className="text-amber-400 font-semibold flex items-center gap-0.5">
              Open <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </MotionCard>

        {/* Evidence */}
        <MotionCard onClick={() => onNavigate('search')} className="p-5 space-y-3 rounded-2xl bg-slate-900/80 border border-slate-800 cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Evidence Files</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            <AnimatedNumber value={stats.totalDocuments} />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
            <span>Verified Integrity</span>
            <span className="text-sky-400 font-semibold flex items-center gap-0.5">
              Search <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </MotionCard>

        {/* Pending Approvals */}
        <MotionCard onClick={() => onNavigate('approvals')} className="p-5 space-y-3 rounded-2xl bg-slate-900/80 border border-slate-800 cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Review</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            <AnimatedNumber value={stats.underReviewCount} />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
            <span>Review Queue</span>
            <span className="text-amber-400 font-semibold flex items-center gap-0.5">
              Review <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </MotionCard>

        {/* Open Incidents */}
        <MotionCard onClick={() => onNavigate('incidents')} className="p-5 space-y-3 rounded-2xl bg-slate-900/80 border border-slate-800 cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Security Alerts</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            <AnimatedNumber value={stats.openIncidentsCount} />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
            <span>Integrity State</span>
            <span className="text-rose-400 font-semibold flex items-center gap-0.5">
              View Alerts <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </MotionCard>
      </div>

      {/* 4. Recent Activity Stream */}
      <MotionReveal delayMs={200} className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 space-y-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-amber-400" />
              Recent Activity
            </h3>
            <p className="text-xs text-slate-400">
              Recent authorized operations recorded in audit log.
            </p>
          </div>

          <button
            onClick={() => onNavigate('audit')}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <span>Full Audit Log</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {stats.recentActivity.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 bg-slate-950/60 rounded-2xl border border-slate-800/80 italic">
            No audit activity logged.
          </div>
        ) : (
          <MotionStagger staggerDelay={0.04} className="space-y-2.5">
            {stats.recentActivity.map((evt) => (
              <MotionStaggerItem key={evt.id}>
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs gap-4 hover:border-slate-700 transition-all">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="font-mono text-[11px] font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20 shrink-0">
                      #{evt.sequenceNumber}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-200 truncate">{evt.action}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        User: <strong className="text-slate-300">{evt.user?.fullName || 'System'}</strong> ({evt.user?.role || 'SYSTEM'}) &bull;{' '}
                        {new Date(evt.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                      Verified
                    </span>
                  </div>
                </div>
              </MotionStaggerItem>
            ))}
          </MotionStagger>
        )}
      </MotionReveal>
    </div>
  );
};
