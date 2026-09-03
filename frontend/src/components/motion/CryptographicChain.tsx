import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Layers, Hash, ShieldCheck, AlertOctagon, CheckCircle2 } from 'lucide-react';

interface CryptographicChainProps {
  documentTitle: string;
  versionNumber: number;
  sha256Hash: string;
  isVerifying?: boolean;
  isValid?: boolean;
  isCompromised?: boolean;
}

export const CryptographicChain: React.FC<CryptographicChainProps> = ({
  documentTitle,
  versionNumber,
  sha256Hash,
  isVerifying = false,
  isValid = true,
  isCompromised = false,
}) => {
  const steps = [
    { id: 'doc', title: 'DOCUMENT', subtitle: documentTitle, icon: FileText },
    { id: 'ver', title: 'VERSION', subtitle: `v${versionNumber} Immutability`, icon: Layers },
    { id: 'hash', title: 'SHA-256 HASH', subtitle: `${sha256Hash.substring(0, 10)}...`, icon: Hash },
    {
      id: 'verify',
      title: 'VERIFICATION',
      subtitle: isVerifying ? 'Scanning Bytes...' : 'Cryptographic Match',
      icon: isVerifying ? ShieldCheck : ShieldCheck,
    },
    {
      id: 'decision',
      title: 'ACCESS DECISION',
      subtitle: isCompromised || !isValid ? 'ACCESS BLOCKED' : 'ACCESS GRANTED',
      icon: isCompromised || !isValid ? AlertOctagon : CheckCircle2,
    },
  ];

  return (
    <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-md space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Chain-of-Trust Verification Lineage</span>
        </h3>
        <span className="text-[10px] font-mono text-slate-500">SHA-256 Byte Verification</span>
      </div>

      {/* Chain Nodes Container */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isLast = idx === steps.length - 1;
          const isDenied = isLast && (isCompromised || !isValid);

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.3 }}
              className={`p-3.5 rounded-xl border flex flex-col items-center text-center relative ${
                isDenied
                  ? 'bg-rose-950/60 border-rose-500/50 text-rose-300 shadow-lg shadow-rose-500/10'
                  : isLast
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-950 border-slate-800 text-slate-200'
              }`}
            >
              <div
                className={`p-2.5 rounded-xl mb-2 ${
                  isDenied
                    ? 'bg-rose-500/20 text-rose-400'
                    : isLast
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>

              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {step.title}
              </div>
              <div className="text-xs font-semibold mt-0.5 truncate max-w-full font-mono">
                {step.subtitle}
              </div>

              {/* Animated Connecting Line to next node (hidden on mobile / last node) */}
              {!isLast && (
                <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <motion.div
                    animate={{ x: [0, 4, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                    className="w-2.5 h-0.5 bg-amber-400/60 rounded-full shadow-sm shadow-amber-400"
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
