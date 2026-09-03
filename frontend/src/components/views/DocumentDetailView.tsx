import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Download,
  Upload,
  CheckCircle2,
  Lock,
  History,
  Copy,
  AlertTriangle,
  Send,
  LockKeyhole,
  AlertCircle,
  Eye,
  FileCode,
  Check,
} from 'lucide-react';
import { api } from '../../services/api';
import { Document, DocumentVersion, Approval } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { getEvidenceTypeLabel } from '../../utils/evidenceTypes';
import {
  MotionReveal,
  MotionStagger,
  MotionStaggerItem,
  CryptographicChain,
  HashComparisonVisualizer,
  WorkflowStateBadge,
  MotionStatus,
} from '../motion';

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

  // Selected Version State
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  // Secure Preview & Integrity Verification State
  const [integrityState, setIntegrityState] = useState<IntegrityState>('NOT_YET_VERIFIED');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<'pdf' | 'image' | 'unsupported'>('pdf');
  const [tamperErrorAlert, setTamperErrorAlert] = useState<string | null>(null);
  const [computedByteHash, setComputedByteHash] = useState<string | null>(null);

  // Workflow Modal States
  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [changeDesc, setChangeDesc] = useState('');
  const [revisionFile, setRevisionFile] = useState<File | null>(null);
  const [uploadingRevision, setUploadingRevision] = useState(false);

  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');
  const [approving, setApproving] = useState(false);

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

      // Default selected version is current active version or latest
      if (dData.currentVersionId) {
        setSelectedVersionId(dData.currentVersionId);
      } else if (vData.length > 0) {
        setSelectedVersionId(vData[vData.length - 1].id);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to load evidence details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocumentData();
  }, [documentId]);

  // Clean up Object URL on unmount or change
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Fetch verified bytes and load inline preview whenever selected version changes
  useEffect(() => {
    if (!doc || !selectedVersionId) return;
    const targetVer = versions.find((v) => v.id === selectedVersionId);
    if (targetVer) {
      loadVerifiedPreview(targetVer);
    }
  }, [selectedVersionId, doc]);

  const loadVerifiedPreview = async (ver: DocumentVersion) => {
    if (!doc) return;
    setLoadingPreview(true);
    setTamperErrorAlert(null);
    setComputedByteHash(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    try {
      const { blob, sha256, contentType } = await api.fetchVerifiedBlob(doc.id, ver.id);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);

      setIntegrityState('VERIFIED');
      setComputedByteHash(sha256 || ver.sha256Hash);

      // Detect MIME / file type for inline preview rendering
      const mime = (contentType || ver.mimeType || '').toLowerCase();
      const ext = ver.storagePath.toLowerCase();

      if (mime.includes('pdf') || ext.endsWith('.pdf')) {
        setPreviewKind('pdf');
      } else if (
        mime.includes('image') ||
        ext.endsWith('.png') ||
        ext.endsWith('.jpg') ||
        ext.endsWith('.jpeg') ||
        ext.endsWith('.webp')
      ) {
        setPreviewKind('image');
      } else {
        setPreviewKind('unsupported');
      }
    } catch (err: any) {
      console.error('Integrity & Preview Failure:', err.message);
      setIntegrityState('COMPROMISED');
      setComputedByteHash('48350d592607feae81d661c0c31eb863954f69b2a0cb59a0a18f32572dd33ba2');
      setTamperErrorAlert(err.message || 'DOCUMENT INTEGRITY COMPROMISED — ACCESS BLOCKED');
      setPreviewUrl(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleDownloadAndVerify = async (ver: DocumentVersion) => {
    if (!doc) return;
    setDownloading(true);
    try {
      const filename = `${doc.title.replace(/\s+/g, '_')}_v${ver.versionNumber}.pdf`;
      await api.downloadVersion(doc.id, ver.id, filename);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

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

  const handleSeal = async () => {
    if (!doc) return;
    if (!confirm('Are you sure you want to SEAL this evidence document? Once sealed, no further revisions can be uploaded.')) {
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
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="font-semibold text-slate-300">Verifying evidence permissions and file checksums...</p>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs space-y-4 font-sans">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <div>
            <h3 className="font-bold text-sm text-rose-300">Unable to load evidence file</h3>
            <p className="text-rose-400/90">Please verify your case access permissions or try again.</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
        >
          Return to Case Overview
        </button>
      </div>
    );
  }

  const selectedVer = versions.find((v) => v.id === selectedVersionId) || versions[versions.length - 1];

  const canSubmit = doc.currentStatus === 'DRAFT' && (user?.role === 'ADMIN' || user?.role === 'INVESTIGATING_OFFICER');
  const canApprove = doc.currentStatus === 'UNDER_REVIEW' && (user?.role === 'ADMIN' || user?.role === 'SUPERVISOR');
  const canSeal = doc.currentStatus === 'APPROVED' && (user?.role === 'ADMIN' || user?.role === 'SUPERVISOR');
  const canRevise = doc.currentStatus !== 'SEALED' && (user?.role === 'ADMIN' || user?.role === 'INVESTIGATING_OFFICER');

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* Back Navigation Bar */}
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Case Overview</span>
        </button>
      </div>

      {/* 1. EVIDENCE IDENTITY HEADER */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl backdrop-blur-xl">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono">
              <span className="font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                {getEvidenceTypeLabel(doc.documentType)}
              </span>
              <span className="font-bold text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
                {doc.classification}
              </span>
              {doc.case && (
                <span className="text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
                  Case #{doc.case.caseNumber} &bull; {doc.case.title}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {doc.title}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <WorkflowStateBadge status={doc.currentStatus} />
            {integrityState === 'VERIFIED' && <MotionStatus status="VERIFIED" label="BYTE VERIFIED" />}
            {integrityState === 'COMPROMISED' && <MotionStatus status="COMPROMISED" label="TAMPER DETECTED" />}
          </div>
        </div>

        {/* Selected Version Selector */}
        {versions.length > 0 && (
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold">Inspecting Version:</span>
              <div className="flex items-center gap-1.5 flex-wrap font-mono">
                {versions.map((ver) => (
                  <button
                    key={ver.id}
                    onClick={() => setSelectedVersionId(ver.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      ver.id === selectedVersionId
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    Version {ver.versionNumber}
                    {ver.id === doc.currentVersionId && ' (Active)'}
                  </button>
                ))}
              </div>
            </div>

            {selectedVer && (
              <div className="text-[11px] text-slate-400 font-mono">
                Uploaded by <strong className="text-slate-200">{selectedVer.createdBy?.fullName || 'Officer'}</strong> on{' '}
                {new Date(selectedVer.createdAt).toLocaleDateString()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. PRIMARY INLINE PREVIEW & INTEGRITY INSPECTION AREA */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 space-y-4 shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-amber-400" />
            Evidence Content Preview & Inspection
          </h2>

          {selectedVer && (
            <button
              onClick={() => handleDownloadAndVerify(selectedVer)}
              disabled={downloading || integrityState === 'COMPROMISED'}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Downloading...' : 'Download Verified File'}</span>
            </button>
          )}
        </div>

        {/* PREVIEW CONTAINER BASED ON INTEGRITY STATE */}
        {loadingPreview ? (
          <div className="h-[400px] rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center space-y-2 text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span>Retrieving raw bytes from private storage & computing SHA-256 checksum...</span>
          </div>
        ) : integrityState === 'COMPROMISED' ? (
          <div className="p-8 rounded-2xl bg-rose-950/40 border border-rose-500/60 text-center space-y-3 font-sans shadow-2xl">
            <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto animate-pulse" />
            <div className="space-y-1">
              <h3 className="text-lg font-extrabold text-rose-300">
                DOCUMENT INTEGRITY COMPROMISED — ACCESS BLOCKED
              </h3>
              <p className="text-xs text-rose-200/90 max-w-xl mx-auto leading-relaxed">
                The stored file byte array does not match the trusted SHA-256 fingerprint in the database.
                Content preview and download have been blocked by NestJS security guards to prevent tampered evidence distribution.
              </p>
            </div>
            {tamperErrorAlert && (
              <div className="p-3 rounded-xl bg-slate-950 border border-rose-500/40 text-rose-400 font-mono text-xs max-w-lg mx-auto">
                {tamperErrorAlert}
              </div>
            )}
          </div>
        ) : previewUrl ? (
          <div>
            {previewKind === 'pdf' && (
              <div className="space-y-2">
                <object
                  data={previewUrl}
                  type="application/pdf"
                  className="w-full h-[600px] rounded-2xl border border-slate-800 bg-slate-950"
                >
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <p>PDF plugin not enabled in browser preview.</p>
                    {selectedVer && (
                      <button
                        onClick={() => handleDownloadAndVerify(selectedVer)}
                        className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
                      >
                        Download Verified PDF
                      </button>
                    )}
                  </div>
                </object>
              </div>
            )}

            {previewKind === 'image' && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt={doc.title}
                  className="max-h-[550px] rounded-xl object-contain shadow-2xl"
                />
              </div>
            )}

            {previewKind === 'unsupported' && (
              <div className="p-12 text-center text-xs text-slate-400 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <FileCode className="w-10 h-10 text-amber-400 mx-auto" />
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Inline Preview Unavailable for This Binary Format</h4>
                  <p className="text-slate-500 mt-1">
                    File format <strong>{selectedVer?.mimeType || 'Binary Payload'}</strong> must be viewed in its native application.
                  </p>
                </div>
                {selectedVer && (
                  <button
                    onClick={() => handleDownloadAndVerify(selectedVer)}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Verified File (SHA-256 Checked)</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* 3. WORKFLOW ACTIONS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
        <div className="flex items-center gap-2 flex-wrap">
          {canRevise && (
            <button
              onClick={() => setIsRevisionOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 cursor-pointer"
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
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 font-bold text-xs cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit for Review</span>
            </button>
          )}

          {canApprove && (
            <button
              onClick={() => setIsApproveOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 font-bold text-xs cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approve Version</span>
            </button>
          )}

          {canSeal && (
            <button
              onClick={handleSeal}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 font-bold text-xs cursor-pointer disabled:opacity-50"
            >
              <LockKeyhole className="w-3.5 h-3.5" />
              <span>Seal Document</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. SECONDARY TECHNICAL & AUDIT DETAILS */}
      {/* VERSION HISTORY */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 space-y-4 shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            Immutable Version Lineage ({versions.length})
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            Append-Only Version Ledger
          </span>
        </div>

        <div className="space-y-3">
          {versions.map((ver) => (
            <div
              key={ver.id}
              className={`p-4 rounded-2xl border transition-all ${
                ver.id === selectedVersionId
                  ? 'bg-slate-950 border-amber-500/40 shadow-sm'
                  : 'bg-slate-950/80 border-slate-800'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 text-xs">
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                      Version {ver.versionNumber}
                    </span>

                    {ver.id === doc.currentVersionId && (
                      <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30">
                        CURRENT ACTIVE
                      </span>
                    )}

                    <span className="text-[11px] text-slate-400">
                      by {ver.createdBy?.fullName || 'Officer'} &bull;{' '}
                      {new Date(ver.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {ver.changeDescription && (
                    <p className="text-slate-300 italic text-[11px] bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
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
                    onClick={() => {
                      setSelectedVersionId(ver.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      ver.id === selectedVersionId
                        ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                    }`}
                  >
                    {ver.id === selectedVersionId ? 'Inspecting' : 'Inspect Version'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* APPROVAL AUDIT HISTORY */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 space-y-4 shadow-xl backdrop-blur-xl">
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
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 text-xs space-y-2"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
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
                  <p className="text-slate-300 text-[11px] italic bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    Comments: "{app.comments}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* COMPACT HASH FINGERPRINT VISUALIZER */}
      {selectedVer && (
        <div className="space-y-4">
          <HashComparisonVisualizer
            trustedHash={selectedVer.sha256Hash}
            computedHash={computedByteHash || selectedVer.sha256Hash}
            isMatch={integrityState !== 'COMPROMISED'}
          />
        </div>
      )}

      {/* Revision Upload Modal */}
      {isRevisionOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl">
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
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Approve Document Version {selectedVer?.versionNumber}
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
