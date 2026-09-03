import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Filter,
  Search,
} from 'lucide-react';
import { api } from '../../services/api';
import { SecurityIncident, IncidentStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { MotionStatus } from '../motion';

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
      setError(err.message || 'Unable to load security incidents.');
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
      alert(`Failed to update status: ${err.message}`);
    }
  };

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

  const openCount = incidents.filter((i) => i.status === 'OPEN').length;
  const criticalCount = incidents.filter(
    (i) => i.severity === 'CRITICAL' && i.status !== 'RESOLVED' && i.status !== 'DISMISSED'
  ).length;

  const isCriticalActive = criticalCount > 0 || openCount > 0;

  return (
    <div className="space-y-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <AlertTriangle className="w-7 h-7 text-amber-400" />
            Security Incidents
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Evidentiary alerts logged by system byte integrity verification and audit trail checks.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isCriticalActive ? 'bg-rose-400' : 'bg-emerald-400'}`} />
            <span>Active Incidents: <strong className="text-white">{openCount}</strong></span>
          </span>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-xl">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search incident ID, description, or type..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-mono"
          >
            <option value="ALL">All Statuses ({incidents.length})</option>
            <option value="OPEN">OPEN Only</option>
            <option value="INVESTIGATING">INVESTIGATING Only</option>
            <option value="RESOLVED">RESOLVED Only</option>
            <option value="DISMISSED">DISMISSED Only</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-mono"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">CRITICAL Only</option>
            <option value="HIGH">HIGH Only</option>
            <option value="MEDIUM">MEDIUM Only</option>
            <option value="LOW">LOW Only</option>
          </select>
        </div>
      </div>

      {/* Incident List */}
      {loading ? (
        <div className="text-center py-16 text-xs text-slate-400 font-sans">
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading security incidents...</span>
          </div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-sans">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-xs text-slate-500 bg-slate-900/40 rounded-3xl border border-slate-800 space-y-2 font-sans">
          <ShieldCheck className="w-8 h-8 text-emerald-500/60 mx-auto" />
          <p className="font-semibold text-slate-300">No Incidents Found</p>
          <p className="text-slate-500">No security incidents match the selected filter criteria.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((inc) => {
            const isCritical = inc.severity === 'CRITICAL';
            const isOpen = inc.status === 'OPEN';

            return (
              <div
                key={inc.id}
                className={`p-6 rounded-3xl border transition-all duration-300 shadow-xl backdrop-blur-xl ${
                  isCritical && isOpen
                    ? 'bg-rose-950/20 border-rose-500/50'
                    : isCritical
                    ? 'bg-slate-900/90 border-rose-500/30'
                    : inc.severity === 'HIGH'
                    ? 'bg-slate-900/90 border-amber-500/30'
                    : 'bg-slate-900/80 border-slate-800'
                }`}
              >
                <div className="space-y-4">
                  {/* Header Row */}
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <MotionStatus status={inc.severity} label={`${inc.severity} SEVERITY`} />
                        <MotionStatus status={inc.status} label={`STATUS: ${inc.status}`} />
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded-lg border border-slate-800">
                          {inc.incidentType}
                        </span>
                      </div>

                      <h3 className="text-sm font-extrabold text-white pt-0.5 flex items-center gap-2">
                        <span>Incident:</span>
                        <span className="font-mono text-amber-400">{inc.id}</span>
                      </h3>
                    </div>

                    <span className="text-[11px] font-mono text-slate-400">
                      Detected: {new Date(inc.detectedAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Description Box */}
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-rose-300 leading-relaxed break-words">
                    {inc.description}
                  </div>

                  {/* Context Metadata */}
                  {(inc.caseId || inc.documentId || inc.versionId) && (
                    <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 flex-wrap pt-1">
                      {inc.caseId && (
                        <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                          Case: {inc.caseId}
                        </span>
                      )}
                      {inc.documentId && (
                        <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                          Evidence: {inc.documentId}
                        </span>
                      )}
                      {inc.versionId && (
                        <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                          Version: {inc.versionId}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Admin Controls */}
                  {user?.role === 'ADMIN' && (
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-3 text-xs">
                      <span className="text-slate-400 font-semibold">Incident Lifecycle Action:</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {(['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'] as IncidentStatus[]).map(
                          (st) => (
                            <button
                              key={st}
                              onClick={() => handleUpdateStatus(inc.id, st)}
                              disabled={inc.status === st}
                              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                inc.status === st
                                  ? 'bg-slate-800 text-slate-500 border border-slate-700 opacity-50 cursor-not-allowed'
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
        </div>
      )}
    </div>
  );
};
