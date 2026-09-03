import React from 'react';
import { motion } from 'framer-motion';
import { DocumentStatus } from '../../types';
import { FileEdit, Clock, CheckCircle2, Lock } from 'lucide-react';

interface WorkflowStateBadgeProps {
  status: DocumentStatus;
  className?: string;
}

export const WorkflowStateBadge: React.FC<WorkflowStateBadgeProps> = ({
  status,
  className = '',
}) => {
  const configs = {
    DRAFT: {
      label: 'DRAFT',
      color: 'bg-slate-800 text-slate-300 border-slate-700',
      icon: FileEdit,
    },
    UNDER_REVIEW: {
      label: 'UNDER REVIEW',
      color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      icon: Clock,
    },
    APPROVED: {
      label: 'APPROVED',
      color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: CheckCircle2,
    },
    SEALED: {
      label: 'SEALED & IMMUTABLE',
      color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm shadow-indigo-500/20',
      icon: Lock,
    },
  };

  const config = configs[status] || configs.DRAFT;
  const Icon = config.icon;

  return (
    <motion.span
      layout
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold tracking-wider uppercase border ${config.color} ${className}`}
    >
      <Icon className="w-3 h-3" />
      <span>{config.label}</span>
    </motion.span>
  );
};
