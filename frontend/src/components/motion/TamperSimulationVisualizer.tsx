import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Cpu, AlertTriangle, Lock, FileWarning } from 'lucide-react';

interface TamperSimulationVisualizerProps {
  versionId: string;
  isSimulating: boolean;
  result: {
    success: boolean;
    message: string;
    versionId: string;
    storagePath: string;
    trustedDbHash: string;
  } | null;
  onSimulate: () => void;
}

export const TamperSimulationVisualizer: React.FC<TamperSimulationVisualizerProps> = ({
  versionId,
  isSimulating,
  result,
  onSimulate,
}) => {
  const steps = [
    { label: 'STORAGE MUTATION', desc: 'Alters byte stream in Supabase Storage' },
    { label: 'SHA-256 RECALCULATION', desc: 'Computes hash on next access attempt' },
    { label: 'MISMATCH DETECTED', desc: 'Compares downloaded hash against DB' },
    { label: 'ACCESS BLOCKED', desc: 'Triggers HTTP 403 Forbidden' },
    { label: 'CRITICAL INCIDENT', desc: 'Appends SecurityIncident record' },
  ];

  return (
    <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileWarning className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-100">
            Admin Controlled Evidence Tamper Simulator
          </h3>
        </div>
        <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
          ADMIN SECURITY DEMO
        </span>
      </div>

      <p className="text-xs text-slate-400">
        Simulates storage byte mutation on version <code className="font-mono text-amber-300">{versionId}</code>. Database hashes and audit logs remain untouched. Next download will trigger automatic tamper detection and block access.
      </p>

      {/* Step Sequence Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-2">
        {steps.map((step, idx) => {
          const isActive = isSimulating || result !== null;
          return (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`p-2.5 rounded-xl border text-center font-mono ${
                isActive
                  ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              <div className="text-[9px] font-bold tracking-wider uppercase text-amber-400/90">
                Step 0{idx + 1}
              </div>
              <div className="text-[10px] font-bold mt-0.5">{step.label}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Action Button & Result Feedback */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          onClick={onSimulate}
          disabled={isSimulating}
          className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-600/20 active:scale-[0.98] cursor-pointer disabled:opacity-50"
        >
          {isSimulating ? (
            <>
              <Cpu className="w-4 h-4 animate-spin" />
              <span>Simulating Storage Mutation...</span>
            </>
          ) : (
            <>
              <ShieldAlert className="w-4 h-4" />
              <span>Trigger Controlled Byte Tamper</span>
            </>
          )}
        </button>

        {result && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-medium"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{result.message}</span>
          </motion.div>
        )}
      </div>
    </div>
  );
};
