import React from 'react';
import {
  ShieldCheck,
  Lock,
  FileCheck2,
  GitCommit,
  History,
  AlertTriangle,
  UserCheck,
  FolderCheck,
  FileCode,
  Zap,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';

export const AboutView: React.FC = () => {
  const flowSteps = [
    { num: '01', title: 'AUTHENTICATE', desc: 'Argon2 password verification & NestJS JWT access token issue', icon: UserCheck },
    { num: '02', title: 'AUTHORIZE', desc: 'Role-Based Access Control (RBAC) evaluates user role claims', icon: UserCheck },
    { num: '03', title: 'ASSIGN CASE', desc: 'Case-Based Access Control (CBAC) scopes evidence visibility', icon: FolderCheck },
    { num: '04', title: 'UPLOAD EVIDENCE', desc: 'Investigating Officer uploads evidence document file stream', icon: FileCode },
    { num: '05', title: 'COMPUTE CHECKSUM', desc: 'SHA-256 integrity checksum calculated from uploaded bytes', icon: ShieldCheck },
    { num: '06', title: 'VERSION DOCUMENT', desc: 'Immutable version created & stored in private storage', icon: GitCommit },
    { num: '07', title: 'REVIEW / APPROVE', desc: 'Supervisor reviews version details and issues approval', icon: FileCheck2 },
    { num: '08', title: 'SEAL', desc: 'Finalized document sealed to prevent further versioning', icon: Lock },
    { num: '09', title: 'AUDIT LOG', desc: 'Action recorded in tamper-evident audit ledger', icon: History },
    { num: '10', title: 'VERIFY', desc: 'SHA-256 recomputed from stored file bytes during download', icon: CheckCircle2 },
    { num: '11', title: 'DETECT TAMPER', desc: 'Byte comparison catches storage file manipulation', icon: Zap },
    { num: '12', title: 'BLOCK ACCESS', desc: 'HTTP 403 Access Blocked issued on checksum mismatch', icon: AlertTriangle },
  ];

  const rolesList = [
    {
      role: 'ADMIN',
      title: 'System Administrator',
      desc: 'System administration, user account management, case assignment, security controls, and audit verification.',
      badgeStyle: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    },
    {
      role: 'INVESTIGATING_OFFICER',
      title: 'Investigating Officer',
      desc: 'Manages assigned investigative cases, uploads initial evidence (v1), and uploads document revisions (vN) under CBAC rules.',
      badgeStyle: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    },
    {
      role: 'SUPERVISOR',
      title: 'Superintendent / Supervisor',
      desc: 'Reviews pending document submission queues, approves/rejects specific document versions, and seals finalized evidence cases.',
      badgeStyle: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    },
    {
      role: 'PROSECUTOR',
      title: 'Public Prosecutor',
      desc: 'Accesses authorized case evidence for legal prosecution and verifies cryptographic checksums and chain-of-custody ledgers.',
      badgeStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    },
  ];

  return (
    <div className="space-y-8 font-sans pb-12">
      {/* Header Bar */}
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
          <BookOpen className="w-7 h-7 text-amber-400" />
          How It Works
        </h1>
        <p className="text-xs text-slate-400 font-semibold mt-1">
          Operational overview of evidence processing pipelines, access controls, and tamper protection.
        </p>
      </div>

      {/* SECTION 1 — EVIDENTIARY FLOW */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            Evidence Processing Pipeline
          </h2>
          <p className="text-xs text-slate-400">
            Lifecycle flow from user authentication to automated tamper detection.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {flowSteps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 hover:border-amber-500/40 transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    #{step.num}
                  </span>
                  <Icon className="w-4 h-4 text-slate-400" />
                </div>
                <h3 className="text-xs font-extrabold text-white">{step.title}</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2 — RBAC & AUTHORIZATION */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-amber-400" />
            Role-Based Access Control (RBAC)
          </h2>
          <p className="text-xs text-slate-400">
            Four specialized system roles with strict authority separation enforced by NestJS API guards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rolesList.map((r) => (
            <div key={r.role} className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${r.badgeStyle}`}>
                  {r.role}
                </span>
                <span className="text-xs font-bold text-slate-200">{r.title}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed pt-1">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
