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
} from 'lucide-react';
import { api } from '../../services/api';
import { Document, DocumentVersion, Approval, DocumentStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';

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
    return <div className="text-center py-20 text-xs text-slate-400">Loading Document Metadata...</div>;
  }

  if (error || !doc) {
    return (
      <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs space-y-3">
        <div>{error || 'Document not found'}</div>
        <button onClick={onBack} className="px-3 py-1 rounded bg-slate-800 text-slate-200">
          Back to Case
        </button>
      </div>
    );
  }

  const latestVersion = versions.length > 0 ? versions[versions.length - 1] : null;

  const statusBadges: Record<DocumentStatus, { label: string; style: string; icon: any }> = {
    DRAFT: { label: 'DRAFT', style: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: Clock },
    UNDER_REVIEW: { label: 'UNDER REVIEW', style: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: Clock },
    APPROVED: { label: 'APPROVED', style: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: CheckCircle2 },
    SEALED: { label: 'SEALED', style: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30', icon: Lock },
  };

  const currentSt = statusBadges[doc.currentStatus];
  const StatusIcon = currentSt.icon;

  const canSubmit = doc.currentStatus === 'DRAFT' && (user?.role === 'ADMIN' || user?.role === 'INVESTIGATING_OFFICER');
  const canApprove = doc.currentStatus === 'UNDER_REVIEW' && (user?.role === 'ADMIN' || user?.role === 'SUPERVISOR');
  const canSeal = doc.currentStatus === 'APPROVED' && (user?.role === 'ADMIN' || user?.role === 'SUPERVISOR');
  const canRevise = doc.currentStatus !== 'SEALED' && (user?.role === 'ADMIN' || user?.role === 'INVESTIGATING_OFFICER');

  return (
    <div className="space-y-6 font-sans">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Case Overview</span>
      </button>

      {/* CRITICAL TAMPER ALERT BANNER (Prominently displayed upon hash failure) */}
      {integrityState === 'COMPROMISED' && (
        <div className="p-5 rounded-2xl bg-rose-500/15 border-2 border-rose-500 text-rose-200 space-y-2 shadow-2xl animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500 text-slate-950 font-bold">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-wide text-rose-400">
                DOCUMENT INTEGRITY COMPROMISED
              </h3>
              <p className="text-xs font-semibold text-rose-200">
                Trusted SHA-256 does not match stored document bytes.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-rose-500/30 text-xs font-mono space-y-1 text-rose-300">
            <div>&bull; ACCESS BLOCKED: Content retrieval aborted by NestJS backend security interceptor.</div>
            <div>&bull; SECURITY INCIDENT CREATED: A critical security incident has been escalated.</div>
            {tamperErrorAlert && (
              <div className="text-[11px] bg-slate-950/80 p-2 rounded border border-rose-500/40 text-rose-300">
                {tamperErrorAlert}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Document Details Card */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6 shadow-xl">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {doc.documentType}
              </span>
              <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {doc.classification}
              </span>
              {doc.case && (
                <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  Case: {doc.case.caseNumber}
                </span>
              )}
            </div>

            <h2 className="text-2xl font-extrabold text-white tracking-tight">{doc.title}</h2>
          </div>

          {/* Status Badge & Integrity Badge */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Document Lifecycle Status Badge */}
            <span
              className={`text-xs font-bold px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${currentSt.style}`}
            >
              <StatusIcon className="w-4 h-4" />
              {currentSt.label}
            </span>

            {/* Explicit Document Integrity State Badge */}
            {integrityState === 'VERIFIED' && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full border bg-emerald-500/20 text-emerald-300 border-emerald-500/40 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                VERIFIED
              </span>
            )}
            {integrityState === 'NOT_YET_VERIFIED' && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full border bg-slate-800 text-slate-400 border-slate-700 flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                NOT YET VERIFIED
              </span>
            )}
            {integrityState === 'COMPROMISED' && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full border bg-rose-500/20 text-rose-400 border-rose-500/50 flex items-center gap-1.5 animate-pulse">
                <ShieldAlert className="w-4 h-4" />
                COMPROMISED
              </span>
            )}
          </div>
        </div>

        {/* SHA-256 Trusted Hash Display Box */}
        {latestVersion && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                Trusted SHA-256 Hash (Version {latestVersion.versionNumber})
              </span>
              <button
                onClick={() => handleCopyHash(latestVersion.sha256Hash)}
                className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedHash === latestVersion.sha256Hash ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Full Hash</span>
                  </>
                )}
              </button>
            </div>
            <div className="font-mono text-xs text-amber-300/90 break-all select-all">
              {latestVersion.sha256Hash}
            </div>
          </div>
        )}

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2 flex-wrap">
            {latestVersion && (
              <button
                onClick={() => handleDownloadAndVerify(latestVersion)}
                disabled={downloading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{downloading ? 'Verifying Hashing...' : 'Download & Verify Byte Integrity'}</span>
              </button>
            )}

            {canRevise && (
              <button
                onClick={() => setIsRevisionOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4 text-sky-400" />
                <span>Upload New Revision</span>
              </button>
            )}
          </div>

          {/* Workflow Transition Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {canSubmit && (
              <button
                onClick={handleSubmitForReview}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 font-bold text-xs cursor-pointer transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit for Review</span>
              </button>
            )}

            {canApprove && (
              <button
                onClick={() => setIsApproveOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 font-bold text-xs cursor-pointer transition-all"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve Version</span>
              </button>
            )}

            {canSeal && (
              <button
                onClick={handleSeal}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 font-bold text-xs cursor-pointer transition-all disabled:opacity-50"
              >
                <LockKeyhole className="w-3.5 h-3.5" />
                <span>Seal Document</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Version History Table/List */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            Immutable Version History ({versions.length})
          </h3>
          <span className="text-[11px] text-slate-500">
            Existing versions are never overwritten
          </span>
        </div>

        <div className="space-y-3">
          {versions.map((ver) => (
            <div
              key={ver.id}
              className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs"
            >
              <div className="space-y-1 max-w-lg">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Version {ver.versionNumber}
                  </span>
                  {ver.isCompromised && (
                    <span className="font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 flex items-center gap-1 text-[10px]">
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
                  <p className="text-slate-400 italic text-[11px]">
                    "{ver.changeDescription}"
                  </p>
                )}

                <div className="font-mono text-[10px] text-slate-500 truncate">
                  SHA-256: <span className="text-slate-400">{ver.sha256Hash}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-slate-500 font-mono text-[11px]">
                  {(Number(ver.fileSizeBytes) / 1024).toFixed(1)} KB
                </span>

                <button
                  onClick={() => handleDownloadAndVerify(ver)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Download v{ver.versionNumber}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Approval History Timeline */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-4 shadow-lg">
        <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          Approval Audit History ({approvals.length})
        </h3>

        {approvals.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">No approval events recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {approvals.map((app) => (
              <div
                key={app.id}
                className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Bound to Version {app.version?.versionNumber || '?'}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        statusBadges[app.status]?.style || 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-500">
                    Requested: {new Date(app.requestedAt).toLocaleString()}
                  </span>
                </div>

                <div className="text-slate-300 text-xs">
                  Requested by: <strong className="text-slate-200">{app.requestedBy?.fullName}</strong>{' '}
                  ({app.requestedBy?.role})
                  {app.approvedBy && (
                    <span>
                      {' '}&bull; Approved by:{' '}
                      <strong className="text-emerald-400">{app.approvedBy.fullName}</strong> ({app.approvedBy.role})
                    </span>
                  )}
                </div>

                {app.comments && (
                  <p className="text-slate-400 text-[11px] italic bg-slate-900/60 p-2 rounded border border-slate-800">
                    Comments: "{app.comments}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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
              Approve Document Version {latestVersion?.versionNumber}
            </h3>

            <p className="text-xs text-slate-400 leading-relaxed">
              Approval will be strictly bound to Version ID{' '}
              <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-400 font-mono">
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
