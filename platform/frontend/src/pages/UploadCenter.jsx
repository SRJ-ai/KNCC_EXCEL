import React, { useRef, useState, useCallback } from 'react';
import {
  UploadCloud, FileText, CheckCircle2, Loader2,
  X, ChevronRight, FileSearch, Info, AlertCircle
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import UploadPreviewPage from './UploadPreviewPage';
import './UploadCenter.css';

const DOC_TYPES = [
  { value: 'PO',  label: 'Purchase Order', desc: 'Materials ordered from a vendor',    color: '#3B82F6' },
  { value: 'INV', label: 'Invoice',         desc: 'Payment request from a vendor',       color: '#10B981' },
  { value: 'CO',  label: 'Change Order',    desc: 'Quantity / scope modification',       color: '#F59E0B' },
];

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

export default function UploadCenter() {
  const { documents, addDocument, activeProject, isDemoMode } = usePlatform();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  // step 0 = upload form, 1 = full-page preview, 2 = done
  const [step, setStep]           = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [docType, setDocType]     = useState('PO');
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview]     = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError]         = useState('');
  const [dragOver, setDragOver]   = useState(false);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const getBackendUrl = () => 'https://kncc-backend.onrender.com';

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.');
      return;
    }
    if (!activeProject) {
      setError('No active project. Create or select a project first.');
      return;
    }
    setError('');
    setUploading(true);

    try {
      // ── Upload PDF to Supabase Storage ──────────────────────────
      const ext = file.name.split('.').pop();
      const filePath = `${user?.id || 'anon'}/${Date.now()}.${ext}`;
      const { data: storageData, error: storageErr } = await supabase.storage
        .from('documents')
        .upload(filePath, file);
      if (storageErr) throw new Error(`Storage upload failed: ${storageErr.message}`);

      // ── Also upload to backend for PDF parsing ───────────────────
      const token = await getToken();
      const fd = new FormData();
      fd.append('files', file, file.name);
      const uploadRes = await fetch(`${getBackendUrl()}/api/upload/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      setUploadedFile({ name: file.name, storagePath: storageData?.path });
      setUploading(false);

      if (!uploadRes.ok) {
        // Backend offline — record doc and skip to done
        await addDocument({
          file_name: file.name,
          file_path: storageData.path,
          size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
          type: 'pdf',
          uploader: user?.email || 'Unknown',
        });
        setLastResult({ message: 'Document uploaded (preview unavailable — backend offline)', line_items_parsed: 0 });
        setStep(2);
        return;
      }

      // ── Fetch full preview ───────────────────────────────────────
      setPreviewing(true);
      const previewFd = new FormData();
      previewFd.append('filename', file.name);
      previewFd.append('doc_type', docType);
      previewFd.append('project_id', activeProject.id);

      const previewRes = await fetch(`${getBackendUrl()}/api/upload/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: previewFd,
      });

      if (!previewRes.ok) {
        const err = await previewRes.json().catch(() => ({}));
        throw new Error(err.detail || 'Preview failed');
      }

      const previewData = await previewRes.json();
      setPreview(previewData);
      setStep(1); // → full page preview

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setPreviewing(false);
    }
  }, [activeProject, user, docType, addDocument]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleConfirm = async () => {
    if (!preview || !uploadedFile || !activeProject) return;
    setConfirming(true);
    try {
      const token = await getToken();
      const fd = new FormData();
      fd.append('filename', uploadedFile.name);
      fd.append('doc_type', docType);
      fd.append('project_id', activeProject.id);

      const res = await fetch(`${getBackendUrl()}/api/upload/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Confirm failed');
      }

      const result = await res.json();

      if (uploadedFile.storagePath) {
        await addDocument({
          file_name: uploadedFile.name,
          file_path: uploadedFile.storagePath,
          size: '',
          type: 'pdf',
          uploader: user?.email || 'Unknown',
        });
      }

      setLastResult(result);
      setPreview(null);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to apply changes.');
    } finally {
      setConfirming(false);
    }
  };

  const handleDiscard = () => {
    setPreview(null);
    setUploadedFile(null);
    setStep(0);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReset = () => {
    setStep(0);
    setPreview(null);
    setUploadedFile(null);
    setLastResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Step 1: Full-page preview replaces the whole view ──────────
  if (step === 1 && preview) {
    return (
      <UploadPreviewPage
        preview={preview}
        onConfirm={handleConfirm}
        onDiscard={handleDiscard}
        confirming={confirming}
      />
    );
  }

  // ── Step 0 / 2: Upload form or success ─────────────────────────
  const displayDocs = documents.slice(0, 6);

  return (
    <div className="uc-wrap animate-fade-in">

      {/* Header */}
      <div className="uc-header">
        <div>
          <h1 className="uc-title page-title">Upload Center</h1>
          <p className="uc-subtitle page-subtitle">
            Upload POs, Invoices, and Change Orders — each is previewed and mapped to{' '}
            <strong>Client_Requirments_Doc.xlsx</strong> on a full review page before saving.
          </p>
        </div>
        {step > 0 && (
          <button className="uc-reset-btn" onClick={handleReset}>
            <X size={14} /> Start Over
          </button>
        )}
      </div>

      {/* Step bar */}
      <StepBar step={step} />

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
                  onClick={() => setDocType(dt.value)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="uc-type-code" style={{ background: `color-mix(in srgb, ${dt.color} 20%, transparent)`, color: dt.color, padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                      {dt.value}
                    </span>
                    <span className="uc-type-name" style={{ fontWeight: 600, color: '#f4f4f5' }}>{dt.label}</span>
                  </div>
                  <span className="uc-type-desc" style={{ fontSize: '0.75rem', color: '#71717a' }}>{dt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* What will happen preview */}
          <div className="uc-preview-hint glass-panel" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
            {docType === 'PO' && <span>📦 <strong>Smart Parsing:</strong> After upload, you'll review all extracted materials and see exactly how they map to your project requirements.</span>}
            {docType === 'INV' && <span>🔍 <strong>AI Matching:</strong> After upload, we'll auto-match invoice lines to your POs and highlight any unapproved variances or missing entries.</span>}
            {docType === 'CO' && <span>📊 <strong>Automated Adjustments:</strong> After upload, you'll preview +/- quantity changes mapped directly to your Master Excel sheet.</span>}
          </div>

          {/* Drop zone */}
          <div
            className={`uc-drop-zone glass-card ${dragOver ? 'drag-over' : ''} ${uploading || previewing ? 'loading' : ''}`}
            style={{ 
              padding: '4rem 2rem', 
              textAlign: 'center', 
              border: dragOver ? '2px dashed var(--accent-blue)' : '2px dashed var(--border-color)',
              background: dragOver ? 'var(--accent-blue-glow)' : 'var(--bg-surface)',
              cursor: (uploading || previewing) ? 'wait' : 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem'
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && !previewing && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files?.[0])}
            />
            
            <div className="uc-drop-icon" style={{ 
              width: '64px', height: '64px', 
              borderRadius: '50%', 
              background: 'rgba(59, 130, 246, 0.1)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)'
            }}>
              {uploading || previewing
                ? <Loader2 size={32} className="animate-spin" color="#3B82F6" />
                : <UploadCloud size={32} color="#3B82F6" />
              }
            </div>

            <div>
              <h3 className="uc-drop-title" style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#f4f4f5' }}>
                {uploading ? 'Uploading securely...'
                  : previewing ? 'AI is analyzing & mapping...'
                  : 'Drag & drop your PDF'}
              </h3>
              <p className="uc-drop-desc" style={{ color: '#a1a1aa', margin: 0, fontSize: '0.9rem' }}>
                {previewing
                  ? 'Extracting line items and cross-referencing Master Excel... (~5s)'
                  : 'or click to browse from your computer'}
              </p>
            </div>

            {previewing && (
              <div style={{ width: '60%', height: '4px', background: '#1c1c1e', borderRadius: '4px', overflow: 'hidden', marginTop: '1rem' }}>
                <div style={{ width: '100%', height: '100%', background: 'var(--accent-blue)', animation: 'progressIndeterminate 1.5s infinite ease-in-out', transformOrigin: '0% 50%' }} />
              </div>
            )}
          </div>
          <style>{`@keyframes progressIndeterminate { 0% { transform: scaleX(0); transform-origin: 0% 50%; } 50% { transform: scaleX(1); transform-origin: 0% 50%; } 50.1% { transform: scaleX(1); transform-origin: 100% 50%; } 100% { transform: scaleX(0); transform-origin: 100% 50%; } }`}</style>

          {isDemoMode && (
            <div className="uc-demo-note" style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', marginTop: '1rem', color: '#71717a', fontSize: '0.8rem' }}>
              <Info size={14} /> Demo mode active
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Success ── */}
      {step === 2 && lastResult && (
        <div className="uc-success animate-fade-in">
          <div className="uc-success-icon">
            <CheckCircle2 size={48} color="#10B981" />
          </div>
          <h2 className="uc-success-title">Changes Applied!</h2>
          <p className="uc-success-msg">{lastResult.message}</p>
          {lastResult.line_items_parsed > 0 && (
            <p className="uc-success-detail">
              {lastResult.line_items_parsed} line items processed
              {lastResult.doc_number ? ` · Doc #${lastResult.doc_number}` : ''}
            </p>
          )}
          <div className="uc-success-actions">
            <button className="uc-success-btn" onClick={handleReset}>
              Upload Another Document
            </button>
            <a href="/grid" className="uc-success-link">
              View Material Grid <ChevronRight size={14} />
            </a>
          </div>
        </div>
      )}

      {/* Recent uploads */}
      {displayDocs.length > 0 && step === 0 && (
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
