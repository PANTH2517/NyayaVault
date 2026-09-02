import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Download,
  Upload,
  CheckCircle2,
  Clock,
  Lock,
  History,
  Copy,
  Check,
  AlertTriangle,
  Send,
  LockKeyhole,
  ChevronRight,
  FileCode,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import { Document, DocumentVersion, Approval, DocumentStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { MotionCard, MotionReveal, MotionStagger, MotionStatus } from '../motion';

interface DocumentDetailViewProps {
  documentId: string;
  onBack: () => void;
}

export type IntegrityState = 'NOT_YET_VERIFIED' | 'VERIFIED' | 'COMPROMISED';

export const DocumentDetailView: React.FC<DocumentDetailViewProps> = ({
  documentId,
  onBack,
}) => {
  const { user } = useAuth();
  const [doc, setDoc] = useState<Document | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Integrity Verification & Download State
  const [integrityState, setIntegrityState] = useState<IntegrityState>('NOT_YET_VERIFIED');
  const [downloading, setDownloading] = useState(false);
  const [tamperErrorAlert, setTamperErrorAlert] = useState<string | null>(null);

  // Revision Modal State
  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [changeDesc, setChangeDesc] = useState('');
  const [revisionFile, setRevisionFile] = useState<File | null>(null);
  const [uploadingRevision, setUploadingRevision] = useState(false);

  // Approval Modal State
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');
  const [approving, setApproving] = useState(false);

  // Action Pending State
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const loadDocumentData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dData, vData, aData] = await Promise.all([
        api.getDocumentById(documentId),
        api.getVersionsForDocument(documentId).catch(() => []),
        api.getApprovals(documentId).catch(() => []),
      ]);
      setDoc(dData);
      setVersions(vData);
      setApprovals(aData);
    } catch (err: any) {
      setError(err.message || 'Failed to load document details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocumentData();
  }, [documentId]);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Download & Instant Byte Integrity Check
  const handleDownloadAndVerify = async (version: DocumentVersion) => {
    if (!doc) return;
    setDownloading(true);
    setTamperErrorAlert(null);
    try {
      const filename = `${doc.title.replace(/\s+/g, '_')}_v${version.versionNumber}.pdf`;
      await api.downloadVersion(doc.id, version.id, filename);

      setIntegrityState('VERIFIED');
    } catch (err: any) {
      console.error('Integrity Download Error:', err.message);
      setIntegrityState('COMPROMISED');
      setTamperErrorAlert(err.message || 'DOCUMENT INTEGRITY COMPROMISED — ACCESS BLOCKED');
    } finally {
      setDownloading(false);
    }
  };

  // Submit for Review
  const handleSubmitForReview = async () => {
    if (!doc) return;
    setActionLoading(true);
    try {
      await api.submitForReview(doc.id);
      await loadDocumentData();
    } catch (err: any) {
      alert(`Submit for review failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Approve Document Version
  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doc || !doc.currentVersionId) return;
    setApproving(true);
    try {
      await api.approveDocument(doc.id, doc.currentVersionId, approvalComments);
      setIsApproveOpen(false);
      setApprovalComments('');
      await loadDocumentData();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    } finally {
      setApproving(false);
    }
  };

  // Seal Document
  const handleSeal = async () => {
    if (!doc) return;
    if (!confirm('Are you sure you want to SEAL this document? Once sealed, no further revisions can be created.')) {
      return;
    }
    setActionLoading(true);
    try {
      await api.sealDocument(doc.id);
      await loadDocumentData();
    } catch (err: any) {
      alert(`Sealing failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Create Revision
  const handleCreateRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doc || !revisionFile) {
      alert('Please select a file for the new revision');
      return;
    }
    setUploadingRevision(true);
    try {
      const formData = new FormData();
      formData.append('changeDescription', changeDesc);
      formData.append('file', revisionFile);

      await api.createRevision(doc.id, formData);
      setIsRevisionOpen(false);
      setChangeDesc('');
      setRevisionFile(null);
      await loadDocumentData();
    } catch (err: any) {
      alert(`Revision creation failed: ${err.message}`);
    } finally {
      setUploadingRevision(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3 text-slate-400 text-xs font-sans">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center animate-status-pulse">
          <Shield className="w-5 h-5 text-amber-400" />
        </div>
        <p className="font-semibold text-slate-300">Loading Digital Evidence Metadata...</p>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <MotionReveal className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs space-y-4 font-sans">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <div>
            <h3 className="font-bold text-sm text-rose-300">Document Retrieval Failed</h3>
            <p className="text-rose-400/90">{error || 'Document record not found'}</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
        >
          Return to Case Overview
        </button>
      </MotionReveal>
    );
  }

  const latestVersion = versions.length > 0 ? versions[versions.length - 1] : null;

  const canSubmit = doc.currentStatus === 'DRAFT' && (user?.role === 'ADMIN' || user?.role === 'INVESTIGATING_OFFICER');
  const canApprove = doc.currentStatus === 'UNDER_REVIEW' && (user?.role === 'ADMIN' || user?.role === 'SUPERVISOR');
  const canSeal = doc.currentStatus === 'APPROVED' && (user?.role === 'ADMIN' || user?.role === 'SUPERVISOR');
  const canRevise = doc.currentStatus !== 'SEALED' && (user?.role === 'ADMIN' || user?.role === 'INVESTIGATING_OFFICER');

  return (
    <div className="space-y-6 font-sans">
      {/* Back Navigation Bar */}
      <MotionReveal delayMs={0}>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors duration-micro cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Case Overview</span>
        </button>
      </MotionReveal>

      {/* 1. DOCUMENT IDENTITY HEADER */}
      <MotionReveal delayMs={50} className="p-6 rounded-2xl layer-shell border space-y-4 shadow-xl">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800 tracking-wider">
                {doc.documentType}
              </span>
              <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                {doc.classification}
              </span>
              {doc.case && (
                <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
                  Case #{doc.case.caseNumber}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {doc.title}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Document Lifecycle Badge */}
            <MotionStatus status={doc.currentStatus} />

            {/* Verification State Badge */}
            {integrityState === 'VERIFIED' && (
              <MotionStatus status="VERIFIED" label="BYTE VERIFIED" />
            )}
            {integrityState === 'NOT_YET_VERIFIED' && (
              <MotionStatus status="NOT_YET_VERIFIED" label="UNVERIFIED SESSION" />
            )}
            {integrityState === 'COMPROMISED' && (
              <MotionStatus status="COMPROMISED" label="TAMPER COMPROMISED" />
            )}
          </div>
        </div>

        {/* Conceptual Chain of Trust Visual Connector Bar */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto text-[10px] font-mono text-slate-400 scrollbar-none">
          <span className="text-slate-300 font-bold flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-amber-400" /> DOCUMENT
          </span>
          <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
          <span className="text-slate-300 font-bold flex items-center gap-1">
            <FileCode className="w-3.5 h-3.5 text-sky-400" /> VERSION v{latestVersion?.versionNumber || 1}
          </span>
          <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
          <span className="text-slate-300 font-bold flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-amber-400" /> SHA-256 CHECKSUM
          </span>
          <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
          <span className={`font-bold flex items-center gap-1 ${
            integrityState === 'VERIFIED'
              ? 'text-emerald-400'
              : integrityState === 'COMPROMISED'
              ? 'text-rose-400'
              : 'text-amber-400'
          }`}>
            <ShieldCheck className="w-3.5 h-3.5" />
            {integrityState === 'VERIFIED' ? 'INTEGRITY MATCH' : integrityState === 'COMPROMISED' ? 'MISMATCH DETECTED' : 'PENDING VERIFICATION'}
          </span>
        </div>
      </MotionReveal>

      {/* 2. TRUST / INTEGRITY HERO */}
      <MotionReveal delayMs={100}>
        <div
          className={`p-6 rounded-2xl border transition-all duration-standard ease-cinematic shadow-2xl ${
            integrityState === 'VERIFIED'
              ? 'bg-emerald-950/20 border-emerald-500/40'
              : integrityState === 'COMPROMISED'
              ? 'bg-rose-950/25 border-2 border-rose-500 shadow-rose-500/20 animate-status-pulse'
              : 'layer-panel border-slate-800'
          }`}
        >
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-2xl border shrink-0 ${
                  integrityState === 'VERIFIED'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                    : integrityState === 'COMPROMISED'
                    ? 'bg-rose-500 text-slate-950 font-bold border-rose-400 shadow-lg shadow-rose-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {integrityState === 'VERIFIED' ? (
                  <ShieldCheck className="w-8 h-8 text-emerald-400" />
                ) : integrityState === 'COMPROMISED' ? (
                  <ShieldAlert className="w-8 h-8 text-slate-950" />
                ) : (
                  <Shield className="w-8 h-8 text-slate-400" />
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className={`text-lg font-extrabold tracking-tight ${
                    integrityState === 'VERIFIED'
                      ? 'text-emerald-300'
                      : integrityState === 'COMPROMISED'
                      ? 'text-rose-400'
                      : 'text-white'
                  }`}>
                    {integrityState === 'VERIFIED' && 'INTEGRITY VERIFIED — MATCH CONFIRMED'}
                    {integrityState === 'COMPROMISED' && 'DOCUMENT INTEGRITY COMPROMISED — ACCESS BLOCKED'}
                    {integrityState === 'NOT_YET_VERIFIED' && 'DIGITAL EVIDENCE TRUST SCREEN'}
                  </h2>
                </div>

                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  {integrityState === 'VERIFIED' &&
                    `Version ${latestVersion?.versionNumber} byte array hash strictly matches trusted SHA-256 fingerprint in system ledger.`}
                  {integrityState === 'COMPROMISED' &&
                    `Trusted SHA-256 fingerprint does not match stored document bytes. Content retrieval was aborted by NestJS security interceptor.`}
                  {integrityState === 'NOT_YET_VERIFIED' &&
                    `Click 'Download & Verify Byte Integrity' to compute live SHA-256 against stored document file bytes.`}
                </p>

                {integrityState === 'COMPROMISED' && (
                  <div className="pt-2 font-mono text-[11px] space-y-1 text-rose-300">
                    <div>&bull; ACCESS BLOCKED: Download stream terminated due to checksum mismatch.</div>
                    <div>&bull; INCIDENT LOGGED: A critical security incident has been escalated in backend.</div>
                    {tamperErrorAlert && (
                      <div className="bg-slate-950/90 p-2 rounded-lg border border-rose-500/50 text-rose-300 text-[10px] mt-1">
                        {tamperErrorAlert}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action in Hero */}
            {latestVersion && (
              <button
                onClick={() => handleDownloadAndVerify(latestVersion)}
                disabled={downloading}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all duration-micro ease-cinematic active:scale-[0.97] cursor-pointer disabled:opacity-50 shrink-0 ${
                  integrityState === 'COMPROMISED'
                    ? 'bg-rose-500 hover:bg-rose-400 text-slate-950 shadow-rose-500/20'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>
                  {downloading
                    ? 'Verifying Byte Integrity...'
                    : integrityState === 'COMPROMISED'
                    ? 'Re-Verify Byte Integrity'
                    : 'Download & Verify Byte Integrity'}
                </span>
              </button>
            )}
          </div>
        </div>
      </MotionReveal>

      {/* 3. CRYPTOGRAPHIC VERIFICATION PANEL */}
      {latestVersion && (
        <MotionReveal delayMs={150} className="p-6 rounded-2xl layer-panel border space-y-4 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              Cryptographic SHA-256 Fingerprint (Version {latestVersion.versionNumber})
            </h3>

            <button
              onClick={() => handleCopyHash(latestVersion.sha256Hash)}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {copiedHash === latestVersion.sha256Hash ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Full SHA-256 Hash</span>
                </>
              )}
            </button>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Trusted Database SHA-256 Hash:
            </div>
            <div className="font-mono text-xs sm:text-sm text-amber-300 tracking-wider break-all select-all leading-relaxed">
              {latestVersion.sha256Hash}
            </div>
          </div>

          {/* Cryptographic Comparison Pipeline Indicator */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-center">
              <div className="text-[9px] text-slate-500 uppercase">Input Version</div>
              <div className="font-bold text-slate-200 mt-0.5">v{latestVersion.versionNumber}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-center">
              <div className="text-[9px] text-slate-500 uppercase">Algorithm</div>
              <div className="font-bold text-amber-400 mt-0.5">SHA-256</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-center">
              <div className="text-[9px] text-slate-500 uppercase">File Size</div>
              <div className="font-bold text-slate-200 mt-0.5">
                {(Number(latestVersion.fileSizeBytes) / 1024).toFixed(1)} KB
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-center">
              <div className="text-[9px] text-slate-500 uppercase">Checksum Result</div>
              <div className={`font-bold mt-0.5 ${
                integrityState === 'VERIFIED'
                  ? 'text-emerald-400'
                  : integrityState === 'COMPROMISED'
                  ? 'text-rose-400'
                  : 'text-slate-400'
              }`}>
                {integrityState === 'VERIFIED' ? 'MATCH' : integrityState === 'COMPROMISED' ? 'MISMATCH' : 'UNCHECKED'}
              </div>
            </div>
          </div>
        </MotionReveal>
      )}

      {/* 4. WORKFLOW ACTION TOOLBAR */}
      <MotionReveal delayMs={200} className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl layer-panel border">
        <div className="flex items-center gap-2 flex-wrap">
          {canRevise && (
            <button
              onClick={() => setIsRevisionOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all duration-micro ease-cinematic active:scale-[0.97] cursor-pointer"
            >
              <Upload className="w-4 h-4 text-sky-400" />
              <span>Upload New Revision</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canSubmit && (
            <button
              onClick={handleSubmitForReview}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 font-bold text-xs cursor-pointer transition-all duration-micro ease-cinematic active:scale-[0.97] disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit for Review</span>
            </button>
          )}

          {canApprove && (
            <button
              onClick={() => setIsApproveOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 font-bold text-xs cursor-pointer transition-all duration-micro ease-cinematic active:scale-[0.97]"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approve Version</span>
            </button>
          )}

          {canSeal && (
            <button
              onClick={handleSeal}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 font-bold text-xs cursor-pointer transition-all duration-micro ease-cinematic active:scale-[0.97] disabled:opacity-50"
            >
              <LockKeyhole className="w-3.5 h-3.5" />
              <span>Seal Document</span>
            </button>
          )}
        </div>
      </MotionReveal>

      {/* 5. VERSION HISTORY (CHAIN-OF-CUSTODY TIMELINE) */}
      <MotionReveal delayMs={250} className="rounded-2xl layer-panel border p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            Chain-of-Custody Immutable Versions ({versions.length})
          </h3>
          <span className="text-[11px] text-slate-500">
            Append-Only Audit Structure
          </span>
        </div>

        <MotionStagger staggerMs={50} className="space-y-3 relative before:absolute before:left-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-800">
          {versions.map((ver) => (
            <div
              key={ver.id}
              className={`relative pl-10 p-4 rounded-xl border transition-all duration-standard ease-cinematic ${
                ver.isCompromised
                  ? 'bg-rose-950/20 border-rose-500/50 shadow-md shadow-rose-500/10'
                  : ver.id === doc.currentVersionId
                  ? 'bg-slate-950 border-amber-500/40 shadow-sm'
                  : 'bg-slate-950/80 border-slate-800'
              }`}
            >
              {/* Timeline Bullet Node */}
              <div className={`absolute left-4 top-5 w-4 h-4 rounded-full border-2 -translate-x-1/2 flex items-center justify-center ${
                ver.isCompromised
                  ? 'bg-rose-500 border-rose-400 animate-status-pulse'
                  : ver.id === doc.currentVersionId
                  ? 'bg-amber-500 border-amber-300'
                  : 'bg-slate-900 border-slate-700'
              }`} />

              <div className="flex flex-wrap items-start justify-between gap-3 text-xs">
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                      Version {ver.versionNumber}
                    </span>

                    {ver.id === doc.currentVersionId && (
                      <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                        CURRENT ACTIVE
                      </span>
                    )}

                    {ver.isCompromised && (
                      <span className="font-bold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/40 flex items-center gap-1 text-[10px]">
                        <AlertTriangle className="w-3 h-3" />
                        COMPROMISED
                      </span>
                    )}

                    <span className="text-[11px] text-slate-400">
                      by {ver.createdBy?.fullName || 'Officer'} &bull;{' '}
                      {new Date(ver.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {ver.changeDescription && (
                    <p className="text-slate-300 italic text-[11px] bg-slate-900/60 p-2 rounded border border-slate-800/80">
                      "{ver.changeDescription}"
                    </p>
                  )}

                  <div className="font-mono text-[10px] text-slate-400 truncate flex items-center gap-1.5">
                    <span className="text-slate-500">SHA-256:</span>
                    <span className="text-slate-300 truncate">{ver.sha256Hash}</span>
                    <button
                      onClick={() => handleCopyHash(ver.sha256Hash)}
                      className="text-amber-400 hover:text-amber-300 ml-1 cursor-pointer"
                      title="Copy Hash"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-slate-400 font-mono text-[11px]">
                    {(Number(ver.fileSizeBytes) / 1024).toFixed(1)} KB
                  </span>

                  <button
                    onClick={() => handleDownloadAndVerify(ver)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition-all duration-micro ease-cinematic active:scale-[0.97] cursor-pointer flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Download v{ver.versionNumber}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </MotionStagger>
      </MotionReveal>

      {/* 6. APPROVAL AUDIT HISTORY */}
      <MotionReveal delayMs={300} className="rounded-2xl layer-panel border p-6 space-y-4 shadow-xl">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          Approval Audit History ({approvals.length})
        </h3>

        {approvals.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">No approval events recorded for this document.</p>
        ) : (
          <div className="space-y-3">
            {approvals.map((app) => (
              <div
                key={app.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-2"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Bound to Version {app.version?.versionNumber || '?'}
                    </span>
                    <MotionStatus status={app.status} />
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono">
                    Requested: {new Date(app.requestedAt).toLocaleString()}
                  </span>
                </div>

                <div className="text-slate-300 text-xs">
                  Requested by: <strong className="text-slate-200">{app.requestedBy?.fullName}</strong> ({app.requestedBy?.role})
                  {app.approvedBy && (
                    <span>
                      {' '}&bull; Approved by:{' '}
                      <strong className="text-emerald-400">{app.approvedBy.fullName}</strong> ({app.approvedBy.role})
                    </span>
                  )}
                </div>

                {app.comments && (
                  <p className="text-slate-300 text-[11px] italic bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                    Comments: "{app.comments}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </MotionReveal>

      {/* Revision Upload Modal */}
      {isRevisionOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl animate-fade-in-scale">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-sky-400" />
              Upload New Revision (Version {versions.length + 1})
            </h3>

            <form onSubmit={handleCreateRevision} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Change Description / Revision Notes</label>
                <textarea
                  value={changeDesc}
                  onChange={(e) => setChangeDesc(e.target.value)}
                  rows={3}
                  required
                  placeholder="Describe why this revision is being created..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Select Revised File</label>
                <input
                  type="file"
                  onChange={(e) => setRevisionFile(e.target.files ? e.target.files[0] : null)}
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRevisionOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingRevision}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
                >
                  {uploadingRevision ? 'Uploading Revision...' : 'Create Revision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {isApproveOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl animate-fade-in-scale">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Approve Document Version {latestVersion?.versionNumber}
            </h3>

            <p className="text-xs text-slate-400 leading-relaxed">
              Approval will be strictly bound to Version ID{' '}
              <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-400 font-mono">
                {doc.currentVersionId}
              </code>
              . Approval of this version does not auto-approve future revisions.
            </p>

            <form onSubmit={handleApprove} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Supervisor / Admin Comments</label>
                <textarea
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  rows={3}
                  placeholder="Optional review notes or decision remarks..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsApproveOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approving}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
                >
                  {approving ? 'Approving...' : 'Confirm Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
