import React from 'react';
import { motion } from 'framer-motion';
import { AuditEvent } from '../../types';
import { ShieldCheck, ShieldAlert, Link, Clock, User, FileText } from 'lucide-react';

interface AuditLedgerTimelineProps {
  events: AuditEvent[];
  isVerifyingChain?: boolean;
  verificationResult?: { valid: boolean; totalEvents?: number; brokenAtSequence?: number; reason?: string } | null;
}

export const AuditLedgerTimeline: React.FC<AuditLedgerTimelineProps> = ({
  events,
  isVerifyingChain = false,
  verificationResult = null,
}) => {
  return (
    <div className="space-y-4">
      {/* Verification Status Banner */}
      {verificationResult && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl border flex items-center justify-between shadow-xl ${
            verificationResult.valid
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {verificationResult.valid ? (
              <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 animate-bounce" />
            )}
            <div>
              <h4 className="text-sm font-bold tracking-tight">
                {verificationResult.valid
                  ? 'Cryptographic Hash Chain Verified'
                  : 'AUDIT CHAIN VERIFICATION FAILED'}
              </h4>
              <p className="text-xs text-slate-300 font-mono mt-0.5">
                {verificationResult.valid
                  ? `All ${verificationResult.totalEvents || events.length} audit events cryptographically verified from Genesis Hash.`
                  : `Chain link broken at Sequence #${verificationResult.brokenAtSequence}. Reason: ${verificationResult.reason}`}
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold uppercase px-3 py-1 rounded-xl bg-slate-950 border border-slate-800">
            {verificationResult.valid ? '100% Intact' : 'Tampered Chain'}
          </span>
        </motion.div>
      )}

      {/* Ledger Chain Items */}
      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-amber-500/50 before:via-indigo-500/30 before:to-emerald-500/50">
        {events.map((evt, idx) => {
          const isBroken =
            verificationResult &&
            !verificationResult.valid &&
            Number(evt.sequenceNumber) === verificationResult.brokenAtSequence;

          return (
            <motion.div
              key={evt.id}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.3 }}
              className={`relative p-4 rounded-xl border transition-all ${
                isVerifyingChain
                  ? 'border-amber-500/40 bg-slate-900/90 shadow-amber-500/10'
                  : isBroken
                  ? 'bg-rose-950/70 border-rose-500/60 shadow-xl shadow-rose-500/20'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Timeline Connector Node */}
              <div
                className={`absolute -left-[31px] top-4 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  isBroken
                    ? 'bg-rose-600 border-rose-400 text-white'
                    : 'bg-slate-950 border-amber-500 text-amber-400'
                }`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-current" />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    Seq #{evt.sequenceNumber.toString()}
                  </span>
                  <span className="text-xs font-bold text-slate-200">{evt.eventType}</span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-500" />
                    {evt.user?.fullName || evt.userId || 'System'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {new Date(evt.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 font-medium mb-3">{evt.action}</p>

              {/* Cryptographic Link Hashes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono">
                <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                  <div className="text-slate-500 flex items-center gap-1">
                    <Link className="w-3 h-3 text-amber-400" />
                    <span>Previous Event Hash:</span>
                  </div>
                  <div className="text-slate-400 truncate mt-0.5">
                    {evt.previousEventHash || 'GENESIS (0000...0000)'}
                  </div>
                </div>

                <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                  <div className="text-slate-500 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-emerald-400" />
                    <span>Current SHA-256 Hash:</span>
                  </div>
                  <div className="text-emerald-400 font-bold truncate mt-0.5">
                    {evt.currentEventHash}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
