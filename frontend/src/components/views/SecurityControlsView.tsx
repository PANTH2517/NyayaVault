import React, { useState } from 'react';
import { ShieldAlert, Zap, AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { TamperSimulationVisualizer } from '../motion';

export const SecurityControlsView: React.FC = () => {
  const [versionId, setVersionId] = useState('');
  const [tampering, setTampering] = useState(false);
  const [tamperResult, setTamperResult] = useState<{
    success: boolean;
    message: string;
    versionId: string;
    storagePath: string;
    trustedDbHash: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSimulateTamper = async () => {
    if (!versionId.trim()) {
      setError('Please enter a Document Version ID UUID');
      return;
    }

    setTampering(true);
    setError(null);
    setTamperResult(null);
    try {
      const res = await api.simulateTamper(versionId.trim());
      setTamperResult({
        success: res.success,
        message: res.message,
        versionId: res.versionId,
        storagePath: res.storagePath,
        trustedDbHash: res.trustedDbHash,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to execute byte tamper simulation');
    } finally {
      setTampering(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Bar */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-mono font-bold mb-2">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>ADMINISTRATION &bull; TESTING ONLY</span>
        </div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
          Security Controls & Integrity Testing
        </h1>
        <p className="text-xs text-slate-400 font-semibold mt-1">
          Perform administrative byte-level tamper simulations to test SHA-256 evidence protection and automated incident generation.
        </p>
      </div>

      {/* Warning Box */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
        <div className="flex items-center gap-2 font-bold text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Controlled Administrative Test Environment</span>
        </div>
        <p className="text-slate-300 leading-relaxed">
          Simulating file tampering mutates bytes in storage while preserving the trusted SHA-256 hash in PostgreSQL. Any subsequent attempt to access or download the affected document version will be blocked with HTTP 403 Forbidden and generate an automated Security Incident.
        </p>
      </div>

      {/* Form Input */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl backdrop-blur-xl max-w-xl">
        <div className="space-y-1.5 text-xs">
          <label className="font-bold text-slate-300">Target Document Version ID (UUID)</label>
          <input
            type="text"
            value={versionId}
            onChange={(e) => setVersionId(e.target.value)}
            placeholder="e.g. 630b2700-f0a2-472c-b273-4f45315e6941"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-500"
          />
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}
      </div>

      {/* Visualizer Component */}
      <TamperSimulationVisualizer
        versionId={versionId || 'TARGET-VERSION-UUID'}
        isSimulating={tampering}
        result={tamperResult}
        onSimulate={handleSimulateTamper}
      />
    </div>
  );
};
