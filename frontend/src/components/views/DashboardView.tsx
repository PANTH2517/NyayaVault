import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  FileText,
  Clock,
  AlertTriangle,
  ArrowRight,
  Shield,
  Search,
  CheckSquare,
  History,
  AlertCircle,
  Database,
  Lock,
  FileCheck,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Fingerprint,
  UserCheck,
  KeyRound,
  FileSearch,
} from 'lucide-react';
import { api } from '../../services/api';
import { DashboardStats, AuditEvent } from '../../types';
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

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDashboard();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Unable to load operational command center metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Skeleton loading state - avoids displaying fake zeros during fetch
  if (loading) {
    return (
      <div className="space-y-8 font-sans">
        {/* Command Center Hero Skeleton */}
        <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-6 animate-pulse">
          <div className="h-6 bg-slate-800 rounded w-1/4" />
          <div className="h-10 bg-slate-800 rounded w-1/2" />
          <div className="h-4 bg-slate-800 rounded w-2/3" />
          <div className="h-10 bg-slate-950 rounded-2xl border border-slate-800/80 w-1/3" />
        </div>

        {/* KPI Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-slate-800 rounded w-1/2" />
                <div className="h-8 bg-slate-800 rounded-xl w-8" />
              </div>
              <div className="h-8 bg-slate-800 rounded w-1/3" />
              <div className="h-3 bg-slate-800 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <MotionReveal className="p-8 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs space-y-4 font-sans shadow-2xl">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-7 h-7 text-rose-400 shrink-0" />
          <div>
            <h3 className="text-base font-extrabold text-rose-300">Unable to Load Command Center Operations</h3>
            <p className="text-xs text-rose-400/90 leading-relaxed mt-0.5">{error || 'Network query failed.'}</p>
          </div>
        </div>
        <button
          onClick={loadStats}
          className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-extrabold text-xs transition-all cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-rose-500/20"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Operation Query</span>
        </button>
      </MotionReveal>
    );
  }

  const hasAttentionItems = stats.underReviewCount > 0 || stats.openIncidentsCount > 0;
  const isHealthy = stats.openIncidentsCount === 0;

  const archFlow = [
    { title: 'CASE WORKSPACE', desc: `${stats.totalCases} Authorized`, icon: Briefcase },
    { title: 'EVIDENCE PAYLOAD', desc: `${stats.totalDocuments} Files`, icon: FileText },
    { title: 'SHA-256 DIGEST', desc: 'Byte Fingerprinted', icon: FileCheck },
    { title: 'AUDIT CHAIN', desc: `${stats.recentActivity.length} Ledger Logs`, icon: History },
    { title: 'BLOCKCHAIN PROOF', desc: 'Anchored Ledger', icon: Database },
  ];

  const getEventBadgeStyle = (eventType: string) => {
    if (eventType.includes('TAMPER') || eventType.includes('FAILED') || eventType.includes('INCIDENT')) {
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    }
    if (eventType.includes('APPROVED') || eventType.includes('VERIFIED') || eventType.includes('MFA_ENABLED')) {
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    }
    if (eventType.includes('SHARE') || eventType.includes('SUBMIT')) {
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    }
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  return (
    <div className="space-y-8 font-sans">
      {/* 1. Attention Required Banner */}
      {hasAttentionItems && (
        <MotionReveal className="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/30 space-y-4 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-amber-400 font-mono font-extrabold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
              <span>ATTENTION REQUIRED IN OPERATIONAL WORKSPACE</span>
            </div>
            <span className="text-[11px] font-mono text-amber-300/80 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
              Action Queue
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {stats.underReviewCount > 0 && (
              <div
                onClick={() => onNavigate('approvals')}
                className="p-4 rounded-2xl bg-slate-950/90 border border-amber-500/20 hover:border-amber-500/40 flex items-center justify-between cursor-pointer transition-all group shadow-md"
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    <Clock className="w-4 h-4 shrink-0" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                      {stats.underReviewCount} Evidence File(s) Awaiting Review
                    </div>
                    <div className="text-[11px] text-slate-400">Supervisor approval required for state transition</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
              </div>
            )}

            {stats.openIncidentsCount > 0 && (
              <div
                onClick={() => onNavigate('incidents')}
                className="p-4 rounded-2xl bg-slate-950/90 border border-rose-500/20 hover:border-rose-500/40 flex items-center justify-between cursor-pointer transition-all group shadow-md"
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-rose-300 transition-colors">
                      {stats.openIncidentsCount} Open Security Incident(s)
                    </div>
                    <div className="text-[11px] text-slate-400">System integrity & access alerts</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-rose-400 group-hover:translate-x-1 transition-transform" />
              </div>
            )}
          </div>
        </MotionReveal>
      )}

      {/* 2. Command Center Hero Overview & Real-Data Security Posture */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <MotionReveal className="lg:col-span-8 relative overflow-hidden rounded-3xl bg-slate-900/80 border border-slate-800/80 p-8 shadow-2xl backdrop-blur-2xl flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                NYAYAVAULT COMMAND CENTER
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400 animate-pulse'}`} />
                ROLE: {user?.role || stats.role}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              SECURE EVIDENCE <br />
              <span className="text-slate-400 font-normal">COMMAND CENTER</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl font-normal">
              Welcome, <strong className="text-white font-bold">{user?.fullName || 'Officer'}</strong>. Operational telemetry for authorized case files, evidence chain of custody, supervisor approvals, and immutable audit logs.
            </p>
          </div>

          {/* Role-Aware Quick Actions Bar */}
          <div className="flex items-center gap-3 flex-wrap pt-4 border-t border-slate-800/80">
            <button
              onClick={() => onNavigate('search')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Discover Evidence</span>
            </button>
            <button
              onClick={() => onNavigate('cases')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-bold transition-all cursor-pointer"
            >
              <Briefcase className="w-4 h-4 text-amber-400" />
              <span>Explore Cases ({stats.totalCases})</span>
            </button>
            <button
              onClick={() => onNavigate('approvals')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold transition-all cursor-pointer"
            >
              <CheckSquare className="w-4 h-4 text-emerald-400" />
              <span>Pending Reviews ({stats.underReviewCount})</span>
            </button>
          </div>
        </MotionReveal>

        {/* Real-Data Security Posture Element */}
        <MotionReveal delayMs={100} className="lg:col-span-4 flex">
          <SecurityPostureRing
            status={isHealthy ? 'SECURE' : 'COMPROMISED'}
            totalIncidents={stats.openIncidentsCount}
          />
        </MotionReveal>
      </div>

      {/* 3. Operational KPI Cards with Concise Explanations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cases Metric Card */}
        <MotionCard onClick={() => onNavigate('cases')} className="p-6 space-y-3.5 rounded-3xl bg-slate-900/80 border border-slate-800/80 cursor-pointer hover:border-amber-500/40 transition-all shadow-xl backdrop-blur-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">ASSIGNED CASES</span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="text-4xl font-extrabold text-white tracking-tight">
            <AnimatedNumber value={stats.totalCases} />
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Authorized case workspaces assigned under CBAC scope.
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2.5 border-t border-slate-800/80 font-mono">
            <span>Explore Scope</span>
            <span className="text-amber-400 font-bold flex items-center gap-1">
              View Cases <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </MotionCard>

        {/* Evidence Metric Card */}
        <MotionCard onClick={() => onNavigate('search')} className="p-6 space-y-3.5 rounded-3xl bg-slate-900/80 border border-slate-800/80 cursor-pointer hover:border-sky-500/40 transition-all shadow-xl backdrop-blur-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">EVIDENCE FILES</span>
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="text-4xl font-extrabold text-white tracking-tight">
            <AnimatedNumber value={stats.totalDocuments} />
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            SHA-256 byte fingerprinted & encrypted evidence artifacts.
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2.5 border-t border-slate-800/80 font-mono">
            <span>SHA-256 Verified</span>
            <span className="text-sky-400 font-bold flex items-center gap-1">
              Search <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </MotionCard>

        {/* Approvals Metric Card */}
        <MotionCard onClick={() => onNavigate('approvals')} className="p-6 space-y-3.5 rounded-3xl bg-slate-900/80 border border-slate-800/80 cursor-pointer hover:border-amber-500/40 transition-all shadow-xl backdrop-blur-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">PENDING REVIEW</span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-4xl font-extrabold text-white tracking-tight">
            <AnimatedNumber value={stats.underReviewCount} />
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Evidence revisions submitted for supervisor approval.
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2.5 border-t border-slate-800/80 font-mono">
            <span>Approval Queue</span>
            <span className="text-amber-400 font-bold flex items-center gap-1">
              Review Queue <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </MotionCard>

        {/* Security Alerts Metric Card */}
        <MotionCard onClick={() => onNavigate('incidents')} className="p-6 space-y-3.5 rounded-3xl bg-slate-900/80 border border-slate-800/80 cursor-pointer hover:border-rose-500/40 transition-all shadow-xl backdrop-blur-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">SECURITY ALERTS</span>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-4xl font-extrabold text-white tracking-tight">
            <AnimatedNumber value={stats.openIncidentsCount} />
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Integrity check discrepancies or access violations.
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2.5 border-t border-slate-800/80 font-mono">
            <span>Audit Alerts</span>
            <span className="text-rose-400 font-bold flex items-center gap-1">
              Inspect Incidents <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </MotionCard>
      </div>

      {/* 4. Role-Aware Next Actions Bar */}
      <MotionReveal delayMs={120} className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 space-y-4 shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4.5 h-4.5 text-amber-400" />
            <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
              Role-Aware Action Hub ({user?.role || stats.role})
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Authorized System Capabilities
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-sans">
          <div
            onClick={() => onNavigate('search')}
            className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 cursor-pointer transition-all space-y-1.5 group"
          >
            <div className="flex items-center justify-between font-bold text-white group-hover:text-amber-300">
              <span className="flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-amber-400" />
                Discover Digital Evidence
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Search evidence artifacts across cases, tags, and classification levels.
            </p>
          </div>

          <div
            onClick={() => onNavigate('cases')}
            className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 cursor-pointer transition-all space-y-1.5 group"
          >
            <div className="flex items-center justify-between font-bold text-white group-hover:text-amber-300">
              <span className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-amber-400" />
                Investigative Workspaces
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Access assigned investigation files, evidence logs, and personnel lists.
            </p>
          </div>

          <div
            onClick={() => onNavigate('audit')}
            className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 cursor-pointer transition-all space-y-1.5 group"
          >
            <div className="flex items-center justify-between font-bold text-white group-hover:text-amber-300">
              <span className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                Cryptographic Audit Log
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Inspect tamper-evident sequence numbers and cryptographic hashes.
            </p>
          </div>
        </div>
      </MotionReveal>

      {/* 5. Cryptographic Security Architecture Visualizer */}
      <MotionReveal delayMs={150} className="rounded-3xl bg-slate-900/80 border border-slate-800/80 p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-2xl">
        <div className="space-y-1">
          <div className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            PRODUCT SECURITY ARCHITECTURE
          </div>
          <h3 className="text-lg font-extrabold text-white">
            End-to-End Cryptographic Chain of Custody
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
            Authoritative system pipeline linking case assignments, document file encryption, SHA-256 integrity verification, immutable audit trail, and distributed blockchain anchor nodes.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
          {archFlow.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="relative p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex flex-col items-center text-center space-y-2 group hover:border-amber-500/40 transition-all"
              >
                <div className="p-3 rounded-xl bg-slate-900 text-amber-400 border border-slate-800 group-hover:border-amber-500/40 group-hover:bg-amber-500/10 transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-mono font-bold text-slate-200 group-hover:text-amber-300">
                    {step.title}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {step.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </MotionReveal>

      {/* 6. Recent Operational Audit Log Stream */}
      <MotionReveal delayMs={200} className="rounded-3xl bg-slate-900/80 border border-slate-800/80 p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-2xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-amber-400" />
              Recent Operational Audit Operations
            </h3>
            <p className="text-xs text-slate-400">
              Live tamper-evident audit log sequence recorded by backend ledger.
            </p>
          </div>

          <button
            onClick={() => onNavigate('audit')}
            className="text-xs font-mono font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 cursor-pointer transition-colors px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20"
          >
            <span>VIEW FULL AUDIT TRAIL</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {stats.recentActivity.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 bg-slate-950/60 rounded-2xl border border-slate-800/80 italic font-mono">
            No audit activity logged in authorized scope.
          </div>
        ) : (
          <MotionStagger staggerDelay={0.04} className="space-y-3">
            {stats.recentActivity.map((evt) => (
              <MotionStaggerItem key={evt.id}>
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs gap-4 hover:border-slate-700 transition-all">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="font-mono text-[11px] font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20 shrink-0">
                      #{evt.sequenceNumber}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-200 truncate flex items-center gap-2">
                        <span>{evt.action}</span>
                        <span className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase shrink-0 ${getEventBadgeStyle(evt.eventType)}`}>
                          {evt.eventType}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        User: <strong className="text-slate-300">{evt.user?.fullName || 'System'}</strong> ({evt.user?.role || 'SYSTEM'}) &bull;{' '}
                        <span className="font-mono">{new Date(evt.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                      VERIFIED
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
