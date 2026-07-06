import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  UploadCloud, FileText, CheckCircle2, Loader2,
  X, ChevronRight, FileSearch, Info, AlertCircle,
  Files, Clock, XCircle, PlayCircle
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import UploadPreviewPage from './UploadPreviewPage';
import './UploadCenter.css';

const DOC_TYPES = [
  { value: 'PO',  label: 'Purchase Order', desc: 'Materials ordered from a vendor',    color: '#3B82F6', batch: false },
  { value: 'INV', label: 'Invoice',         desc: 'Payment request — supports batch upload', color: '#10B981', batch: true },
  { value: 'CO',  label: 'Change Order',    desc: 'Quantity / scope modification — supports batch upload', color: '#F59E0B', batch: true },
];

// Per-file status in a batch queue
const STATUS = { WAITING: 'waiting', PROCESSING: 'processing', DONE: 'done', ERROR: 'error', SKIPPED: 'skipped' };

function StepBar({ step }) {
  const steps = ['Upload', 'Review Changes', 'Done'];
  return (
    <div className="uc-stepbar">
      {steps.map((label, i) => (
        <React.Fragment key={i}>
          <div className={`uc-step ${step > i ? 'done' : step === i ? 'active' : 'idle'}`}>
            <span className="uc-step-num">{step > i ? '✓' : i + 1}</span>
            <span className="uc-step-label">{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`uc-step-line ${step > i ? 'done' : ''}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function BatchQueueItem({ item }) {
  const colorMap = {
    [STATUS.WAITING]:    { color: '#71717a',  icon: <Clock size={14} /> },
    [STATUS.PROCESSING]: { color: '#3B82F6',  icon: <Loader2 size={14} className="animate-spin" /> },
    [STATUS.DONE]:       { color: '#10B981',  icon: <CheckCircle2 size={14} /> },
    [STATUS.ERROR]:      { color: '#EF4444',  icon: <XCircle size={14} /> },
    [STATUS.SKIPPED]:    { color: '#F59E0B',  icon: <AlertCircle size={14} /> },
  };
  const { color, icon } = colorMap[item.status] || colorMap[STATUS.WAITING];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '10px 14px', borderRadius: '8px',
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${color}33`,
      marginBottom: '6px',
    }}>
      <span style={{ color }}>{icon}</span>
      <span style={{ flex: 1, fontSize: '0.85rem', color: '#e4e4e7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
      {item.status === STATUS.DONE && item.result && (
        <span style={{ fontSize: '0.75rem', color: '#10B981', whiteSpace: 'nowrap' }}>
          {item.result.line_items_parsed} items · #{item.result.doc_number || '–'}
        </span>
      )}
      {item.status === STATUS.ERROR && (
        <span style={{ fontSize: '0.75rem', color: '#EF4444', maxWidth: '180px', textAlign: 'right' }}>{item.error}</span>
      )}
      {item.status === STATUS.SKIPPED && (
        <span style={{ fontSize: '0.75rem', color: '#F59E0B' }}>Duplicate</span>
      )}
      {item.status === STATUS.WAITING && (
        <span style={{ fontSize: '0.75rem', color: '#52525b' }}>Queued</span>
      )}
    </div>
  );
}

export default function UploadCenter() {
  const { documents, addDocument, activeProject, refreshProjectData } = usePlatform();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const batchInputRef = useRef(null);

  // Single-file PO state
  const [step, setStep]               = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [docType, setDocType]         = useState('PO');
  const [uploading, setUploading]     = useState(false);
  const [previewing, setPreviewing]   = useState(false);
  const [preview, setPreview]         = useState(null);
  const [confirming, setConfirming]   = useState(false);
  const [lastResult, setLastResult]   = useState(null);
  const [error, setError]             = useState('');
  const [dragOver, setDragOver]       = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Batch state (INV / CO)
  const [batchQueue, setBatchQueue]   = useState([]); // [{id, name, file, status, result, error}]
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchDone, setBatchDone]     = useState(false);

  const [rehydratedProjId, setRehydratedProjId] = useState(null);
  const skipSaveRef = useRef(false);
  const isBatchType = DOC_TYPES.find(d => d.value === docType)?.batch;

  const safeParse = (val, fallback) => {
    if (val === null) return fallback;
    try { return JSON.parse(val); } catch { return fallback; }
  };

  const clearCachedStates = useCallback((projectId) => {
    if (!projectId) return;
    ['step','docType','uploadedFile','preview','lastResult'].forEach(k =>
      localStorage.removeItem(`kncc_upload_${projectId}_${k}`)
    );
  }, []);

  useEffect(() => {
    if (!activeProject?.id) { setRehydratedProjId(null); return; }
    const pid = activeProject.id;
    try {
      skipSaveRef.current = true;
      setStep(safeParse(localStorage.getItem(`kncc_upload_${pid}_step`), 0));
      setDocType(safeParse(localStorage.getItem(`kncc_upload_${pid}_docType`), 'PO'));
      setUploadedFile(safeParse(localStorage.getItem(`kncc_upload_${pid}_uploadedFile`), null));
      setPreview(safeParse(localStorage.getItem(`kncc_upload_${pid}_preview`), null));
      setLastResult(safeParse(localStorage.getItem(`kncc_upload_${pid}_lastResult`), null));
    } catch (e) { console.error('Rehydrate error:', e); }
    setRehydratedProjId(pid);
  }, [activeProject?.id]);

  useEffect(() => {
    if (!activeProject?.id || rehydratedProjId !== activeProject.id) return;
    if (skipSaveRef.current) { skipSaveRef.current = false; return; }
    const pid = activeProject.id;
    try {
      localStorage.setItem(`kncc_upload_${pid}_step`, JSON.stringify(step));
      localStorage.setItem(`kncc_upload_${pid}_docType`, JSON.stringify(docType));
      localStorage.setItem(`kncc_upload_${pid}_uploadedFile`, JSON.stringify(uploadedFile));
      localStorage.setItem(`kncc_upload_${pid}_preview`, JSON.stringify(preview));
      localStorage.setItem(`kncc_upload_${pid}_lastResult`, JSON.stringify(lastResult));
    } catch (e) { console.error('Cache error:', e); }
  }, [step, docType, uploadedFile, preview, lastResult, activeProject?.id, rehydratedProjId]);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Your session has expired. Please log out and log back in.');
    return session.access_token;
  };

  const getBackendUrl = () =>
    (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')).replace(/\/$/, '');

  // ─── SINGLE FILE (PO) HANDLER ────────────────────────────────
  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) { setError('Only PDF files are supported.'); return; }
    if (!activeProject) { setError('No active project. Create or select a project first.'); return; }
    setError('');
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user?.id || 'anon'}/${Date.now()}.${ext}`;
      const { data: storageData, error: storageErr } = await supabase.storage.from('documents').upload(filePath, file);
      if (storageErr) throw new Error(`Storage upload failed: ${storageErr.message}`);
      const token = await getToken();
      setUploadedFile({ name: file.name, storagePath: storageData?.path, fileObj: file });
      setUploading(false);
      setPreviewing(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('doc_type', docType);
      fd.append('project_id', activeProject.id);
      const previewData = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${getBackendUrl()}/api/upload/preview`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)); }
            catch { reject(new Error('Invalid response')); }
          } else {
            try { const err = JSON.parse(xhr.responseText); reject(new Error(err.detail || 'Preview failed')); }
            catch { reject(new Error('Preview failed')); }
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(fd);
      });
      setUploadProgress(0);
      setPreview(previewData);
      setStep(1);
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally { setUploading(false); setPreviewing(false); }
  }, [activeProject, user, docType]);

  // ─── BATCH HANDLER (INV / CO) ────────────────────────────────
  const handleBatchFiles = useCallback((files) => {
    if (!files || files.length === 0) return;
    if (!activeProject) { setError('No active project. Create or select a project first.'); return; }
    setError('');
    const pdfs = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) { setError('Only PDF files are supported.'); return; }
    const newItems = pdfs.map((f, i) => ({
      id: `${Date.now()}-${i}`,
      name: f.name,
      file: f,
      status: STATUS.WAITING,
      result: null,
      error: null,
    }));
    setBatchQueue(prev => [...prev, ...newItems]);
    setBatchDone(false);
  }, [activeProject]);

  const batchQueueRef = useRef([]);
  useEffect(() => { batchQueueRef.current = batchQueue; }, [batchQueue]);

  const runBatch = useCallback(async () => {
    if (batchRunning) return;
    setBatchRunning(true);
    setBatchDone(false);
    setError('');

    const token = await getToken().catch(e => { setError(e.message); setBatchRunning(false); return null; });
    if (!token) return;

    const snapshot = batchQueueRef.current.filter(q => q.status === STATUS.WAITING);

    for (let i = 0; i < snapshot.length; i++) {
      const item = snapshot[i];

      setBatchQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: STATUS.PROCESSING } : q));

      try {
        const ext = item.file.name.split('.').pop();
        const filePath = `${user?.id || 'anon'}/${Date.now()}-${i}.${ext}`;
        const { data: storageData } = await supabase.storage.from('documents').upload(filePath, item.file);

        const fd = new FormData();
        fd.append('file', item.file);
        fd.append('doc_type', docType);
        fd.append('project_id', activeProject.id);

        const res = await fetch(`${getBackendUrl()}/api/upload/confirm`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const detail = err.detail || 'Upload failed';
          const newStatus = res.status === 409 ? STATUS.SKIPPED : STATUS.ERROR;
          setBatchQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: newStatus, error: detail } : q));
          continue;
        }

        const result = await res.json();
        if (storageData?.path) {
          await addDocument({ file_name: item.file.name, file_path: storageData.path, size: '', type: 'pdf', uploader: user?.email || 'Unknown' });
        }
        setBatchQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: STATUS.DONE, result } : q));
      } catch (err) {
        setBatchQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: STATUS.ERROR, error: err.message } : q));
      }
    }

    if (refreshProjectData) await refreshProjectData();
    setBatchRunning(false);
    setBatchDone(true);
  }, [batchRunning, activeProject, user, docType, addDocument, refreshProjectData]);


  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (isBatchType) {
      handleBatchFiles(e.dataTransfer.files);
    } else {
      handleFile(e.dataTransfer.files?.[0]);
    }
  };

  const handleConfirm = async () => {
    if (!preview || !uploadedFile || !activeProject) return;
    if (!uploadedFile.fileObj) {
      alert('File data was lost due to page refresh. Please click "Discard Changes" and re-upload.');
      return;
    }
    setConfirming(true);
    try {
      const token = await getToken();
      const fd = new FormData();
      fd.append('file', uploadedFile.fileObj);
      fd.append('doc_type', docType);
      fd.append('project_id', activeProject.id);
      const res = await fetch(`${getBackendUrl()}/api/upload/confirm`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Confirm failed'); }
      const result = await res.json();
      if (uploadedFile.storagePath) {
        await addDocument({ file_name: uploadedFile.name, file_path: uploadedFile.storagePath, size: '', type: 'pdf', uploader: user?.email || 'Unknown' });
      }
      if (activeProject?.id) { clearCachedStates(activeProject.id); if (refreshProjectData) await refreshProjectData(); }
      skipSaveRef.current = true;
      setLastResult(result); setPreview(null); setStep(2);
      setTimeout(() => navigate('/grid'), 2000);
    } catch (err) {
      setError(err.message || 'Failed to apply changes.');
    } finally { setConfirming(false); }
  };

  const handleDiscard = () => {
    if (activeProject?.id) clearCachedStates(activeProject.id);
    skipSaveRef.current = true;
    setPreview(null); setUploadedFile(null); setStep(0); setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReset = () => {
    if (activeProject?.id) clearCachedStates(activeProject.id);
    skipSaveRef.current = true;
    setStep(0); setPreview(null); setUploadedFile(null); setLastResult(null); setError('');
    setBatchQueue([]); setBatchDone(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (batchInputRef.current) batchInputRef.current.value = '';
  };

  const removeBatchItem = (id) => {
    setBatchQueue(prev => prev.filter(q => q.id !== id));
  };

  const clearDoneItems = () => {
    setBatchQueue(prev => prev.filter(q => q.status === STATUS.WAITING));
  };

  // Derived batch stats
  const batchWaiting    = batchQueue.filter(q => q.status === STATUS.WAITING).length;
  const batchProcessing = batchQueue.filter(q => q.status === STATUS.PROCESSING).length;
  const batchCompleted  = batchQueue.filter(q => q.status === STATUS.DONE).length;
  const batchErrors     = batchQueue.filter(q => q.status === STATUS.ERROR || q.status === STATUS.SKIPPED).length;
  const batchHasItems   = batchQueue.length > 0;
  const batchCanRun     = batchWaiting > 0 && !batchRunning;

  // ── Step 1: Full-page preview (PO only)
  if (step === 1 && preview) {
    return (
      <UploadPreviewPage
        preview={preview}
        onConfirm={handleConfirm}
        onDiscard={handleDiscard}
        confirming={confirming}
        error={error}
      />
    );
  }

  const displayDocs = documents.slice(0, 6);

  return (
    <div className="uc-wrap animate-fade-in">

      {/* Header */}
      <div className="uc-header">
        <div>
          <h1 className="uc-title page-title">Upload Center</h1>
          <p className="uc-subtitle page-subtitle">
            Upload POs, Invoices, and Change Orders.{' '}
            <strong>Invoices and COs support batch upload</strong> — drop multiple files at once.
          </p>
        </div>
        {(step > 0 || batchHasItems) && (
          <button className="uc-reset-btn" onClick={handleReset}>
            <X size={14} /> Start Over
          </button>
        )}
      </div>

      {/* Step bar (only for PO flow) */}
      {!isBatchType && <StepBar step={step} />}

      {/* Error banner */}
      {error && (
        <div className="uc-error">
          <AlertCircle size={16} />
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Step 0: Upload form ── */}
      {step === 0 && (
        <div className="uc-upload-section animate-slide-up">
          {/* Doc type selector */}
          <div className="uc-type-select">
            <p className="uc-type-label" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a1a1aa', fontWeight: 600 }}>
              Select Document Type
            </p>
            <div className="uc-type-grid">
              {DOC_TYPES.map(dt => (
                <button
                  key={dt.value}
                  className={`uc-type-btn glass-card ${docType === dt.value ? 'selected' : ''}`}
                  style={{ '--type-color': dt.color, padding: '1rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}
                  onClick={() => { setDocType(dt.value); setBatchQueue([]); setBatchDone(false); }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="uc-type-code" style={{ background: `color-mix(in srgb, ${dt.color} 20%, transparent)`, color: dt.color, padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                      {dt.value}
                    </span>
                    <span className="uc-type-name" style={{ fontWeight: 600, color: '#f4f4f5' }}>{dt.label}</span>
                    {dt.batch && (
                      <span style={{ marginLeft: 'auto', fontSize: '0.65rem', background: 'rgba(16,185,129,0.15)', color: '#10B981', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                        BATCH
                      </span>
                    )}
                  </div>
                  <span className="uc-type-desc" style={{ fontSize: '0.75rem', color: '#71717a' }}>{dt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Hint bar */}
          <div className="uc-preview-hint glass-panel" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
            {docType === 'PO'  && <span>📦 <strong>Smart Parsing:</strong> After upload, you'll review all extracted materials and see exactly how they map to your project requirements.</span>}
            {docType === 'INV' && <span>🔍 <strong>Batch Mode:</strong> Drop multiple invoice PDFs. Each is processed sequentially — duplicates are automatically skipped.</span>}
            {docType === 'CO'  && <span>📊 <strong>Batch Mode:</strong> Drop multiple Change Order PDFs. All quantity adjustments are applied directly without a manual review step.</span>}
          </div>

          {/* ── Drop zone ── */}
          <div
            className={`uc-drop-zone glass-card ${dragOver ? 'drag-over' : ''} ${(uploading || previewing) ? 'loading' : ''}`}
            style={{
              padding: isBatchType ? '2.5rem 2rem' : '4rem 2rem',
              textAlign: 'center',
              border: dragOver ? '2px dashed var(--accent-blue)' : '2px dashed var(--border-color)',
              background: dragOver ? 'var(--accent-blue-glow)' : 'var(--bg-surface)',
              cursor: (uploading || previewing) ? 'wait' : 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => {
              if (uploading || previewing) return;
              if (isBatchType) batchInputRef.current?.click();
              else fileInputRef.current?.click();
            }}
          >
            {/* Single-file input (PO) */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files?.[0])}
            />
            {/* Multi-file input (INV / CO) */}
            <input
              ref={batchInputRef}
              type="file"
              accept=".pdf"
              multiple
              style={{ display: 'none' }}
              onChange={e => handleBatchFiles(e.target.files)}
            />

            <div className="uc-drop-icon" style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)',
            }}>
              {uploading || previewing
                ? <Loader2 size={32} className="animate-spin" color="#3B82F6" />
                : isBatchType
                  ? <Files size={32} color="#3B82F6" />
                  : <UploadCloud size={32} color="#3B82F6" />
              }
            </div>

            <div>
              <h3 className="uc-drop-title" style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#f4f4f5' }}>
                {uploading ? 'Uploading securely...'
                  : previewing && uploadProgress > 0 ? `Uploading... ${uploadProgress}%`
                  : previewing ? 'Analyzing your document...'
                  : isBatchType ? 'Drag & drop multiple PDFs here'
                  : 'Drag & drop your PDF'}
              </h3>
              <p className="uc-drop-desc" style={{ color: '#a1a1aa', margin: 0, fontSize: '0.9rem' }}>
                {previewing ? 'Extracting line items...'
                  : isBatchType ? 'or click to select files — all selected PDFs will be added to the queue'
                  : 'or click to browse from your computer'}
              </p>
            </div>

            {previewing && uploadProgress > 0 && (
              <div style={{ width: '60%', height: '4px', background: '#1c1c1e', borderRadius: '4px', overflow: 'hidden', marginTop: '1rem' }}>
                <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--accent-blue)', transition: 'width 0.2s ease' }} />
              </div>
            )}
            {previewing && uploadProgress === 0 && (
              <div style={{ width: '60%', height: '4px', background: '#1c1c1e', borderRadius: '4px', overflow: 'hidden', marginTop: '1rem' }}>
                <div style={{ width: '100%', height: '100%', background: 'var(--accent-blue)', animation: 'progressIndeterminate 1.5s infinite ease-in-out', transformOrigin: '0% 50%' }} />
              </div>
            )}
          </div>
          <style>{`@keyframes progressIndeterminate { 0% { transform: scaleX(0); transform-origin: 0% 50%; } 50% { transform: scaleX(1); transform-origin: 0% 50%; } 50.1% { transform: scaleX(1); transform-origin: 100% 50%; } 100% { transform: scaleX(0); transform-origin: 100% 50%; } }`}</style>

          {/* ── Batch Queue Panel ── */}
          {isBatchType && batchHasItems && (
            <div className="glass-card" style={{ marginTop: '1.5rem', padding: '1.25rem', borderRadius: '12px' }}>
              {/* Queue header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Files size={16} color="#3B82F6" />
                  <span style={{ fontWeight: 700, color: '#f4f4f5', fontSize: '0.95rem' }}>
                    Upload Queue
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#71717a' }}>
                    {batchQueue.length} file{batchQueue.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {batchDone && batchCompleted > 0 && (
                    <button
                      onClick={clearDoneItems}
                      style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid #3f3f46', color: '#a1a1aa', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      Clear Completed
                    </button>
                  )}
                  <button
                    onClick={runBatch}
                    disabled={!batchCanRun}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      fontSize: '0.85rem', fontWeight: 700,
                      background: batchCanRun ? 'linear-gradient(135deg, #3B82F6, #2563EB)' : 'rgba(255,255,255,0.05)',
                      border: 'none', color: batchCanRun ? '#fff' : '#52525b',
                      padding: '8px 16px', borderRadius: '8px', cursor: batchCanRun ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s',
                    }}
                  >
                    {batchRunning
                      ? <><Loader2 size={14} className="animate-spin" /> Processing...</>
                      : <><PlayCircle size={14} /> Process {batchWaiting} File{batchWaiting !== 1 ? 's' : ''}</>
                    }
                  </button>
                </div>
              </div>

              {/* Progress summary */}
              {(batchRunning || batchDone) && (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '1rem', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: '#10B981' }}>✓ {batchCompleted} done</span>
                  {batchErrors > 0 && <span style={{ fontSize: '0.8rem', color: '#EF4444' }}>✗ {batchErrors} failed</span>}
                  {batchWaiting > 0 && <span style={{ fontSize: '0.8rem', color: '#71717a' }}>⧖ {batchWaiting} waiting</span>}
                  {batchDone && batchErrors === 0 && <span style={{ fontSize: '0.8rem', color: '#10B981', marginLeft: 'auto', fontWeight: 600 }}>All files processed!</span>}
                </div>
              )}

              {/* File list */}
              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                {batchQueue.map(item => (
                  <div key={item.id} style={{ position: 'relative' }}>
                    <BatchQueueItem item={item} />
                    {item.status === STATUS.WAITING && (
                      <button
                        onClick={() => removeBatchItem(item.id)}
                        style={{
                          position: 'absolute', top: '50%', right: '10px', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', color: '#52525b', cursor: 'pointer', padding: '2px',
                        }}
                        title="Remove"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Done action */}
              {batchDone && (
                <div style={{ marginTop: '1rem', display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => { setBatchQueue([]); setBatchDone(false); }}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid #3f3f46', color: '#a1a1aa', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Upload More Files
                  </button>
                  <button
                    onClick={() => navigate('/grid')}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                  >
                    View Material Grid →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: PO Success ── */}
      {step === 2 && lastResult && (
        <div className="uc-success animate-fade-in">
          <div className="uc-success-icon">
            <CheckCircle2 size={48} color="#10B981" />
          </div>
          <h2 className="uc-success-title">Changes Applied!</h2>
          <p className="uc-success-msg">{lastResult.message}</p>
          <p className="uc-success-msg" style={{ color: '#10B981', marginTop: '8px', fontSize: '14px' }}>
            Redirecting to Material Grid...
          </p>
          {lastResult.line_items_parsed > 0 && (
            <p className="uc-success-detail">
              {lastResult.line_items_parsed} line items processed
              {lastResult.doc_number ? ` · Doc #${lastResult.doc_number}` : ''}
            </p>
          )}
          <div className="uc-success-actions">
            <button className="uc-success-btn" onClick={handleReset}>Upload Another Document</button>
          </div>
        </div>
      )}

      {/* Recent uploads */}
      {displayDocs.length > 0 && step === 0 && !batchHasItems && (
        <div className="uc-recent animate-fade-in">
          <h3 className="uc-recent-title">
            <FileSearch size={16} /> Recent Uploads
          </h3>
          <div className="uc-recent-list">
            {displayDocs.map((file, i) => (
              <div key={file.id || i} className="uc-recent-item">
                <div className="uc-recent-icon">
                  <FileText size={16} color="#3B82F6" />
                </div>
                <div className="uc-recent-info">
                  <span className="uc-recent-name">{file.file_name || file.name}</span>
                  <span className="uc-recent-meta">
                    {file.size && `${file.size} · `}
                    {file.created_at ? new Date(file.created_at).toLocaleDateString() : 'Just now'}
                  </span>
                </div>
                <CheckCircle2 size={15} color="#10B981" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
