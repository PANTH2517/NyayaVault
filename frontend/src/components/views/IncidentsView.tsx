import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle2, Clock, Filter } from 'lucide-react';
import { api } from '../../services/api';
import { SecurityIncident, IncidentStatus, IncidentSeverity } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const IncidentsView: React.FC = () => {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

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

  const severityBadges: Record<IncidentSeverity, string> = {
    CRITICAL: 'bg-rose-500 text-slate-950 font-extrabold shadow-lg shadow-rose-500/20 animate-pulse',
    HIGH: 'bg-rose-500/20 text-rose-300 border-rose-500/30 font-bold',
    MEDIUM: 'bg-amber-500/20 text-amber-300 border-amber-500/30 font-bold',
    LOW: 'bg-sky-500/20 text-sky-300 border-sky-500/30 font-bold',
  };

  const statusBadges: Record<IncidentStatus, string> = {
    OPEN: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    INVESTIGATING: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    RESOLVED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    DISMISSED: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  const filtered = incidents.filter(
    (inc) => statusFilter === 'ALL' || inc.status === statusFilter
  );

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
            Security Incident Log & Escalation
          </h2>
          <p className="text-xs text-slate-400">
            Automatically generated security alerts triggered by byte-tamper checks or audit anomalies.
          </p>
        </div>

        {/* Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
        >
          <option value="ALL">All Incident Statuses</option>
          <option value="OPEN">OPEN Only</option>
          <option value="INVESTIGATING">INVESTIGATING</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="DISMISSED">DISMISSED</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-xs text-slate-400">Loading security incidents...</div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto" />
          <p className="font-semibold text-slate-300">No Security Incidents Logged</p>
          <p className="text-slate-500">System integrity remains clean with zero active security alerts.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((inc) => (
            <div
              key={inc.id}
              className={`p-5 rounded-2xl bg-slate-900/80 border space-y-4 shadow-xl ${
                inc.severity === 'CRITICAL' && inc.status === 'OPEN'
                  ? 'border-rose-500/60 bg-rose-950/20'
                  : 'border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full ${
                        severityBadges[inc.severity]
                      }`}
                    >
                      {inc.severity} SEVERITY
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                        statusBadges[inc.status]
                      }`}
                    >
                      STATUS: {inc.status}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      Type: {inc.incidentType}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white pt-1">
                    Incident ID: <span className="font-mono text-amber-400">{inc.id.substring(0, 18)}...</span>
                  </h3>
                </div>

                <span className="text-[11px] text-slate-400">
                  Detected: {new Date(inc.detectedAt).toLocaleString()}
                </span>
              </div>

              {/* Description Alert Message */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-rose-300 leading-relaxed">
                {inc.description}
              </div>

              {/* Critical Alert Sub-banner */}
              {inc.severity === 'CRITICAL' && (
                <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>ACCESS BLOCKED — ORIGINAL CONTENT HASH DOES NOT MATCH STORED FILE</span>
                </div>
              )}

              {/* Admin Status Management Buttons */}
              {user?.role === 'ADMIN' && (
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <span className="text-slate-500">Update Incident Status (Admin Action):</span>
                  <div className="flex items-center gap-2">
                    {(['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'] as IncidentStatus[]).map(
                      (st) => (
                        <button
                          key={st}
                          onClick={() => handleUpdateStatus(inc.id, st)}
                          disabled={inc.status === st}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                            inc.status === st
                              ? 'bg-slate-800 text-slate-400 border border-slate-700 opacity-50'
                              : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
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
          ))}
        </div>
      )}
    </div>
  );
};
