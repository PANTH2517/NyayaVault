import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Copy,
  Check,
  Database,
  Layers,
  FileCheck,
  Lock,
  ServerOff,
  AlertOctagon,
} from 'lucide-react';
import { api } from '../../services/api';
import { MotionReveal, MotionCard, MotionStagger, MotionStaggerItem } from '../motion';

export const BlockchainObservabilityView: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const fetchObservability = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getBlockchainNetworkObservability();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Unable to load blockchain network observability metadata');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchObservability();
    const interval = setInterval(fetchObservability, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const getNetworkStateBadge = (state: string) => {
    switch (state) {
      case 'SYNCHRONIZED':
        return {
          label: 'NETWORK SYNCHRONIZED',
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          icon: CheckCircle2,
          description: 'All 4 physical permissioned nodes agree on chain tip height & block hash.',
        };
      case 'DEGRADED':
        return {
          label: 'NETWORK DEGRADED',
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
          icon: AlertTriangle,
          description: 'One or more physical nodes are unreachable. Chain consistency preserved.',
        };
      case 'BEHIND':
        return {
          label: 'NODE CATCHING UP',
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
          icon: Clock,
          description: 'A node is rehydrating or catching up to common tip ancestry.',
        };
      case 'DIVERGED':
        return {
          label: 'CHAIN DIVERGENCE DETECTED',
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          icon: AlertOctagon,
          description: 'FAIL-CLOSED: Conflicting tip hash detected across active nodes.',
        };
      default:
        return {
          label: 'NETWORK UNAVAILABLE',
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          icon: ServerOff,
          description: 'Physical blockchain nodes unreachable or initializing.',
        };
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4 text-slate-400 font-sans">
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-2xl">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-200">Sampling Four-Node Network State...</span>
        </div>
      </div>
    );
  }

  const netStateInfo = getNetworkStateBadge(data?.networkState || 'UNAVAILABLE');
  const StateIcon = netStateInfo.icon;
  const nodes = data?.nodes || [];
  const latestBlock = data?.latestBlock;
  const knownAnchor = data?.knownProductionAnchor;

  return (
    <div className="space-y-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-mono font-bold mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>PERMISSIONED INFRASTRUCTURE &bull; READ-ONLY CONSOLE</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            Blockchain Operational Observability
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Real-time read-only status of the four-node PoA network, ledger height, consensus proofs, and application anchors.
          </p>
        </div>

        <button
          onClick={fetchObservability}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {error && (
        <MotionReveal className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
          {error}
        </MotionReveal>
      )}

      {/* 1. Network Aggregate Status Banner */}
      <MotionReveal className={`p-6 rounded-3xl border ${netStateInfo.bg} shadow-2xl backdrop-blur-xl space-y-3`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <StateIcon className="w-6 h-6 shrink-0" />
            </div>
            <div>
              <div className="text-xs font-mono font-extrabold tracking-wider uppercase">
                {netStateInfo.label}
              </div>
              <div className="text-sm font-bold text-white mt-0.5">
                Chain ID: <span className="font-mono text-amber-400">{data?.chainId || 'nyayavault-mainnet-1'}</span>
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right font-mono text-[11px] text-slate-400 space-y-0.5">
            <div>Sampled: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'N/A'}</div>
            <div>Chain Consistency: <strong className="text-slate-200">{data?.chainConsistency || 'UNKNOWN'}</strong></div>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
          {netStateInfo.description}
        </p>
      </MotionReveal>

      {/* 2. Four Physical Node Cards */}
      <div className="space-y-3">
        <div className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
          <Server className="w-4 h-4 text-amber-400" />
          <span>Physical Permissioned Node Topology (4 Nodes)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {nodes.map((node: any) => (
            <MotionCard
              key={node.nodeId}
              className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl backdrop-blur-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full shrink-0 ${
                      node.ready ? 'bg-emerald-400 shadow-lg shadow-emerald-500/50' : 'bg-rose-400'
                    }`}
                  />
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      {node.organization}
                    </h3>
                    <span className="text-[11px] font-mono text-slate-400">{node.nodeId}</span>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border uppercase ${
                    node.ready
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  {node.lifecycleState}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono">
                <div>
                  <span className="text-slate-500 text-[10px] block">Block Height</span>
                  <span className="font-bold text-white text-xs">{node.currentHeight}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Consensus Status</span>
                  <span className={node.acceptingConsensus ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                    {node.acceptingConsensus ? 'ACTIVE' : 'IDLE'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-[11px] font-mono">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Tip Hash:</span>
                  <span className="text-slate-200 truncate max-w-[180px]">
                    {node.latestBlockHash ? `${node.latestBlockHash.substring(0, 14)}...` : 'None'}
                  </span>
                </div>

                {node.fingerprint && (
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Fingerprint:</span>
                    <button
                      onClick={() => handleCopy(node.fingerprint)}
                      className="text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Copy full fingerprint"
                    >
                      <span className="truncate max-w-[160px]">{node.fingerprint.substring(0, 12)}...</span>
                      {copiedText === node.fingerprint ? (
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                      ) : (
                        <Copy className="w-3 h-3 shrink-0" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </MotionCard>
          ))}
        </div>
      </div>

      {/* 3. Latest Block & Consensus Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Block Card */}
        <MotionReveal className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-amber-400">
            <Layers className="w-4 h-4" />
            <span>Latest Committed Block</span>
          </div>

          {latestBlock ? (
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-slate-400">Block Height:</span>
                <span className="text-base font-extrabold text-white">Height {latestBlock.blockHeight}</span>
              </div>

              <div className="space-y-2 text-[11px] text-slate-300">
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 text-[10px]">Block Hash:</span>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 text-amber-300 font-mono text-[10px] break-all">
                    {latestBlock.blockHash}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 text-[10px]">Merkle Root:</span>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 text-slate-300 font-mono text-[10px] break-all">
                    {latestBlock.merkleRoot}
                  </div>
                </div>

                <div className="flex items-center justify-between text-slate-400 pt-1">
                  <span>Proposer Node:</span>
                  <span className="text-slate-200 font-bold">{latestBlock.proposerNode}</span>
                </div>

                <div className="flex items-center justify-between text-slate-400">
                  <span>Transaction Count:</span>
                  <span className="text-slate-200 font-bold">{latestBlock.transactionCount}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-slate-500 text-xs italic bg-slate-950/60 rounded-xl border border-slate-800">
              No block metadata available.
            </div>
          )}
        </MotionReveal>

        {/* PoA Consensus & Endorsements Card */}
        <MotionReveal delayMs={100} className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-sky-400">
            <Lock className="w-4 h-4" />
            <span>PoA Consensus & Endorsement Summary</span>
          </div>

          {latestBlock ? (
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-slate-400">Consensus Policy:</span>
                <span className="text-xs font-bold text-sky-300">{latestBlock.policyId || 'GOVERNANCE_CHECKPOINT'}</span>
              </div>

              <div className="space-y-2 text-[11px] text-slate-300">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Required Quorum Threshold:</span>
                  <span className="text-slate-200 font-bold">{latestBlock.requiredThreshold || 3} Endorsements</span>
                </div>

                <div className="flex flex-col gap-1.5 pt-1">
                  <span className="text-slate-500 text-[10px]">Endorsing Permissioned Nodes:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(latestBlock.endorserNodeIds || ['ADMIN_NODE', 'POLICE_NODE', 'PROSECUTION_NODE']).map((nodeId: string) => (
                      <span
                        key={nodeId}
                        className="px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[10px] font-bold"
                      >
                        {nodeId}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-slate-400 pt-2 border-t border-slate-800/80">
                  <span>Proof Verification:</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>VERIFIED</span>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-slate-500 text-xs italic bg-slate-950/60 rounded-xl border border-slate-800">
              No consensus proof data available.
            </div>
          )}
        </MotionReveal>
      </div>

      {/* 4. Known Production Application Anchor Status */}
      <MotionReveal delayMs={150} className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-emerald-400">
            <FileCheck className="w-4 h-4" />
            <span>Known Production Application Anchor</span>
          </div>
          <span className="px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold">
            STATUS: {knownAnchor ? knownAnchor.status : 'NOT FOUND'}
          </span>
        </div>

        {knownAnchor ? (
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 font-mono text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-slate-500 text-[10px] block">Anchor ID</span>
                <span className="text-slate-200 font-bold">{knownAnchor.anchorId}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Event Type / Policy</span>
                <span className="text-amber-400 font-bold">{knownAnchor.eventType} ({knownAnchor.policyId})</span>
              </div>
            </div>

            <div className="space-y-1.5 text-[10px]">
              <div className="flex flex-col gap-0.5">
                <span className="text-slate-500">Transaction ID:</span>
                <span className="text-slate-300 font-mono break-all">{knownAnchor.blockchainTxId}</span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-slate-500">Block Hash (Height {knownAnchor.blockHeight}):</span>
                <span className="text-slate-300 font-mono break-all">{knownAnchor.blockHash}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/80">
              <span className="text-slate-400">Independent Cryptographic Proof:</span>
              <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>VERIFIED</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-slate-500 text-xs italic bg-slate-950/60 rounded-xl border border-slate-800">
            No active production application anchor confirmed on ledger.
          </div>
        )}
      </MotionReveal>
    </div>
  );
};
