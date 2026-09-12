import React, { useEffect, useState, useMemo } from 'react';
import {
  Briefcase,
  ArrowLeft,
  FileText,
  Upload,
  UserPlus,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Lock,
  ArrowRight,
  Users,
  Activity,
  Fingerprint,
  Search,
  Filter,
  X,
  FileUp,
} from 'lucide-react';
import { api } from '../../services/api';
import { Case, Document, DocumentClassification, DocumentStatus, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { MotionReveal, MotionStatus, MotionStagger, MotionCard } from '../motion';
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

  // Evidence Search & Filter within Case Workspace
  const [docSearch, setDocSearch] = useState('');
  const [docStatusFilter, setDocStatusFilter] = useState<string>('ALL');
  const [docClassFilter, setDocClassFilter] = useState<string>('ALL');

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
      setError(err.message || 'Failed to load case workspace details');
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

  // Filter evidence within current case
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        !docSearch.trim() ||
        doc.title.toLowerCase().includes(docSearch.toLowerCase()) ||
        (doc.description && doc.description.toLowerCase().includes(docSearch.toLowerCase())) ||
        (doc.exhibitNumber && doc.exhibitNumber.toLowerCase().includes(docSearch.toLowerCase()));

      const matchesStatus = docStatusFilter === 'ALL' || doc.currentStatus === docStatusFilter;
      const matchesClass = docClassFilter === 'ALL' || doc.classification === docClassFilter;

      return matchesSearch && matchesStatus && matchesClass;
    });
  }, [documents, docSearch, docStatusFilter, docClassFilter]);

  const statusBadges: Record<DocumentStatus, { label: string; style: string; icon: any }> = {
    DRAFT: { label: 'DRAFT', style: 'bg-slate-500/15 text-slate-300 border-slate-500/30', icon: Clock },
    UNDER_REVIEW: { label: 'UNDER REVIEW', style: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: Clock },
    APPROVED: { label: 'APPROVED', style: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: CheckCircle2 },
    SEALED: { label: 'SEALED & IMMUTABLE', style: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40', icon: Lock },
  };

  if (loading) {
    return (
      <div className="space-y-8 font-sans">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-mono font-bold text-slate-400"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO INVESTIGATIONS LIST</span>
        </button>

        <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-6 animate-pulse">
          <div className="h-6 bg-slate-800 rounded w-1/4" />
          <div className="h-8 bg-slate-800 rounded w-1/2" />
          <div className="h-4 bg-slate-800 rounded w-3/4" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((n) => (
            <div key={n} className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 h-48 animate-pulse space-y-4">
              <div className="h-4 bg-slate-800 rounded w-1/3" />
              <div className="h-6 bg-slate-800 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !caseItem) {
    return (
      <div className="p-6 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs space-y-3 font-sans">
        <div>{error || 'Case not found or access denied by CBAC policy.'}</div>
        <button onClick={onBack} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-bold cursor-pointer">
          Back to Cases List
        </button>
      </div>
    );
  }

  const canUpload = user?.role === 'ADMIN' || user?.role === 'INVESTIGATING_OFFICER';

  return (
    <div className="space-y-8 font-sans">
      {/* Top Back Navigation */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-mono font-bold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>BACK TO INVESTIGATIONS LIST</span>
      </button>

      {/* Case Operational Hub Hero Header */}
      <MotionReveal delayMs={0} className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 space-y-6 shadow-2xl backdrop-blur-2xl">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                CASE {caseItem.caseNumber}
              </span>
              <MotionStatus status={caseItem.status} />
              <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
                Created: {new Date(caseItem.createdAt).toLocaleDateString()}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{caseItem.title}</h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
              {caseItem.description || 'No detailed investigation summary provided.'}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {user?.role === 'ADMIN' && (
              <button
                onClick={() => setIsAssignOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-800 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-sky-400" />
                <span>Assign Personnel</span>
              </button>
            )}

            {canUpload && (
              <button
                onClick={() => setIsUploadOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Evidence (v1)</span>
              </button>
            )}
          </div>
        </div>

        {/* Assigned Personnel Bar */}
        <div className="pt-5 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300">
            <Users className="w-4 h-4 text-amber-400" />
            <span>ASSIGNED CASE PERSONNEL ({caseItem.assignments ? caseItem.assignments.length : 0})</span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {caseItem.assignments && caseItem.assignments.length > 0 ? (
              caseItem.assignments.map((asgn) => (
                <div
                  key={asgn.id}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800/80 text-xs text-slate-300 flex items-center gap-2.5"
                >
                  <span className="font-bold text-white">{asgn.user?.fullName || asgn.userId}</span>
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                    {asgn.roleInCase || 'OFFICER'}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-xs text-slate-500 italic font-mono">No personnel specifically assigned to this case.</span>
            )}
          </div>
        </div>
      </MotionReveal>

      {/* Case Evidence Collection Workspace & Filtering */}
      <MotionReveal delayMs={50} className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest">
              PROTECTED DIGITAL ARTIFACTS
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2.5 mt-0.5">
              <FileText className="w-5 h-5 text-amber-400" />
              Evidence Collection ({documents.length})
            </h2>
          </div>

          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            SHA-256 Byte Verified
          </span>
        </div>

        {/* Evidence Search & Filter Toolbar */}
        {documents.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder="Search evidence title, exhibit #..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <select
              value={docStatusFilter}
              onChange={(e) => setDocStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Statuses ({documents.length})</option>
              <option value="DRAFT">DRAFT</option>
              <option value="UNDER_REVIEW">UNDER REVIEW</option>
              <option value="APPROVED">APPROVED</option>
              <option value="SEALED">SEALED</option>
            </select>

            <select
              value={docClassFilter}
              onChange={(e) => setDocClassFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Classification Levels</option>
              <option value="RESTRICTED">RESTRICTED</option>
              <option value="CONFIDENTIAL">CONFIDENTIAL</option>
              <option value="HIGHLY_CONFIDENTIAL">HIGHLY CONFIDENTIAL</option>
            </select>
          </div>
        )}

        {documents.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-3xl border border-slate-800/80 space-y-3 font-sans">
            <FileUp className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="font-extrabold text-sm text-slate-300">NO EVIDENCE DOCUMENTS UPLOADED</p>
            <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
              Upload evidence files to establish SHA-256 byte fingerprints, AES-256 envelopes, and immutable ledger records.
            </p>
            {canUpload && (
              <button
                onClick={() => setIsUploadOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-xs cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-amber-500/20 mt-1"
              >
                <Upload className="w-4 h-4" />
                <span>Upload First Evidence File</span>
              </button>
            )}
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-3xl border border-slate-800/80 space-y-2 font-sans">
            <p className="font-bold text-slate-300">NO EVIDENCE MATCHES CURRENT SEARCH FILTER</p>
            <button
              onClick={() => {
                setDocSearch('');
                setDocStatusFilter('ALL');
                setDocClassFilter('ALL');
              }}
              className="text-amber-400 font-bold underline cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <MotionStagger staggerMs={40} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredDocuments.map((doc) => {
              const currentVer = doc.versions && doc.versions[0];
              const st = statusBadges[doc.currentStatus];
              const StatusIcon = st.icon;

              return (
                <MotionCard
                  key={doc.id}
                  onClick={() => onSelectDocument(doc.id)}
                  className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 hover:border-amber-500/40 transition-all duration-300 cursor-pointer space-y-4 group shadow-xl backdrop-blur-2xl relative"
                >
                  {/* Forensic Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase font-mono font-bold text-amber-400 tracking-wider flex items-center gap-2 flex-wrap">
                        <span>{getEvidenceTypeLabel(doc.documentType)} &bull; {doc.classification}</span>
                        {doc.exhibitNumber && (
                          <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            Ex #{doc.exhibitNumber}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-extrabold text-white group-hover:text-amber-300 transition-colors">
                        {doc.title}
                      </h3>
                    </div>

                    <span
                      className={`text-[10px] font-mono font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 shrink-0 ${st.style}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      {st.label}
                    </span>
                  </div>

                  {/* Forensic Technical Metadata Box */}
                  {currentVer && (
                    <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800/80 font-mono text-[11px] text-slate-400 space-y-2">
                      <div className="flex items-center justify-between text-slate-300 font-bold">
                        <span>VERSION 0{currentVer.versionNumber}</span>
                        <span className="text-slate-400">
                          {(Number(currentVer.fileSizeBytes) / 1024).toFixed(1)} KB
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>ENCRYPTION: <strong className="text-slate-300">AES-256-GCM</strong></span>
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <Fingerprint className="w-3 h-3" />
                          VERIFIED
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Artifact Tags */}
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {doc.tags.map((t, idx) => (
                        <span key={idx} className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Card Footer Action */}
                  <div className="pt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80">
                    <span className="font-mono text-[11px]">Uploaded: {new Date(doc.createdAt).toLocaleDateString()}</span>
                    <span className="text-amber-400 font-extrabold text-xs flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      <span>OPEN ARTIFACT</span>
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </MotionCard>
              );
            })}
          </MotionStagger>
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
