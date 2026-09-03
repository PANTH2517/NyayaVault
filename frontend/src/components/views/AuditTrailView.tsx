import React, { useEffect, useState } from 'react';
import {
  History,
  ShieldCheck,
  Search,
  Filter,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { AuditEvent } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { AuditLedgerTimeline } from '../motion';

export const AuditTrailView: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showHelp, setShowHelp] = useState(false);

  // Verification state
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean;
    totalEvents?: number;
    brokenAtSequence?: number;
    reason?: string;
    checkedAt: string;
  } | null>(null);

  const loadAuditTrail = async () => {
    setLoading(true);
    setError(null);
    try {
      let isoStart: string | undefined = undefined;
      let isoEnd: string | undefined = undefined;

      if (startDate) {
        isoStart = new Date(`${startDate}T00:00:00.000Z`).toISOString();
      }
      if (endDate) {
        isoEnd = new Date(`${endDate}T23:59:59.999Z`).toISOString();
      }

      const data = await api.getAuditEvents({
        startDate: isoStart,
        endDate: isoEnd,
      });
      setEvents(data || []);
    } catch (err: any) {
      setError(err.message || 'Unable to load audit trail events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditTrail();
  }, [startDate, endDate]);

  const handleVerifyChain = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await api.verifyAuditChain();
      setVerifyResult(res);
    } catch (err: any) {
      alert(`Audit verification failed: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  const handleClearDates = () => {
    setStartDate('');
    setEndDate('');
  };

  const filteredEvents = events.filter((evt) => {
    const matchesSearch =
      searchTerm === '' ||
      evt.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.sequenceNumber.toString().includes(searchTerm) ||
      evt.eventType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (evt.user?.fullName && evt.user.fullName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = typeFilter === 'ALL' || evt.eventType === typeFilter;
    return matchesSearch && matchesType;
  });

  const uniqueEventTypes = Array.from(new Set(events.map((e) => e.eventType)));

  return (
    <div className="space-y-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <History className="w-7 h-7 text-amber-400" />
            Audit Trail
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Immutable system audit log. Every evidence operation appends a cryptographically verified ledger entry.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap font-mono text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
            AUDIT EVENTS: <strong className="text-white font-bold">{events.length}</strong>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
            CHAIN STATUS:{' '}
            <strong className={verifyResult ? (verifyResult.valid ? 'text-emerald-400' : 'text-rose-400') : 'text-amber-400'}>
              {verifyResult ? (verifyResult.valid ? 'VERIFIED' : 'FAILED') : 'UNVERIFIED'}
            </strong>
          </div>

          {user?.role === 'ADMIN' && (
            <button
              onClick={handleVerifyChain}
              disabled={verifying}
              className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-sans text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{verifying ? 'Verifying...' : 'Verify Audit Chain'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Collapsible How Audit Hashing Works */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden text-xs">
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="w-full px-4 py-3 flex items-center justify-between text-slate-300 hover:text-amber-400 transition-colors font-semibold cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>How Audit Hash-Chain Verification Works</span>
          </div>
          {showHelp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showHelp && (
          <div className="p-4 border-t border-slate-800/80 bg-slate-950 text-slate-400 space-y-2 leading-relaxed font-sans">
            <p>
              Each audit record incorporates the exact SHA-256 hash of the immediately preceding audit event:
              <code className="ml-1 bg-slate-900 px-2 py-0.5 rounded text-amber-400 font-mono">
                H_n = SHA256(Data_n || H_n-1)
              </code>
            </p>
            <p>
              Modifying any historical record, timestamp, or actor detail invalidates all downstream hash calculations, immediately exposing administrative tampering.
            </p>
          </div>
        )}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-xl">
        {/* Text Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search action, user, or sequence..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>

        {/* Date Range Investigation Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-slate-400 text-[11px] font-mono">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none font-mono"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 text-[11px] font-mono">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none font-mono"
            />
          </div>

          {(startDate || endDate) && (
            <button
              onClick={handleClearDates}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Clear Date Filters"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Event Type Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-mono"
          >
            <option value="ALL">All Event Types ({events.length})</option>
            {uniqueEventTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Content */}
      {loading ? (
        <div className="text-center py-16 text-xs text-slate-400 font-sans">
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading audit log events...</span>
          </div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-sans">
          {error}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-xs text-slate-500 bg-slate-900/40 rounded-3xl border border-slate-800 space-y-2 font-sans">
          <History className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="font-semibold text-slate-300">No Audit Events Found</p>
          <p className="text-slate-500">
            {startDate || endDate
              ? 'No audit events match the selected date range filter.'
              : 'Audit events will appear here as system actions occur.'}
          </p>
        </div>
      ) : (
        <AuditLedgerTimeline
          events={filteredEvents}
          isVerifyingChain={verifying}
          verificationResult={verifyResult}
        />
      )}
    </div>
  );
};
