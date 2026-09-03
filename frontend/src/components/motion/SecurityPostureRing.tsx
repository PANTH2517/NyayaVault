import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, AlertTriangle, Lock, Cpu } from 'lucide-react';

interface SecurityPostureRingProps {
  status: 'SECURE' | 'COMPROMISED';
  totalIncidents?: number;
  auditChainValid?: boolean;
}

export const SecurityPostureRing: React.FC<SecurityPostureRingProps> = ({
  status,
  totalIncidents = 0,
  auditChainValid = true,
}) => {
  const isSecure = status === 'SECURE' && auditChainValid && totalIncidents === 0;

  return (
    <div className="relative flex flex-col items-center justify-center p-8 rounded-3xl bg-slate-900/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl overflow-hidden">
      {/* Background Radial Glow */}
      <div
        className={`absolute inset-0 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-700 ${
          isSecure ? 'bg-emerald-500' : 'bg-rose-500'
        }`}
      />

      <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">
        {/* Outer Rotating Segmented Ring */}
        <motion.svg
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 25, ease: 'linear' }}
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 200 200"
        >
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke={isSecure ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.3)'}
            strokeWidth="3"
            strokeDasharray="12 8 20 8 4 8"
          />
        </motion.svg>

        {/* Inner Counter-Rotating Pulsing Ring */}
        <motion.svg
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 18, ease: 'linear' }}
          className="absolute inset-2 w-[calc(100%-16px)] h-[calc(100%-16px)]"
          viewBox="0 0 200 200"
        >
          <circle
            cx="100"
            cy="100"
            r="82"
            fill="none"
            stroke={isSecure ? 'rgba(245, 158, 11, 0.3)' : 'rgba(244, 63, 94, 0.4)'}
            strokeWidth="2"
            strokeDasharray="40 10 15 10"
          />
        </motion.svg>

        {/* Center Shield Core */}
        <motion.div
          animate={{
            scale: isSecure ? [1, 1.03, 1] : [1, 1.06, 1],
          }}
          transition={{
            repeat: Infinity,
            duration: isSecure ? 3 : 1.5,
            ease: 'easeInOut',
          }}
          className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center text-center shadow-2xl border ${
            isSecure
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400 shadow-emerald-500/20'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-400 shadow-rose-500/20'
          }`}
        >
          {isSecure ? (
            <ShieldCheck className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow-md" />
          ) : (
            <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow-md animate-bounce" />
          )}

          <div className="mt-1 font-mono text-[10px] uppercase font-bold tracking-widest">
            {isSecure ? 'ARMED' : 'ALERT'}
          </div>
        </motion.div>
      </div>

      {/* Posture Status Label & Details */}
      <div className="mt-6 text-center space-y-1.5">
        <h3 className="text-lg font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
          {isSecure ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>SYSTEM SECURE</span>
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="text-rose-400">CRITICAL THREAT DETECTED</span>
            </>
          )}
        </h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          {isSecure
            ? 'Argon2 Authentication, Multi-Session Tokens & SHA-256 Audit Chain Active.'
            : `${totalIncidents} active security incident(s) detected. Cryptographic verification warning.`}
        </p>
      </div>

      {/* Sub-status badges */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono">
        <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1.5">
          <Lock className="w-3 h-3 text-amber-400" />
          <span>Argon2 + HTTP Cookies</span>
        </div>
        <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1.5">
          <Cpu className="w-3 h-3 text-cyan-400" />
          <span>Hash Chain: {auditChainValid ? 'VERIFIED' : 'BROKEN'}</span>
        </div>
      </div>
    </div>
  );
};
