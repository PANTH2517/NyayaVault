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
} from 'lucide-react';
import { api } from '../../services/api';
import { Case, Document, DocumentClassification, DocumentStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';

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
  const [uploadType, setUploadType] = useState('FIR');
  const [uploadClassification, setUploadClassification] =
    useState<DocumentClassification>('CONFIDENTIAL');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Assign User Modal State
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRoleInCase, setAssignRoleInCase] = useState('Assigned Officer');
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
      formData.append('title', uploadTitle);
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
      alert('Please enter a User ID');
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
    return <div className="text-center py-20 text-xs text-slate-400">Loading Case Details...</div>;
  }

  if (error || !caseItem) {
    return (
      <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs space-y-3">
        <div>{error || 'Case not found'}</div>
        <button onClick={onBack} className="px-3 py-1 rounded bg-slate-800 text-slate-200">
          Back to Cases
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
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Case Listing</span>
      </button>

      {/* Case Header Card */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
              {caseItem.caseNumber}
            </span>
            <h2 className="text-2xl font-extrabold text-white mt-2">{caseItem.title}</h2>
            <p className="text-xs text-slate-400 mt-1">
              {caseItem.description || 'No detailed description available.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {user?.role === 'ADMIN' && (
              <button
                onClick={() => setIsAssignOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-sky-400" />
                <span>Assign Member</span>
              </button>
            )}

            {canUpload && (
              <button
                onClick={() => setIsUploadOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Document (v1)</span>
              </button>
            )}
          </div>
        </div>

        {/* Assigned Team List */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center gap-2 flex-wrap text-xs">
          <span className="font-semibold text-slate-400">Assigned Team:</span>
          {caseItem.assignments && caseItem.assignments.length > 0 ? (
            caseItem.assignments.map((asgn) => (
              <span
                key={asgn.id}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-[11px]"
              >
                {asgn.user?.fullName || asgn.userId} ({asgn.roleInCase || 'Officer'})
              </span>
            ))
          ) : (
            <span className="text-slate-500 italic text-[11px]">No specific user assignments</span>
          )}
        </div>
      </div>

      {/* Documents Section */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-400" />
          Case Documents ({documents.length})
        </h3>

        {documents.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
            <FileUp className="w-8 h-8 text-slate-600 mx-auto" />
            <p>No documents uploaded yet for this case.</p>
            {canUpload && (
              <button
                onClick={() => setIsUploadOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer inline-block"
              >
                Upload First Document
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
                  className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 transition-all cursor-pointer space-y-3 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {doc.documentType} • {doc.classification}
                      </div>
                      <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                        {doc.title}
                      </h4>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${st.style}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {st.label}
                    </span>
                  </div>

                  {currentVer && (
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-[10px] text-slate-400 space-y-1">
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Version {currentVer.versionNumber}</span>
                        <span className="text-slate-500">
                          {(Number(currentVer.fileSizeBytes) / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <div className="text-slate-500 truncate">
                        SHA-256: <span className="text-amber-400/90">{currentVer.sha256Hash.substring(0, 18)}...</span>
                      </div>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                    <span>Uploaded: {new Date(doc.createdAt).toLocaleDateString()}</span>
                    <span className="text-amber-400 font-semibold group-hover:underline">
                      View Details & History &rarr;
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Document Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-400" />
              Upload Initial Document (v1)
            </h3>

            <form onSubmit={handleUpload} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Document Title</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  required
                  placeholder="e.g. First Information Report"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Document Type</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="FIR">FIR / Police Report</option>
                  <option value="WITNESS_STATEMENT">Witness Statement</option>
                  <option value="CHARGE_SHEET">Charge Sheet</option>
                  <option value="EVIDENCE">Evidence Record</option>
                  <option value="FORENSIC_REPORT">Forensic Report</option>
                  <option value="COURT_FILING">Court Filing</option>
                  <option value="ATTACHMENT">Supporting Attachment</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Classification Level</label>
                <select
                  value={uploadClassification}
                  onChange={(e) => setUploadClassification(e.target.value as DocumentClassification)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="RESTRICTED">RESTRICTED</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                  <option value="HIGHLY_CONFIDENTIAL">HIGHLY CONFIDENTIAL</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Select File (PDF, Image, Text, Word)</label>
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
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
                >
                  {uploading ? 'Uploading & Hashing...' : 'Upload & Compute Hash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign User Modal */}
      {isAssignOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-sky-400" />
              Assign User to Case (CBAC Grant)
            </h3>

            <form onSubmit={handleAssignUser} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Target User UUID</label>
                <input
                  type="text"
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  required
                  placeholder="Paste User ID UUID"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Role Title in Case</label>
                <input
                  type="text"
                  value={assignRoleInCase}
                  onChange={(e) => setAssignRoleInCase(e.target.value)}
                  placeholder="e.g. Lead Investigator / Prosecutor"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssignOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {assigning ? 'Assigning...' : 'Grant Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
