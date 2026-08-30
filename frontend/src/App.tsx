import React, { useState } from 'react';
import { Shield, Lock, FileText, Activity, Server, Database, CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [healthStatus, setHealthStatus] = useState<{
    status?: string;
    service?: string;
    timestamp?: string;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/health');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setHealthStatus(data);
    } catch (err: any) {
      setHealthStatus({ error: err.message || 'Failed to connect to backend' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950 font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500 shadow-lg shadow-amber-500/10">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              NyayaVault <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium">v0.1 Foundation</span>
            </h1>
            <p className="text-xs text-slate-400">Secure Digital Document Management System</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={checkHealth}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Activity className={`w-4 h-4 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Testing Connection...' : 'Check Backend Health'}
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-8">
        {/* Hero System Status Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-amber-950/20 border border-slate-800 p-8 shadow-2xl">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Milestone 1 — Repository Foundation Active
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Evidentiary Accountability & Document Integrity
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              NyayaVault provides secure case-based access control, SHA-256 document verification, immutable versioning, and tamper-evident audit logging for sensitive legal and investigation records.
            </p>
          </div>
        </div>

        {/* Backend Health Check Card */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-6 space-y-4 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Backend Health Status Endpoint</h3>
                <p className="text-xs text-slate-400">Target Endpoint: <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-300 font-mono">/api/v1/health</code></p>
              </div>
            </div>
            
            {healthStatus?.status === 'ok' && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="w-4 h-4" /> HTTP 200 OK
              </span>
            )}

            {healthStatus?.error && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 rounded-lg">
                <AlertCircle className="w-4 h-4" /> Connection Failed
              </span>
            )}
          </div>

          {healthStatus ? (
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-xs text-slate-300 space-y-1">
              <pre>{JSON.stringify(healthStatus, null, 2)}</pre>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">Click "Check Backend Health" above to verify live connection to NestJS service.</p>
          )}
        </div>

        {/* Core Architecture Overview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-6 space-y-3 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Lock className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-slate-200 text-sm">Access Control Architecture</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Multi-layered authorization pipeline combining Argon2 authentication, JWT tokens, RBAC roles, and Case-Based Access Control (CBAC).
            </p>
          </div>

          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-6 space-y-3 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-slate-200 text-sm">Document Integrity & Hashing</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              SHA-256 byte verification upon access, immutable versioning ($v1 \rightarrow v2$), and private Supabase Storage authorization.
            </p>
          </div>

          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-6 space-y-3 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-slate-200 text-sm">Tamper-Evident Audit Chain</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cryptographically chained audit events (SHA256(Data || H_prev)) with automated Security Incident escalation.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        NyayaVault &copy; 2026 — Secure Digital Document Management System
      </footer>
    </div>
  );
}
