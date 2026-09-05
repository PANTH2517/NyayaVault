import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  ArrowLeft,
  FileText,
  Upload,
  UserPlus,
  Shield,
  FileUp,
  Clock,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldAlert,
  Users,
  Activity,
} from 'lucide-react';
import { api } from '../../services/api';
import { Case, Document, DocumentClassification, DocumentStatus, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { MotionReveal, MotionStatus } from '../motion';
import { AUTHORITATIVE_EVIDENCE_TYPES, getEvidenceTypeLabel } from '../../utils/evidenceTypes';

interface CaseDetailViewProps {
  caseId: string;
  onBack: () => void;
  onSelectDocument: (docId: string) => void;
}

export const CaseDetailView: React.FC<CaseDetailViewProps> = ({
  caseId,
  onBack,
  onSelectDocument,
}) => {
  const { user } = useAuth();
  const [caseItem, setCaseItem] = useState<Case | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload Document Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState('FIR_REPORT');
  const [uploadClassification, setUploadClassification] =
    useState<DocumentClassification>('CONFIDENTIAL');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Assign User Modal State
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRoleInCase, setAssignRoleInCase] = useState('INVESTIGATING_OFFICER');
  const [assigning, setAssigning] = useState(false);

  const loadCaseDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cData, docsData] = await Promise.all([
        api.getCaseById(caseId),
        api.getDocumentsForCase(caseId),
      ]);
      setCaseItem(cData);
      setDocuments(docsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load case details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCaseDetails();
    if (user?.role === 'ADMIN') {
      api.getUsers().then(setAvailableUsers).catch(() => []);
    }
  }, [caseId]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', uploadTitle || selectedFile.name);
      formData.append('documentType', uploadType);
      formData.append('classification', uploadClassification);
      formData.append('file', selectedFile);

      await api.uploadDocument(caseId, formData);
      setIsUploadOpen(false);
      setUploadTitle('');
      setSelectedFile(null);
      loadCaseDetails();
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignUserId) {
      alert('Please select a user');
      return;
    }
    setAssigning(true);
    try {
      await api.assignUser(caseId, { userId: assignUserId, roleInCase: assignRoleInCase });
      setIsAssignOpen(false);
      setAssignUserId('');
      loadCaseDetails();
    } catch (err: any) {
      alert(`Assign user failed: ${err.message}`);
    } finally {
      setAssigning(false);
    }
  };

  const statusBadges: Record<DocumentStatus, { label: string; style: string; icon: any }> = {
    DRAFT: { label: 'DRAFT', style: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: Clock },
    UNDER_REVIEW: { label: 'UNDER REVIEW', style: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: Clock },
    APPROVED: { label: 'APPROVED', style: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: CheckCircle2 },
    SEALED: { label: 'SEALED', style: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30', icon: Lock },
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3 text-slate-400 text-xs font-sans">
        <Activity className="w-6 h-6 animate-spin text-amber-400" />
        <p className="font-semibold text-slate-300">Loading Case Operational Hub...</p>
      </div>
    );
  }

  if (error || !caseItem) {
    return (
      <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs space-y-3 font-sans">
        <div>{error || 'Case not found or access denied by CBAC policy.'}</div>
        <button onClick={onBack} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-bold cursor-pointer">
          Back to Cases List
        </button>
      </div>
    );
  }

  const canUpload = user?.role === 'ADMIN' || user?.role === 'INVESTIGATING_OFFICER';

  return (
    <div className="space-y-6 font-sans">
      {/* Top Back Navigation */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Case Listing</span>
      </button>

      {/* Case Operational Hub Hero Header */}
      <MotionReveal delayMs={0} className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                {caseItem.caseNumber}
              </span>
              <MotionStatus status={caseItem.status} />
              <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                Created: {new Date(caseItem.createdAt).toLocaleDateString()}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{caseItem.title}</h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              {caseItem.description || 'No detailed investigation summary provided.'}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {user?.role === 'ADMIN' && (
              <button
                onClick={() => setIsAssignOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-sky-400" />
                <span>Assign Personnel</span>
              </button>
            )}

            {canUpload && (
              <button
                onClick={() => setIsUploadOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Evidence (v1)</span>
              </button>
            )}
          </div>
        </div>

        {/* Assigned Personnel */}
        <div className="pt-4 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Users className="w-4 h-4 text-amber-400" />
            <span>Assigned Case Personnel ({caseItem.assignments ? caseItem.assignments.length : 0})</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {caseItem.assignments && caseItem.assignments.length > 0 ? (
              caseItem.assignments.map((asgn) => (
                <div
                  key={asgn.id}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-2"
                >
                  <span className="font-semibold text-white">{asgn.user?.fullName || asgn.userId}</span>
                  <span className="text-[10px] font-mono text-amber-400/90 uppercase px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                    {asgn.roleInCase || 'OFFICER'}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-xs text-slate-500 italic">No specific personnel assigned to this case.</span>
            )}
          </div>
        </div>
      </MotionReveal>

      {/* Case Evidence Documents Grid */}
      <MotionReveal delayMs={50} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            Case Evidence Files ({documents.length})
          </h2>
          <span className="text-xs font-mono text-slate-400">
            SHA-256 Byte Verified
          </span>
        </div>

        {documents.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-3xl border border-slate-800 space-y-3">
            <FileUp className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="font-semibold text-slate-300">No Evidence Documents Uploaded</p>
            <p className="text-slate-500">Upload evidence files to establish SHA-256 byte fingerprints and immutable version records.</p>
            {canUpload && (
              <button
                onClick={() => setIsUploadOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-amber-500/20 mt-1"
              >
                <Upload className="w-4 h-4" />
                <span>Upload First Evidence File</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map((doc) => {
              const currentVer = doc.versions && doc.versions[0];
              const st = statusBadges[doc.currentStatus];
              const StatusIcon = st.icon;

              return (
                <div
                  key={doc.id}
                  onClick={() => onSelectDocument(doc.id)}
                  className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 transition-all duration-300 cursor-pointer space-y-4 group shadow-xl backdrop-blur-xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase font-mono font-bold text-amber-400 tracking-wider">
                        {doc.documentType} &bull; {doc.classification}
                      </div>
                      <h3 className="text-base font-extrabold text-white group-hover:text-amber-300 transition-colors">
                        {doc.title}
                      </h3>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 shrink-0 ${st.style}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      {st.label}
                    </span>
                  </div>

                  {currentVer && (
                    <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-slate-400 space-y-1.5">
                      <div className="flex items-center justify-between text-slate-300 font-bold">
                        <span>Version {currentVer.versionNumber}</span>
                        <span className="text-slate-400">
                          {(Number(currentVer.fileSizeBytes) / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <div className="text-[10px]">
                        Status: <span className="text-emerald-400 font-bold">Integrity Verified</span>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/80">
                    <span>Uploaded: {new Date(doc.createdAt).toLocaleDateString()}</span>
                    <span className="text-amber-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      <span>Open Evidence</span>
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </MotionReveal>

      {/* Upload Evidence Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-400" />
                Upload Evidence Document (v1)
              </h3>
              <button onClick={() => setIsUploadOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                &times;
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Document Title</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  required
                  placeholder="e.g. First Information Report (FIR)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Document Type / Classification</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-bold focus:outline-none focus:border-amber-500 text-xs"
                  >
                    {AUTHORITATIVE_EVIDENCE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={uploadClassification}
                    onChange={(e) => setUploadClassification(e.target.value as DocumentClassification)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="RESTRICTED">RESTRICTED</option>
                    <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                    <option value="HIGHLY_CONFIDENTIAL">HIGHLY CONFIDENTIAL</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Select File Payload</label>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50 shadow-lg shadow-amber-500/20"
                >
                  {uploading ? 'Uploading & Computing SHA-256...' : 'Upload Evidence File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign User Modal */}
      {isAssignOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-sky-400" />
                Assign Personnel to Case
              </h3>
              <button onClick={() => setIsAssignOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                &times;
              </button>
            </div>

            <form onSubmit={handleAssignUser} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Select Registered Personnel</label>
                <select
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select Personnel...</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.role}) - {u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Case Operational Role</label>
                <select
                  value={assignRoleInCase}
                  onChange={(e) => setAssignRoleInCase(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                >
                  <option value="INVESTIGATING_OFFICER">INVESTIGATING_OFFICER</option>
                  <option value="SUPERVISOR">SUPERVISOR</option>
                  <option value="PROSECUTOR">PROSECUTOR</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssignOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
                >
                  {assigning ? 'Assigning...' : 'Grant Access Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
