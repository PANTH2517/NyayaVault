import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  Clock,
  CheckCircle2,
  Lock,
  AlertTriangle,
} from 'lucide-react';

export type SupportedSecurityState =
  | 'VERIFIED'
  | 'NOT_YET_VERIFIED'
  | 'COMPROMISED'
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'SEALED'
  | 'OPEN'
  | 'INVESTIGATING'
  | 'RESOLVED'
  | 'DISMISSED'
  | 'CRITICAL'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW';

interface MotionStatusProps {
  status: SupportedSecurityState | string;
  label?: string;
  className?: string;
}

const statusConfig: Record<
  string,
  { defaultLabel: string; style: string; icon: React.ComponentType<{ className?: string }> }
> = {
  VERIFIED: {
    defaultLabel: 'VERIFIED',
    style: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10',
    icon: ShieldCheck,
  },
  NOT_YET_VERIFIED: {
    defaultLabel: 'NOT YET VERIFIED',
    style: 'bg-slate-800 text-slate-400 border-slate-700',
    icon: Shield,
  },
  COMPROMISED: {
    defaultLabel: 'COMPROMISED',
    style: 'bg-rose-500/20 text-rose-400 border-rose-500/50 animate-status-pulse shadow-md shadow-rose-500/20',
    icon: ShieldAlert,
  },
  DRAFT: {
    defaultLabel: 'DRAFT',
    style: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    icon: Clock,
  },
  UNDER_REVIEW: {
    defaultLabel: 'UNDER REVIEW',
    style: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    icon: Clock,
  },
  APPROVED: {
    defaultLabel: 'APPROVED',
    style: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    icon: CheckCircle2,
  },
  SEALED: {
    defaultLabel: 'SEALED',
    style: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    icon: Lock,
  },
  OPEN: {
    defaultLabel: 'OPEN',
    style: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    icon: AlertTriangle,
  },
  INVESTIGATING: {
    defaultLabel: 'INVESTIGATING',
    style: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    icon: Clock,
  },
  RESOLVED: {
    defaultLabel: 'RESOLVED',
    style: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    icon: CheckCircle2,
  },
  DISMISSED: {
    defaultLabel: 'DISMISSED',
    style: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    icon: Shield,
  },
  CRITICAL: {
    defaultLabel: 'CRITICAL',
    style: 'bg-rose-500 text-slate-950 font-extrabold border-rose-400 animate-status-pulse',
    icon: AlertTriangle,
  },
  HIGH: {
    defaultLabel: 'HIGH',
    style: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    icon: AlertTriangle,
  },
  MEDIUM: {
    defaultLabel: 'MEDIUM',
    style: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    icon: AlertTriangle,
  },
  LOW: {
    defaultLabel: 'LOW',
    style: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    icon: AlertTriangle,
  },
};

export const MotionStatus: React.FC<MotionStatusProps> = ({
  status,
  label,
  className = '',
}) => {
  const config = statusConfig[status] || {
    defaultLabel: status,
    style: 'bg-slate-800 text-slate-300 border-slate-700',
    icon: Shield,
  };

  const IconComponent = config.icon;
  const displayText = label || config.defaultLabel;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold
        transition-all duration-standard ease-cinematic gpu-accelerate
        ${config.style}
        ${className}
      `}
    >
      <IconComponent className="w-3.5 h-3.5 shrink-0" />
      <span>{displayText}</span>
    </span>
  );
};
