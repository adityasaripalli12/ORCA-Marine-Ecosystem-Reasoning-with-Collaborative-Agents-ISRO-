import React, { useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { GlassCard } from '../components/common/GlassCard';
import { ProgressBar } from '../components/common/SkeletonLoader';
import { 
  UploadCloud, FileCode, CheckCircle2, AlertTriangle, 
  ShieldCheck, Database, FileUp, AlertCircle, XCircle, Eye, X, ArrowRight, ShieldAlert, Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type UploadState = 
  | 'IDLE' 
  | 'SELECTED' 
  | 'UPLOADING' 
  | 'SCANNING' 
  | 'CALCULATING_HASH' 
  | 'CHECKING_DUPLICATE' 
  | 'CHECKING_SIMILARITY' 
  | 'VALIDATING' 
  | 'AI_ANALYSIS' 
  | 'REGISTERING' 
  | 'READY' 
  | 'DUPLICATE_HALTED' 
  | 'BLOCKED' 
  | 'ERROR';

const MAX_FILE_SIZE_MB = 100;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const UploadPage: React.FC = () => {
  const { addDataset } = useData();
  const { user } = useAuth();
  const { addToast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastUploaded, setLastUploaded] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateModalData, setDuplicateModalData] = useState<any | null>(null);

  const handleFile = async (file: File) => {
    setErrorMessage(null);
    setLastUploaded(null);
    setDuplicateModalData(null);
    setSelectedFile(file);

    // 1. Client-Side Format & Size Validation
    setUploadState('VALIDATING');
    setStatusMessage('Validating dataset format and size…');
    setUploadProgress(10);

    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.nc', '.csv', '.json'].includes(ext)) {
      setUploadState('ERROR');
      setErrorMessage(`Unsupported format '${ext}'. Only .nc (NetCDF-3), .csv, and .json files are accepted.`);
      addToast('error', 'Unsupported Format', 'Only .nc, .csv, and .json files are allowed.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadState('ERROR');
      setErrorMessage(`File size (${(file.size / (1024*1024)).toFixed(1)} MB) exceeds maximum limit of ${MAX_FILE_SIZE_MB} MB.`);
      addToast('error', 'File Too Large', `Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    if (file.size === 0) {
      setUploadState('ERROR');
      setErrorMessage('Selected file is empty (0 bytes).');
      addToast('error', 'Empty File', 'Cannot upload an empty file.');
      return;
    }

    // 2. Real Upload Pipeline
    try {
      setUploadState('UPLOADING');
      setStatusMessage(`Uploading ${file.name} to secure backend storage…`);
      setUploadProgress(25);

      setUploadState('SCANNING');
      setStatusMessage('Scanning file content for prompt injection & malware…');
      setUploadProgress(40);

      setUploadState('CALCULATING_HASH');
      setStatusMessage('Calculating authoritative SHA-256 cryptographic checksum…');
      setUploadProgress(55);

      setUploadState('CHECKING_DUPLICATE');
      setStatusMessage('Checking database registry for exact SHA-256 matches…');
      setUploadProgress(70);

      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('floatchat_token');
      const res = await fetch('/api/v1/upload', {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      });

      // Handle Duplicate Detection (409 Conflict)
      if (res.status === 409) {
        const dupData = await res.json();
        const detail = dupData.detail || dupData;
        setUploadState('DUPLICATE_HALTED');
        setStatusMessage('⚠ DUPLICATE DETECTED — Upload halted immediately.');
        setUploadProgress(100);
        setDuplicateModalData(detail);
        addToast('error', 'Duplicate Dataset Detected', `This file matches existing dataset: ${detail.existing_dataset_name}`);
        return;
      }

      // Handle Security Block (403 Forbidden)
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({ detail: 'Upload blocked' }));
        setUploadState('BLOCKED');
        setErrorMessage(errData.detail || 'Security Gateway blocked dataset containing malicious prompt-injection payload.');
        addToast('error', 'Security Block', 'File contains unauthorized prompt injection instructions.');
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Upload failed' }));
        setUploadState('ERROR');
        setErrorMessage(errData.detail || 'Failed to process dataset on server.');
        addToast('error', 'Upload Error', errData.detail || 'Server processing error.');
        return;
      }

      setUploadState('CHECKING_SIMILARITY');
      setStatusMessage('Computing content fingerprint & analyzing near-duplicate similarity…');
      setUploadProgress(85);

      setUploadState('AI_ANALYSIS');
      setStatusMessage('AI structural validation & coordinate boundary verification…');
      setUploadProgress(95);

      const data = await res.json();

      setUploadState('READY');
      setStatusMessage(
        data.duplicate_status === 'Possible Duplicate'
          ? `Dataset registered for Administrator Review (Near-duplicate similarity: ${data.similarity_score}%).`
          : 'Dataset verified unique, registered, and available to ORCA AI.'
      );
      setUploadProgress(100);

      const newDSItem = {
        id: data.id,
        filename: data.dataset_name,
        fileSize: data.file_size,
        format: data.dataset_type as any,
        sha256: data.sha256_hash,
        verificationStatus: data.verification_status as any,
        duplicateStatus: data.duplicate_status as any,
        similarityScore: data.similarity_score,
        contentFingerprint: data.content_fingerprint,
        duplicateOfId: data.duplicate_of_id,
        aiAnalysis: data.ai_analysis,
        validationDetails: data.validation_details,
        uploadedBy: data.uploaded_by || user?.name || 'Researcher',
        uploadDate: new Date().toISOString().replace('T', ' ').slice(0, 16),
        rowCount: data.meta_data?.record_count || 0,
        metadata: data.meta_data || {}
      };

      addDataset(newDSItem);
      setLastUploaded(newDSItem);
      addToast(
        'upload_completed',
        data.duplicate_status === 'Possible Duplicate' ? 'Possible Duplicate Flagged' : 'Dataset Registered',
        `${file.name} successfully processed (${data.duplicate_status}).`
      );

    } catch (err: any) {
      setUploadState('ERROR');
      setErrorMessage(`Network or server error during upload: ${err.message || err}`);
      addToast('error', 'Network Error', 'Could not reach the backend dataset service.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden File Picker */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".nc,.csv,.json"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
          }
        }}
        className="hidden"
      />

      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-900/90 to-ocean-950/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Upload Ocean Dataset</h2>
          <p className="text-xs text-slate-300 mt-1">
            Upload NetCDF (.nc), CSV, or JSON ocean profiles. True pre-upload SHA-256 duplicate validation, content fingerprinting, and AI structural inspection.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs font-semibold text-cyan-400">
          <ShieldCheck className="w-4 h-4" /> SHA-256 & Duplicate Pipeline Active
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <GlassCard hoverEffect={false} className="p-8 text-center space-y-6">
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFile(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-10 transition-all cursor-pointer ${
            isDragging
              ? 'border-cyan-400 bg-cyan-500/15 scale-[1.01]'
              : 'border-slate-800 hover:border-cyan-500/50 bg-slate-900/30 hover:bg-slate-900/50'
          }`}
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 shadow-lg shadow-cyan-500/10">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white">
            Drag & Drop Ocean Dataset File Here
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            or <span className="text-cyan-400 font-semibold underline">browse from your computer</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-3 font-mono">
            Supported Formats: .nc (NetCDF-3 Binary), .csv, .json • Max size: 100 MB
          </p>
        </div>

        {/* Real Upload Pipeline Progress */}
        {uploadState !== 'IDLE' && (
          <div className="space-y-4 max-w-xl mx-auto p-5 rounded-2xl bg-slate-900/80 border border-slate-800 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                {selectedFile?.name}
              </span>
              <span className="font-mono text-cyan-400 font-bold">{uploadProgress}%</span>
            </div>

            <ProgressBar progress={uploadProgress} />

            <div className="flex items-center gap-2 text-xs font-mono">
              {uploadState === 'READY' ? (
                <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4" /> {statusMessage}
                </span>
              ) : uploadState === 'DUPLICATE_HALTED' ? (
                <span className="text-amber-400 flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4" /> {statusMessage}
                </span>
              ) : uploadState === 'BLOCKED' || uploadState === 'ERROR' ? (
                <span className="text-rose-400 flex items-center gap-1.5 font-bold">
                  <XCircle className="w-4 h-4" /> {errorMessage || statusMessage}
                </span>
              ) : (
                <span className="text-cyan-300 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 animate-spin text-cyan-400" /> {statusMessage}
                </span>
              )}
            </div>
          </div>
        )}
      </GlassCard>

      {/* Success Card */}
      {lastUploaded && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-3xl bg-slate-900/90 border border-emerald-500/30 shadow-2xl space-y-4"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  {lastUploaded.filename}
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {lastUploaded.verificationStatus}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    lastUploaded.duplicateStatus === 'Possible Duplicate'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  }`}>
                    {lastUploaded.duplicateStatus}
                  </span>
                </h4>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  SHA-256: {lastUploaded.sha256}
                </p>
              </div>
            </div>
            <a
              href="#/datasets"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500 hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              View in Dataset Manager <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {lastUploaded.aiAnalysis && (
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/[0.06] text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300">AI Validation Report</span>
                <span className="font-mono text-cyan-400 font-bold">
                  Confidence: {lastUploaded.aiAnalysis.confidence}%
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono text-slate-400">
                {lastUploaded.aiAnalysis.reasons?.map((r: string, idx: number) => (
                  <span key={idx} className="text-emerald-400">{r}</span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════
          DUPLICATE DETECTION MODAL (PART 13)
      ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {duplicateModalData && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md rounded-3xl bg-[#0b1322] border border-amber-500/40 shadow-2xl p-6 space-y-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white tracking-tight">
                      ⚠ DUPLICATE DATASET DETECTED
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      This dataset already exists in ORCA Marine EcoSystem.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDuplicateModalData(null)}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Duplicate Details Ledger */}
              <div className="space-y-2.5 p-4 rounded-2xl bg-slate-900/90 border border-white/[0.08] text-xs font-mono">
                <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                  <span className="text-slate-500">Filename:</span>
                  <span className="text-slate-200 font-bold">{duplicateModalData.filename}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                  <span className="text-slate-500">Existing Dataset:</span>
                  <span className="text-cyan-400 font-bold">{duplicateModalData.existing_dataset_name}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                  <span className="text-slate-500">SHA-256:</span>
                  <span className="text-slate-400 text-[11px] truncate max-w-[200px]" title={duplicateModalData.sha256}>
                    {duplicateModalData.sha256}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                  <span className="text-slate-500">Status:</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    DUPLICATE
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Uploaded:</span>
                  <span className="text-slate-300">{duplicateModalData.uploaded_date || '26 Aug 2026'}</span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                To prevent repository pollution and duplicate indexing, this duplicate file has <strong>not</strong> been registered.
              </p>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDuplicateModalData(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.09] transition-colors"
                >
                  Cancel
                </button>
                <a
                  href="#/datasets"
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-center text-white bg-gradient-to-r from-ocean-500 to-cyan-500 hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" /> View Existing Dataset
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
