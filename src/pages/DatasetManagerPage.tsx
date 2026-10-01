import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { GlassCard } from '../components/common/GlassCard';
import { DatasetItem } from '../types';
import { 
  Database, Search, Filter, Trash2, Eye, FileCode, 
  CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, ChevronLeft, ChevronRight,
  GitCompare, ShieldAlert, Check, X, Shield, Activity, Layers, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const DatasetManagerPage: React.FC = () => {
  const { datasets, deleteDataset } = useData();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [previewModalDataset, setPreviewModalDataset] = useState<DatasetItem | null>(null);
  const [compareModalData, setCompareModalData] = useState<any | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [integrityStats, setIntegrityStats] = useState<any>({
    total_datasets: 0,
    unique: 0,
    duplicates: 0,
    possible_duplicates: 0,
    invalid: 0,
    under_review: 0,
    quarantined: 0,
  });

  const fetchIntegrityStats = async () => {
    try {
      const token = localStorage.getItem('floatchat_token');
      const res = await fetch('/api/v1/datasets/integrity-stats', {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        const data = await res.json();
        setIntegrityStats(data);
      }
    } catch (e) {
      console.warn('Could not fetch dataset integrity stats:', e);
    }
  };

  useEffect(() => {
    fetchIntegrityStats();
  }, [datasets]);

  const filteredDatasets = datasets.filter((ds) => {
    const matchesSearch = ds.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ds.sha256.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ds.uploadedBy.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFormat = formatFilter === 'all' || ds.format === formatFilter;
    const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'unique' && ds.duplicateStatus === 'Unique') ||
                          (statusFilter === 'possible' && (ds.duplicateStatus === 'Possible Duplicate' || ds.duplicateStatus === 'Under Review')) ||
                          (statusFilter === 'duplicate' && (ds.duplicateStatus === 'Duplicate' || (ds.duplicateStatus as string) === 'Duplicate Found'));
    return matchesSearch && matchesFormat && matchesStatus;
  });

  const handleDelete = (id: string) => {
    deleteDataset(id);
    setDeleteConfirmId(null);
    addToast('info', 'Dataset Removed', `Dataset ID ${id} deleted from repository.`);
    fetchIntegrityStats();
  };

  const handleOpenCompare = async (targetDs: DatasetItem) => {
    const candidateId = targetDs.duplicateOfId || (datasets.find(d => d.id !== targetDs.id)?.id);
    if (!candidateId) {
      addToast('info', 'No Comparison Target', 'No reference dataset found to compare against.');
      return;
    }

    try {
      const token = localStorage.getItem('floatchat_token');
      const res = await fetch('/api/v1/datasets/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          dataset_a_id: candidateId,
          dataset_b_id: targetDs.id
        })
      });

      if (!res.ok) {
        throw new Error('Comparison failed');
      }

      const data = await res.json();
      setCompareModalData(data);
    } catch (e: any) {
      addToast('error', 'Comparison Error', e.message || 'Could not compare datasets.');
    }
  };

  const handleReviewAction = async (datasetId: string, action: string) => {
    try {
      const token = localStorage.getItem('floatchat_token');
      const res = await fetch(`/api/v1/datasets/${datasetId}/review-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ action })
      });

      if (!res.ok) {
        throw new Error('Review action failed');
      }

      setCompareModalData(null);
      addToast('info', 'Decision Recorded', `Administrator action '${action}' applied to dataset.`);
      fetchIntegrityStats();
      window.location.reload();
    } catch (e: any) {
      addToast('error', 'Action Error', e.message || 'Could not record review action.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-900/90 to-ocean-950/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Dataset Manager</h2>
          <p className="text-xs text-slate-300 mt-1">
            Manage NetCDF binary datasets, inspect SHA-256 cryptographic hashes, and resolve duplicate files.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="#/upload"
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500 hover:from-ocean-400 hover:to-cyan-400 shadow-lg shadow-cyan-500/20"
          >
            + Upload New File
          </a>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          DOCUMENT / DATASET INTEGRITY DASHBOARD (PART 26)
      ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'TOTAL DATASETS', value: integrityStats.total_datasets || datasets.length, color: 'text-white', bg: 'bg-slate-900/80', border: 'border-slate-800' },
          { label: 'UNIQUE', value: integrityStats.unique || datasets.filter(d => d.duplicateStatus === 'Unique').length, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
          { label: 'DUPLICATES', value: integrityStats.duplicates || 0, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
          { label: 'POSSIBLE DUPLICATES', value: integrityStats.possible_duplicates || 0, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
          { label: 'INVALID', value: integrityStats.invalid || 0, color: 'text-rose-300', bg: 'bg-rose-950/40', border: 'border-rose-800/40' },
          { label: 'UNDER REVIEW', value: integrityStats.under_review || 0, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
          { label: 'QUARANTINED', value: integrityStats.quarantined || 0, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
        ].map((stat) => (
          <div key={stat.label} className={`p-3.5 rounded-2xl ${stat.bg} border ${stat.border} backdrop-blur-sm text-center`}>
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">{stat.label}</span>
            <span className={`text-xl font-black font-mono mt-1 block ${stat.color}`}>{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <GlassCard hoverEffect={false} className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by filename, SHA-256 checksum, or uploader..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs glass-input placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-cyan-400" /> Format:
          </div>
          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs glass-input bg-slate-900 text-slate-200"
          >
            <option value="all">All Formats</option>
            <option value=".nc">.nc (NetCDF)</option>
            <option value=".csv">.csv</option>
            <option value=".json">.json</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs glass-input bg-slate-900 text-slate-200"
          >
            <option value="all">All Statuses</option>
            <option value="unique">Unique Only</option>
            <option value="possible">Possible Duplicates</option>
            <option value="duplicate">Duplicates</option>
          </select>
        </div>
      </GlassCard>

      {/* Dataset Ledger Table (Part 25) */}
      <GlassCard hoverEffect={false} className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Filename</th>
                <th className="py-3 px-4">Format</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">SHA-256 Hash</th>
                <th className="py-3 px-4">Uploaded By</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4">Duplicate Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredDatasets.map((ds) => (
                <tr key={ds.id} className="hover:bg-slate-900/60 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-200 flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    {ds.filename}
                  </td>
                  <td className="py-3 px-4 font-mono text-cyan-400">{ds.format}</td>
                  <td className="py-3 px-4 text-slate-300 font-mono">{ds.fileSize}</td>
                  <td className="py-3 px-4 font-mono text-[10px] text-slate-400 max-w-[120px] truncate" title={ds.sha256}>
                    {ds.sha256 ? `${ds.sha256.slice(0, 16)}…` : 'Processing…'}
                  </td>
                  <td className="py-3 px-4 text-slate-300">{ds.uploadedBy}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      ds.verificationStatus === 'Verified' || ds.verificationStatus === 'VALID'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : ds.verificationStatus === 'Requires Review'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {ds.verificationStatus}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {ds.duplicateStatus === 'Possible Duplicate' || ds.duplicateStatus === 'Under Review' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 w-fit">
                        <AlertTriangle className="w-3 h-3" /> Possible Duplicate ({ds.similarityScore || 97}%)
                      </span>
                    ) : ds.duplicateStatus === 'Duplicate' || (ds.duplicateStatus as string) === 'Duplicate Found' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1 w-fit">
                        <AlertTriangle className="w-3 h-3" /> Duplicate
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        Unique
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    {/* Compare Button for Possible Duplicates */}
                    {(ds.duplicateStatus === 'Possible Duplicate' || ds.duplicateStatus === 'Under Review') && (
                      <button
                        onClick={() => handleOpenCompare(ds)}
                        className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 transition-colors"
                        title="Compare Possible Duplicate"
                      >
                        <GitCompare className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => setPreviewModalDataset(ds)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="Preview Metadata & AI Analysis"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {user?.role === 'Admin' && (
                      <button
                        onClick={() => setDeleteConfirmId(ds.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                        title="Delete Dataset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
          <span>Showing 1 to {filteredDatasets.length} of {datasets.length} entries</span>
          <div className="flex items-center gap-2">
            <button disabled className="p-1.5 rounded-lg bg-slate-800 opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 font-mono font-bold">1</span>
            <button disabled className="p-1.5 rounded-lg bg-slate-800 opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </GlassCard>

      {/* ═══════════════════════════════════════════════
          DATASET COMPARISON MODAL (PART 28)
      ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {compareModalData && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel p-6 rounded-3xl border border-amber-500/40 max-w-2xl w-full space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <GitCompare className="w-5 h-5 text-amber-400" /> Dataset Comparison (Near-Duplicate Analysis)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Calculated Similarity: <span className="font-mono font-bold text-amber-400 text-sm">{compareModalData.similarity_score}%</span>
                  </p>
                </div>
                <button onClick={() => setCompareModalData(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              {/* Side-by-side Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Dataset A */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/[0.08] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400">DATASET A (Existing)</span>
                    <span className="font-mono text-cyan-400 font-bold">{compareModalData.dataset_a.format}</span>
                  </div>
                  <h4 className="font-bold text-white text-sm truncate">{compareModalData.dataset_a.filename}</h4>
                  <div className="font-mono text-[11px] text-slate-400 space-y-1 pt-1">
                    <div>Size: {compareModalData.dataset_a.size}</div>
                    <div>Records: {compareModalData.dataset_a.record_count}</div>
                    <div>Uploader: {compareModalData.dataset_a.uploaded_by}</div>
                    <div className="truncate" title={compareModalData.dataset_a.sha256}>SHA: {compareModalData.dataset_a.sha256.slice(0, 16)}…</div>
                  </div>
                </div>

                {/* Dataset B */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-amber-400">DATASET B (New Upload)</span>
                    <span className="font-mono text-cyan-400 font-bold">{compareModalData.dataset_b.format}</span>
                  </div>
                  <h4 className="font-bold text-white text-sm truncate">{compareModalData.dataset_b.filename}</h4>
                  <div className="font-mono text-[11px] text-slate-400 space-y-1 pt-1">
                    <div>Size: {compareModalData.dataset_b.size}</div>
                    <div>Records: {compareModalData.dataset_b.record_count}</div>
                    <div>Uploader: {compareModalData.dataset_b.uploaded_by}</div>
                    <div className="truncate" title={compareModalData.dataset_b.sha256}>SHA: {compareModalData.dataset_b.sha256.slice(0, 16)}…</div>
                  </div>
                </div>
              </div>

              {/* Matching & Differences Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1.5">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-[11px]">
                    <Check className="w-3.5 h-3.5" /> Matching Elements:
                  </span>
                  <ul className="text-[11px] text-slate-300 space-y-1">
                    {compareModalData.matching_elements?.map((m: string, idx: number) => (
                      <li key={idx}>✓ {m}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5">
                  <span className="font-bold text-amber-400 flex items-center gap-1.5 text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5" /> Differences:
                  </span>
                  <ul className="text-[11px] text-slate-300 space-y-1">
                    {compareModalData.differences?.map((d: string, idx: number) => (
                      <li key={idx}>• {d}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Decision Action Buttons (Part 28 & 29) */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => handleReviewAction(compareModalData.dataset_b.id, 'keep_both')}
                  className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Keep Both
                </button>
                <button
                  onClick={() => handleReviewAction(compareModalData.dataset_b.id, 'mark_duplicate')}
                  className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
                >
                  Mark Duplicate
                </button>
                <button
                  onClick={() => handleReviewAction(compareModalData.dataset_b.id, 'reject')}
                  className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 hover:bg-rose-500/25 transition-colors"
                >
                  Reject New Upload
                </button>
                <button
                  onClick={() => handleReviewAction(compareModalData.dataset_b.id, 'approve')}
                  className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500 hover:opacity-90 transition-opacity"
                >
                  Approve
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Metadata Preview Modal */}
      <AnimatePresence>
        {previewModalDataset && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel p-6 rounded-3xl border border-cyan-500/30 max-w-lg w-full space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" /> Metadata Inspection: {previewModalDataset.filename}
                </h3>
                <button onClick={() => setPreviewModalDataset(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Latitude / Longitude</span>
                  <span className="font-mono text-cyan-400 mt-1 block">{previewModalDataset.metadata.latitude}°, {previewModalDataset.metadata.longitude}°</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Temperature</span>
                  <span className="font-mono text-cyan-400 mt-1 block">{previewModalDataset.metadata.temperature} °C</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Salinity</span>
                  <span className="font-mono text-cyan-400 mt-1 block">{previewModalDataset.metadata.salinity} PSU</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Depth</span>
                  <span className="font-mono text-cyan-400 mt-1 block">{previewModalDataset.metadata.depth} m</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[10px] space-y-1">
                <span className="text-slate-400 block font-bold uppercase">SHA-256 Checksum</span>
                <code className="text-cyan-300 break-all block">{previewModalDataset.sha256}</code>
              </div>

              {previewModalDataset.aiAnalysis && (
                <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-xs space-y-1 font-mono">
                  <span className="font-bold text-cyan-300 block">AI Verification Confidence: {previewModalDataset.aiAnalysis.confidence}%</span>
                  <div className="text-[11px] text-slate-400">
                    {previewModalDataset.aiAnalysis.reasons?.map((r: string, i: number) => (
                      <div key={i}>{r}</div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setPreviewModalDataset(null)}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700"
              >
                Close Metadata Inspector
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel p-6 rounded-3xl border border-rose-500/30 max-w-sm w-full space-y-4 text-center"
            >
              <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">Confirm Dataset Deletion?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                This action will purge dataset ID <span className="text-rose-400 font-mono">{deleteConfirmId}</span> from the repository.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-500/25"
                >
                  Delete Dataset
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
