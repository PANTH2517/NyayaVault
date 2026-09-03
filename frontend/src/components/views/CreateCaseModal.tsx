import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase,
  X,
  UserPlus,
  FilePlus,
  CheckCircle2,
  Upload,
  FileText,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../services/api';
import { User, DocumentClassification } from '../../types';
import { AUTHORITATIVE_EVIDENCE_TYPES } from '../../utils/evidenceTypes';

interface CreateCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaseCreated: (createdCaseId: string) => void;
}

export const CreateCaseModal: React.FC<CreateCaseModalProps> = ({
  isOpen,
  onClose,
  onCaseCreated,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Case Details
  const [caseNumber, setCaseNumber] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Step 2: Personnel Assignment
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedIoId, setSelectedIoId] = useState<string>('');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>('');
  const [selectedProsecutorId, setSelectedProsecutorId] = useState<string>('');

  // Step 3: Initial Evidence
  const [initialFile, setInitialFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState('FIR_REPORT');
  const [classification, setClassification] = useState<DocumentClassification>('CONFIDENTIAL');

  // Loading & Error State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Auto-generate default case number format
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      setCaseNumber(`CR-2026-${randomSuffix}`);
      setStep(1);
      setError(null);
      setCreatedCaseId(null);
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    try {
      const users = await api.getUsers();
      setAvailableUsers(users);
    } catch (_) {
      // Non-admin or fetch failure fallback
      setAvailableUsers([]);
    }
  };

  if (!isOpen) return null;

  const handleNextStep1 = () => {
    if (!caseNumber.trim() || !title.trim()) {
      setError('Please provide both Case Number and Title.');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleNextStep2 = () => {
    setError(null);
    setStep(3);
  };

  const handleSubmitCase = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Create Case
      const newCase = await api.createCase({
        caseNumber: caseNumber.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
      });

      // 2. Assign Personnel (if selected)
      const assignmentPromises: Promise<any>[] = [];
      if (selectedIoId) {
        assignmentPromises.push(
          api.assignUser(newCase.id, { userId: selectedIoId, roleInCase: 'INVESTIGATING_OFFICER' })
        );
      }
      if (selectedSupervisorId) {
        assignmentPromises.push(
          api.assignUser(newCase.id, { userId: selectedSupervisorId, roleInCase: 'SUPERVISOR' })
        );
      }
      if (selectedProsecutorId) {
        assignmentPromises.push(
          api.assignUser(newCase.id, { userId: selectedProsecutorId, roleInCase: 'PROSECUTOR' })
        );
      }
      await Promise.all(assignmentPromises);

      // 3. Upload Initial Evidence (if file attached)
      if (initialFile) {
        const formData = new FormData();
        formData.append('title', docTitle.trim() || initialFile.name);
        formData.append('documentType', docType);
        formData.append('classification', classification);
        formData.append('file', initialFile);
        await api.uploadDocument(newCase.id, formData);
      }

      setCreatedCaseId(newCase.id);
      setStep(4);
    } catch (err: any) {
      setError(err.message || 'Failed to create case. Please verify inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Create Investigation Case</h3>
              <p className="text-[11px] text-slate-400">Step {step} of 4 &bull; Evidence Management Workflow</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="grid grid-cols-4 border-b border-slate-800/80 text-[11px] font-mono text-center">
          <div className={`py-2 border-r border-slate-800/80 ${step >= 1 ? 'bg-amber-500/10 text-amber-400 font-bold' : 'text-slate-500'}`}>
            1. Identity
          </div>
          <div className={`py-2 border-r border-slate-800/80 ${step >= 2 ? 'bg-amber-500/10 text-amber-400 font-bold' : 'text-slate-500'}`}>
            2. Personnel
          </div>
          <div className={`py-2 border-r border-slate-800/80 ${step >= 3 ? 'bg-amber-500/10 text-amber-400 font-bold' : 'text-slate-500'}`}>
            3. Initial Evidence
          </div>
          <div className={`py-2 ${step >= 4 ? 'bg-emerald-500/10 text-emerald-400 font-bold' : 'text-slate-500'}`}>
            4. Complete
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: CASE IDENTITY */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Case Number / Reference ID *</label>
                <input
                  type="text"
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  placeholder="e.g. CR-2026-0042"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Case Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. State Investigation into Cyber Forensic Evidence"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Case Summary / Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide background context and scope of investigation..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {/* STEP 2: PERSONNEL ASSIGNMENTS */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Assign authorized personnel to grant Case-Based Access Control (CBAC) visibility.
              </p>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                    Investigating Officer
                  </label>
                  <select
                    value={selectedIoId}
                    onChange={(e) => setSelectedIoId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Select Lead Investigating Officer...</option>
                    {availableUsers
                      .filter((u) => u.role === 'INVESTIGATING_OFFICER')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} ({u.email})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-sky-400" />
                    Superintendent / Supervisor
                  </label>
                  <select
                    value={selectedSupervisorId}
                    onChange={(e) => setSelectedSupervisorId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Select Assigned Supervisor...</option>
                    {availableUsers
                      .filter((u) => u.role === 'SUPERVISOR')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} ({u.email})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                    Public Prosecutor
                  </label>
                  <select
                    value={selectedProsecutorId}
                    onChange={(e) => setSelectedProsecutorId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Select Assigned Prosecutor...</option>
                    {availableUsers
                      .filter((u) => u.role === 'PROSECUTOR')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} ({u.email})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: INITIAL EVIDENCE INTAKE */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Optionally upload an initial evidence document (e.g. FIR, Inspection Report).
              </p>

              <div className="border-2 border-dashed border-slate-800 rounded-2xl p-5 text-center hover:border-amber-500/50 transition-colors bg-slate-950/60 space-y-2">
                <Upload className="w-8 h-8 text-amber-400 mx-auto" />
                <div className="text-xs font-bold text-slate-200">
                  {initialFile ? initialFile.name : 'Select or Drag PDF Evidence File'}
                </div>
                {initialFile && (
                  <div className="text-[10px] font-mono text-emerald-400">
                    {(initialFile.size / 1024).toFixed(1)} KB &bull; SHA-256 will be calculated on upload
                  </div>
                )}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setInitialFile(file);
                      if (!docTitle) setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                  className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                />
              </div>

              {initialFile && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">Document Title</label>
                    <input
                      type="text"
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">Evidence Type</label>
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-400 font-bold focus:outline-none focus:border-amber-500"
                    >
                      {AUTHORITATIVE_EVIDENCE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label} ({t.value})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: SUCCESS CONFIRMATION */}
          {step === 4 && (
            <div className="text-center py-6 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-lg font-extrabold text-white">Investigation Case Created</h4>
                <p className="text-xs font-mono text-amber-400">{caseNumber} &bull; {title}</p>
                <p className="text-xs text-slate-400">
                  Case initialized successfully in database with active CBAC personnel assignments.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
          {step < 4 ? (
            <>
              <div>
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep((step - 1) as any)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {step === 1 && (
                  <button
                    type="button"
                    onClick={handleNextStep1}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    <span>Next: Personnel</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                {step === 2 && (
                  <button
                    type="button"
                    onClick={handleNextStep2}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    <span>Next: Initial Evidence</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                {step === 3 && (
                  <button
                    type="button"
                    onClick={handleSubmitCase}
                    disabled={loading}
                    className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{loading ? 'Creating Case...' : 'Create Investigation Case'}</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Close Modal
              </button>
              {createdCaseId && (
                <button
                  type="button"
                  onClick={() => {
                    onCaseCreated(createdCaseId);
                    onClose();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  <span>Open Case Operational Hub</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
