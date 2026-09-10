import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Tag, FileText, Shield, Hash, FileEdit, AlertCircle, Save, Plus } from 'lucide-react';
import { Document, DocumentClassification } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AUTHORITATIVE_EVIDENCE_TYPES } from '../../utils/evidenceTypes';

interface EditMetadataModalProps {
  document: Document;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditMetadataModal: React.FC<EditMetadataModalProps> = ({
  document,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [title, setTitle] = useState(document.title || '');
  const [description, setDescription] = useState(document.description || '');
  const [documentType, setDocumentType] = useState(document.documentType || 'FIR_REPORT');
  const [classification, setClassification] = useState<DocumentClassification>(
    document.classification || 'CONFIDENTIAL'
  );
  const [exhibitNumber, setExhibitNumber] = useState(document.exhibitNumber || '');
  const [tags, setTags] = useState<string[]>(document.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [metadataJson, setMetadataJson] = useState<string>(
    document.metadata ? JSON.stringify(document.metadata, null, 2) : ''
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isSealed = document.currentStatus === 'SEALED';
  const canEditClassification =
    !isSealed && (user?.role === 'ADMIN' || user?.role === 'SUPERVISOR');
  const canEditMetadata =
    !isSealed &&
    (user?.role === 'ADMIN' ||
      user?.role === 'INVESTIGATING_OFFICER' ||
      user?.role === 'SUPERVISOR');

  const handleAddTag = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();

    const trimmed = tagInput.trim();
    if (!trimmed) return;
    if (trimmed.length > 30) {
      setError('Tag length cannot exceed 30 characters');
      return;
    }
    if (tags.length >= 10) {
      setError('Maximum 10 tags allowed');
      return;
    }
    if (tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setTagInput('');
      return;
    }

    setTags([...tags, trimmed]);
    setTagInput('');
    setError(null);
  };

  const handleRemoveTag = (indexToRemove: number) => {
    setTags(tags.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditMetadata) {
      setError('You are not authorized to modify evidence metadata.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let parsedMetadata: Record<string, any> | undefined = undefined;
      if (metadataJson.trim()) {
        try {
          parsedMetadata = JSON.parse(metadataJson.trim());
        } catch (_) {
          throw new Error('Custom metadata must be valid JSON');
        }
      }

      await api.updateDocumentMetadata(document.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        documentType,
        classification: canEditClassification ? classification : undefined,
        exhibitNumber: exhibitNumber.trim() || undefined,
        tags,
        metadata: parsedMetadata,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update evidence metadata');
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
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">Edit Evidence Classification & Metadata</h2>
              <p className="text-xs text-slate-400 font-mono">Document ID: {document.id.slice(0, 8)}...</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title & Document Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>Evidence Title</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                disabled={!canEditMetadata}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 font-mono disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-sky-400" />
                <span>Evidence Type / Category</span>
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                disabled={!canEditMetadata}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono disabled:opacity-50"
              >
                {AUTHORITATIVE_EVIDENCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Classification & Exhibit Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>Classification Level</span>
                {!canEditClassification && (
                  <span className="text-[10px] font-normal text-slate-500 italic">
                    ({user?.role === 'INVESTIGATING_OFFICER' ? 'Supervisor Only' : 'Locked'})
                  </span>
                )}
              </label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value as DocumentClassification)}
                disabled={!canEditClassification}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono disabled:opacity-50"
              >
                <option value="RESTRICTED">RESTRICTED</option>
                <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                <option value="HIGHLY_CONFIDENTIAL">HIGHLY CONFIDENTIAL</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exhibit / Reference Number</span>
              </label>
              <input
                type="text"
                value={exhibitNumber}
                onChange={(e) => setExhibitNumber(e.target.value)}
                placeholder="e.g. EX-2026-009A"
                maxLength={50}
                disabled={!canEditMetadata}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 font-mono disabled:opacity-50"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Description / Evidence Summary</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Provide context, details, or investigative summary..."
              disabled={!canEditMetadata}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-sans disabled:opacity-50 resize-none"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Tags & Keywords ({tags.length}/10)</span>
              <span className="text-[10px] text-slate-500 font-normal">Press Enter to add tag</span>
            </label>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Add tag (e.g. FORENSIC, CYBER, IP_LOG)..."
                maxLength={30}
                disabled={!canEditMetadata || tags.length >= 10}
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 font-mono disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={!canEditMetadata || tags.length >= 10 || !tagInput.trim()}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono"
                >
                  #{tag}
                  {canEditMetadata && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(idx)}
                      className="text-amber-400/60 hover:text-rose-400 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
              ))}
              {tags.length === 0 && (
                <span className="text-xs text-slate-500 italic">No tags attached</span>
              )}
            </div>
          </div>

          {/* Custom JSON Metadata */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Custom JSON Metadata</span>
              <span className="text-[10px] font-mono text-slate-500">JSON Object</span>
            </label>
            <textarea
              value={metadataJson}
              onChange={(e) => setMetadataJson(e.target.value)}
              rows={3}
              placeholder='{\n  "location": "Locker A-14",\n  "collectedBy": "Insp. Sharma"\n}'
              disabled={!canEditMetadata}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-emerald-400 font-mono focus:outline-none focus:border-amber-500 disabled:opacity-50 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !canEditMetadata}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Save Metadata Changes'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
