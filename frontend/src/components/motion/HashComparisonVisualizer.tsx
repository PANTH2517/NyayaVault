import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ShieldAlert, Lock, RefreshCw } from 'lucide-react';

interface HashComparisonVisualizerProps {
  trustedHash: string;
  computedHash: string;
  isMatch: boolean;
}

export const HashComparisonVisualizer: React.FC<HashComparisonVisualizerProps> = ({
  trustedHash,
  computedHash,
  isMatch,
}) => {
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    setScanning(true);
    const timer = setTimeout(() => setScanning(false), 800);
    return () => clearTimeout(timer);
  }, [trustedHash, computedHash]);

  return (
    <div
      className={`p-6 rounded-2xl border transition-colors duration-500 shadow-2xl backdrop-blur-xl ${
        scanning
          ? 'bg-slate-900 border-amber-500/40 shadow-amber-500/10'
          : isMatch
          ? 'bg-slate-900/90 border-emerald-500/40 shadow-emerald-500/10'
          : 'bg-rose-950/40 border-rose-500/60 shadow-rose-500/20'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-400" />
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-200">
            Byte-Level SHA-256 Hash Comparison
          </h4>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          {scanning ? (
            <span className="flex items-center gap-1 text-amber-400">
              <RefreshCw className="w-3 h-3 animate-spin" /> Scanning File Bytes...
            </span>
          ) : isMatch ? (
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> MATCH &bull; ACCESS GRANTED
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold flex items-center gap-1 animate-pulse">
              <ShieldAlert className="w-3.5 h-3.5" /> MISMATCH &bull; ACCESS BLOCKED
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3 font-mono text-xs">
        {/* Trusted DB Hash */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Trusted Database Hash (Genesis / Upload Record)
          </div>
          <div className="text-amber-300 break-all select-all tracking-wide text-xs">
            {trustedHash}
          </div>
        </div>

        {/* Computed Storage Byte Hash */}
        <div
          className={`p-3 rounded-xl border space-y-1 transition-colors ${
            scanning
              ? 'bg-slate-950 border-amber-500/30 text-amber-200'
              : isMatch
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
            <span>Computed Hash (Downloaded Storage Bytes)</span>
            <span className="text-[9px] font-mono text-slate-500">Live SHA-256</span>
          </div>

          <div className="break-all select-all tracking-wide text-xs font-bold">
            {scanning ? (
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 0.6 }}
              >
                {computedHash}
              </motion.span>
            ) : (
              computedHash
            )}
          </div>
        </div>
      </div>

      {/* Resolution Outcome Banner */}
      {!scanning && !isMatch && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between font-medium"
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Integrity Failure: Document bytes altered after upload. Storage locked.</span>
          </div>
          <span className="text-[10px] font-mono font-bold uppercase bg-rose-900/60 px-2 py-0.5 rounded border border-rose-500/40">
            Critical Incident Created
          </span>
        </motion.div>
      )}
    </div>
  );
};
