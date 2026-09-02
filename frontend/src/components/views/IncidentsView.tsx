import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  Shield,
  Activity,
  ArrowRight,
  FileCode,
  Lock,
} from 'lucide-react';
import { api } from '../../services/api';
import { SecurityIncident, IncidentStatus, IncidentSeverity } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { MotionCard, MotionReveal, MotionStagger, MotionStatus } from '../motion';

export const IncidentsView: React.FC = () => {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadIncidents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getIncidents();
      setIncidents(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch security incidents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: IncidentStatus) => {
    try {
      await api.updateIncidentStatus(id, newStatus);
      loadIncidents();
    } catch (err: any) {
      alert(`Update status failed: ${err.message}`);
    }
  };

  // Client-side filtering over real incident data
  const filtered = incidents.filter((inc) => {
    const matchesStatus = statusFilter === 'ALL' || inc.status === statusFilter;
    const matchesSeverity = severityFilter === 'ALL' || inc.severity === severityFilter;
    const matchesSearch =
      searchTerm === '' ||
      inc.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.incidentType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inc.caseId && inc.caseId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inc.documentId && inc.documentId.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesStatus && matchesSeverity && matchesSearch;
  });

  // Calculate real metrics from loaded incidents
  const openCount = incidents.filter((i) => i.status === 'OPEN').length;
  const investigatingCount = incidents.filter((i) => i.status === 'INVESTIGATING').length;
  const criticalCount = incidents.filter(
    (i) => i.severity === 'CRITICAL' && i.status !== 'RESOLVED' && i.status !== 'DISMISSED'
  ).length;
  const resolvedCount = incidents.filter((i) => i.status === 'RESOLVED' || i.status === 'DISMISSED').length;

  const isCriticalActive = criticalCount > 0 || openCount > 0;

  return (
    <div className="space-y-6 font-sans">
      {/* 1. SECURITY OPERATIONS HEADER */}
      <MotionReveal delayMs={0} className="p-6 rounded-2xl layer-shell border space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Security Operations Center
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                {incidents.length} Total Incident Records
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Incident Response & Threat Queue
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automated evidentiary alerts triggered by NestJS byte integrity interceptors, SHA-256 hash mismatches, or audit chain sequence breaks.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isCriticalActive ? 'bg-rose-400 animate-status-pulse' : 'bg-emerald-400'}`} />
              <span>Role: <strong className="text-slate-200">{user?.role}</strong></span>
            </span>
          </div>
        </div>
      </MotionReveal>

      {/* 2. SECURITY POSTURE SUMMARY HERO */}
      <MotionReveal delayMs={50}>
        <div
          className={`p-6 rounded-2xl border transition-all duration-standard ease-cinematic shadow-xl ${
            isCriticalActive
              ? 'bg-rose-950/20 border-rose-500/50 shadow-rose-500/10'
              : 'bg-emerald-950/20 border-emerald-500/40 shadow-emerald-500/10'
          }`}
        >
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-2xl border shrink-0 ${
                  isCriticalActive
                    ? 'bg-rose-500 text-slate-950 font-bold border-rose-400 shadow-lg shadow-rose-500/20 animate-status-pulse'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                }`}
              >
                {isCriticalActive ? (
                  <ShieldAlert className="w-8 h-8 text-slate-950" />
                ) : (
                  <ShieldCheck className="w-8 h-8 text-emerald-400" />
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2
                    className={`text-lg font-extrabold tracking-tight ${
                      isCriticalActive ? 'text-rose-400' : 'text-emerald-300'
                    }`}
                  >
                    {isCriticalActive
                      ? 'CRITICAL SECURITY ATTENTION REQUIRED'
                      : 'SECURITY POSTURE CLEAR & HEALTHY'}
                  </h2>

                  <MotionStatus
                    status={isCriticalActive ? 'CRITICAL' : 'RESOLVED'}
                    label={isCriticalActive ? `${openCount} ACTIVE THREAT(S)` : 'POSTURE NORMAL'}
                  />
                </div>

                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  {isCriticalActive
                    ? `${openCount} open incident(s) and ${criticalCount} critical threat(s) logged by cryptographic interceptors. Immediate administrative investigation is recommended.`
                    : 'Zero open security threats detected in the system queue. All digital evidence documents and audit logs maintain intact cryptographic hash signatures.'}
                </p>

                {/* Real Incident Telemetry Pill Summary */}
                <div className="pt-2 flex items-center gap-4 text-[11px] font-mono text-slate-400 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    <span>{openCount} Open</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>{investigatingCount} Investigating</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>{resolvedCount} Resolved / Dismissed</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MotionReveal>

      {/* 3. FILTERS & SEARCH TOOLBAR */}
      <MotionReveal delayMs={100} className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl layer-panel border">
        <div className="flex items-center gap-3 flex-1 min-w-[220px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by incident ID, description, or type..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-mono"
          >
            <option value="ALL">All Statuses ({incidents.length})</option>
            <option value="OPEN">OPEN Only</option>
            <option value="INVESTIGATING">INVESTIGATING Only</option>
            <option value="RESOLVED">RESOLVED Only</option>
            <option value="DISMISSED">DISMISSED Only</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-mono"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">CRITICAL Only</option>
            <option value="HIGH">HIGH Only</option>
            <option value="MEDIUM">MEDIUM Only</option>
            <option value="LOW">LOW Only</option>
          </select>
        </div>
      </MotionReveal>

      {/* 4. INCIDENT RESPONSE QUEUE */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center space-y-3 text-slate-400 text-xs">
          <Activity className="w-6 h-6 animate-spin text-amber-400" />
          <p className="font-semibold text-slate-300">Loading Incident Telemetry...</p>
        </div>
      ) : error ? (
        <MotionReveal className="p-5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          {error}
        </MotionReveal>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto" />
          <p className="font-semibold text-slate-300">No Incidents Found</p>
          <p className="text-slate-500">No security incidents match the current filter criteria.</p>
        </div>
      ) : (
        <MotionStagger staggerMs={50} className="space-y-4">
          {filtered.map((inc) => {
            const isCritical = inc.severity === 'CRITICAL';
            const isOpen = inc.status === 'OPEN';

            return (
              <div
                key={inc.id}
                className={`p-6 rounded-2xl border transition-all duration-standard ease-cinematic shadow-xl ${
                  isCritical && isOpen
                    ? 'bg-rose-950/20 border-rose-500/60 shadow-rose-500/10'
                    : isCritical
                    ? 'bg-slate-900/90 border-rose-500/40'
                    : inc.severity === 'HIGH'
                    ? 'layer-panel border-amber-500/30'
                    : 'layer-panel border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-4">
                  {/* Header Row */}
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Severity Badge */}
                        <MotionStatus status={inc.severity} label={`${inc.severity} SEVERITY`} />

                        {/* Status Badge */}
                        <MotionStatus status={inc.status} label={`STATUS: ${inc.status}`} />

                        {/* Incident Type Tag */}
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
                          Type: {inc.incidentType}
                        </span>
                      </div>

                      <h3 className="text-sm font-extrabold text-white pt-0.5 flex items-center gap-2">
                        <span>Incident Record:</span>
                        <span className="font-mono text-amber-400">{inc.id}</span>
                      </h3>
                    </div>

                    <span className="text-[11px] font-mono text-slate-400">
                      Detected: {new Date(inc.detectedAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Description Code Container */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-rose-300 leading-relaxed break-words">
                    {inc.description}
                  </div>

                  {/* Critical Security Callout Banner */}
                  {isCritical && (
                    <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-2.5">
                      <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 animate-status-pulse" />
                      <div>
                        <div>ACCESS BLOCKED — ORIGINAL CONTENT HASH DOES NOT MATCH STORED FILE</div>
                        <div className="text-[11px] font-normal text-rose-300/80 mt-0.5">
                          Cryptographic byte discrepancy flagged by NestJS document security interceptor.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Context Metadata Pills (if available) */}
                  {(inc.caseId || inc.documentId || inc.versionId) && (
                    <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 flex-wrap pt-1">
                      {inc.caseId && (
                        <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800">
                          Case UUID: {inc.caseId}
                        </span>
                      )}
                      {inc.documentId && (
                        <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800">
                          Doc UUID: {inc.documentId}
                        </span>
                      )}
                      {inc.versionId && (
                        <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800">
                          Version UUID: {inc.versionId}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Admin Lifecycle Status Control Toolbar */}
                  {user?.role === 'ADMIN' && (
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-3 text-xs">
                      <span className="text-slate-400 font-semibold">Administrative Incident Lifecycle Action:</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {(['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'] as IncidentStatus[]).map(
                          (st) => (
                            <button
                              key={st}
                              onClick={() => handleUpdateStatus(inc.id, st)}
                              disabled={inc.status === st}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-micro ease-cinematic cursor-pointer active:scale-[0.97] ${
                                inc.status === st
                                  ? 'bg-slate-800 text-slate-400 border border-slate-700 opacity-50 cursor-not-allowed'
                                  : 'bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-amber-500/40'
                              }`}
                            >
                              Set {st}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </MotionStagger>
      )}
    </div>
  );
};
