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
  ShieldCheck,
  Search,
  CheckSquare,
  History,
  Shield,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../../services/api';
import { DashboardStats } from '../../types';
import { ViewTab } from '../Sidebar';
import { useAuth } from '../../context/AuthContext';
import { MotionCard, MotionReveal, MotionStagger, MotionStatus } from '../motion';

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
      setError(err.message || 'Failed to fetch dashboard metrics');
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
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center animate-status-pulse">
            <Shield className="w-6 h-6 text-amber-400" />
          </div>
          <Activity className="w-4 h-4 animate-spin text-amber-400 absolute -bottom-1 -right-1" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-xs font-bold text-slate-200 tracking-wide uppercase">
            Initializing Command Center Metrics
          </p>
          <p className="text-[11px] text-slate-500">
            Synchronizing cryptographic ledger state with NestJS backend...
          </p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <MotionReveal className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs space-y-4 font-sans">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-rose-300 uppercase tracking-wide">
              Dashboard Metric Error
            </h3>
            <p className="text-xs text-rose-400/90">{error}</p>
          </div>
        </div>
        <button
          onClick={loadStats}
          className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-lg shadow-rose-500/20"
        >
          Retry Connection
        </button>
      </MotionReveal>
    );
  }

  const isHealthy = stats.openIncidentsCount === 0;

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Command-Center Header */}
      <MotionReveal delayMs={0} className="relative overflow-hidden rounded-2xl layer-shell border p-6 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-400' : 'bg-rose-400'} animate-status-pulse`} />
                Command Center &bull; {user?.role || stats.role}
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                SHA-256 Cryptographic Engine
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Evidentiary Command & Control
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Welcome back, <strong className="text-slate-200">{user?.fullName || 'Officer'}</strong>. Live telemetry derived from PostgreSQL evidence storage & hash-chain ledger.
            </p>
          </div>

          {/* Quick Action Search */}
          <button
            onClick={() => onNavigate('search')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all duration-micro ease-cinematic active:scale-[0.97] cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>Search Evidence Bank</span>
          </button>
        </div>
      </MotionReveal>

      {/* 2. Security Posture Hero */}
      <MotionReveal delayMs={100}>
        <div
          className={`p-6 rounded-2xl border transition-all duration-standard ease-cinematic shadow-xl ${
            isHealthy
              ? 'bg-slate-900/70 border-slate-800 hover:border-emerald-500/40'
              : 'bg-rose-950/20 border-rose-500/50 shadow-rose-500/10'
          }`}
        >
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-2xl border shrink-0 ${
                  isHealthy
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                    : 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-status-pulse shadow-lg shadow-rose-500/20'
                }`}
              >
                {isHealthy ? <ShieldCheck className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-extrabold text-white tracking-tight">
                    {isHealthy ? 'SYSTEM SECURE & COMPLIANT' : 'CRITICAL INCIDENT ATTENTION REQUIRED'}
                  </h3>
                  <MotionStatus
                    status={isHealthy ? 'VERIFIED' : 'COMPROMISED'}
                    label={isHealthy ? 'MESH ACTIVE' : `${stats.openIncidentsCount} OPEN INCIDENT(S)`}
                  />
                </div>

                <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                  {isHealthy
                    ? `All ${stats.totalDocuments} managed document versions are cryptographic hash-verified. Zero unauthorized byte modifications or chain breaks detected.`
                    : `${stats.openIncidentsCount} active security incident(s) flagged by document byte-verification or audit chain checksum check. Immediate administrative review is required.`}
                </p>

                <div className="pt-2 flex items-center gap-4 text-[11px] font-mono text-slate-400 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{stats.approvedCount} Approved</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{stats.sealedCount} Sealed</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{stats.underReviewCount} Under Review</span>
                  </span>
                </div>
              </div>
            </div>

            {!isHealthy && (
              <button
                onClick={() => onNavigate('incidents')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs shadow-lg shadow-rose-500/20 transition-all duration-micro ease-cinematic active:scale-[0.97] cursor-pointer shrink-0"
              >
                <span>Inspect Incidents Queue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </MotionReveal>

      {/* 3. Quick Operational Actions Bar */}
      <MotionReveal delayMs={150}>
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => onNavigate('cases')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-all duration-micro ease-cinematic active:scale-[0.97] cursor-pointer shrink-0"
          >
            <Briefcase className="w-4 h-4 text-amber-400" />
            <span>Cases & Records ({stats.totalCases})</span>
          </button>

          <button
            onClick={() => onNavigate('approvals')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-all duration-micro ease-cinematic active:scale-[0.97] cursor-pointer shrink-0"
          >
            <CheckSquare className="w-4 h-4 text-amber-400" />
            <span>Approvals Queue</span>
            {stats.underReviewCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                {stats.underReviewCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onNavigate('audit')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-all duration-micro ease-cinematic active:scale-[0.97] cursor-pointer shrink-0"
          >
            <History className="w-4 h-4 text-sky-400" />
            <span>Audit Ledger</span>
          </button>

          <button
            onClick={() => onNavigate('incidents')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-all duration-micro ease-cinematic active:scale-[0.97] cursor-pointer shrink-0"
          >
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Security Incidents</span>
            {stats.openIncidentsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                {stats.openIncidentsCount}
              </span>
            )}
          </button>
        </div>
      </MotionReveal>

      {/* 4. KPI Intelligence Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            Operational Metrics Intelligence
          </h3>
          <span className="text-[11px] text-slate-500">Live PostgreSQL Metrics</span>
        </div>

        <MotionStagger staggerMs={50} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Assigned Cases */}
          <MotionCard onClick={() => onNavigate('cases')} className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assigned Cases</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Briefcase className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight">{stats.totalCases}</div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
              <span>Authorization Scope</span>
              <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                View List <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </MotionCard>

          {/* Total Documents */}
          <MotionCard onClick={() => onNavigate('search')} className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Documents</span>
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight">{stats.totalDocuments}</div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
              <span>SHA-256 Protected</span>
              <span className="text-sky-400 font-semibold flex items-center gap-0.5">
                Search <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </MotionCard>

          {/* Under Review */}
          <MotionCard onClick={() => onNavigate('approvals')} className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Under Review</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight">{stats.underReviewCount}</div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
              <span>Pending Review</span>
              <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                Review Queue <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </MotionCard>

          {/* Approved Documents */}
          <MotionCard onClick={() => onNavigate('search')} className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approved Documents</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight">{stats.approvedCount}</div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
              <span>Verified & Signoff</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                Browse <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </MotionCard>

          {/* Sealed Documents */}
          <MotionCard onClick={() => onNavigate('search')} className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sealed Documents</span>
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Lock className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight">{stats.sealedCount}</div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
              <span>Immutable Sealed State</span>
              <span className="text-indigo-400 font-semibold flex items-center gap-0.5">
                View Sealed <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </MotionCard>

          {/* Open Incidents */}
          <MotionCard onClick={() => onNavigate('incidents')} className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Open Incidents</span>
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight">{stats.openIncidentsCount}</div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
              <span>Security Warnings</span>
              <span className="text-rose-400 font-semibold flex items-center gap-0.5">
                Investigate <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </MotionCard>
        </MotionStagger>
      </div>

      {/* 5. Cryptographic Activity Ledger Stream */}
      <MotionReveal delayMs={250} className="rounded-2xl layer-panel border p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-amber-400" />
              Recent Cryptographic Audit Trail Stream
            </h3>
            <p className="text-xs text-slate-400">
              Immutable sequence log generated directly by backend SHA256 audit chaining.
            </p>
          </div>

          <button
            onClick={() => onNavigate('audit')}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <span>View Full Audit Ledger</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {stats.recentActivity.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 bg-slate-950/60 rounded-xl border border-slate-800/80 italic">
            No recent cryptographic audit events logged yet.
          </div>
        ) : (
          <MotionStagger staggerMs={40} className="space-y-2.5">
            {stats.recentActivity.map((evt) => (
              <div
                key={evt.id}
                className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between text-xs gap-4 transition-all duration-standard ease-cinematic"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="font-mono text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 shrink-0">
                    #{evt.sequenceNumber}
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-200 truncate">{evt.action}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      Officer: <strong className="text-slate-300">{evt.user?.fullName || 'System'}</strong> ({evt.user?.role || 'SYSTEM'}) &bull;{' '}
                      {new Date(evt.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                  <span className="hidden sm:inline-block text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                    {evt.currentEventHash.substring(0, 16)}...
                  </span>
                  <button
                    onClick={() => handleCopyHash(evt.currentEventHash)}
                    className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 cursor-pointer transition-colors"
                    title="Copy event hash"
                  >
                    {copiedHash === evt.currentEventHash ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </MotionStagger>
        )}
      </MotionReveal>
    </div>
  );
};
