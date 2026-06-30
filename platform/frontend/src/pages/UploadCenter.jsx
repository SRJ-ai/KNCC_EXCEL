import React, { useRef, useState, useCallback } from 'react';
import {
  UploadCloud, FileText, CheckCircle2, Loader2,
  X, ChevronRight, FileSearch, Info, AlertCircle
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import UploadPreviewModal from './UploadPreviewModal';
import './UploadCenter.css';

const DOC_TYPES = [
  { value: 'PO',  label: 'Purchase Order', desc: 'Materials ordered from a vendor',    color: '#3B82F6' },
  { value: 'INV', label: 'Invoice',         desc: 'Payment request from a vendor',       color: '#10B981' },
  { value: 'CO',  label: 'Change Order',    desc: 'Quantity / scope modification',       color: '#F59E0B' },
];

// Step indicator component
function StepBar({ step }) {
  const steps = ['Upload', 'Review', 'Done'];
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

  // Step 0 = upload form, 1 = previewing, 2 = done
  const [step, setStep]         = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);  // { name, path }
  const [docType, setDocType]   = useState('PO');
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview]   = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError]       = useState('');
  const [dragOver, setDragOver] = useState(false);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const getBackendUrl = () =>
    import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported. Please upload a PDF.');
      return;
    }
    if (!activeProject) {
      setError('No active project. Create a project first.');
      return;
    }
    setError('');
    setUploading(true);

    try {
      // ── Step 1: Upload PDF to Supabase Storage ──────────────────
      const ext = file.name.split('.').pop();
      const filePath = `${user?.id}/${Date.now()}.${ext}`;
      const { data: storageData, error: storageErr } = await supabase.storage
        .from('documents')
        .upload(filePath, file);
      if (storageErr) throw new Error(`Storage upload failed: ${storageErr.message}`);

      // ── Step 1b: Also upload to backend for parsing ─────────────
      const token = await getToken();
      const fd = new FormData();
      fd.append('files', file, file.name);
      const uploadRes = await fetch(`${getBackendUrl()}/api/upload/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      let backendAvailable = uploadRes.ok;
      let uploadResult = backendAvailable ? await uploadRes.json() : null;

      setUploadedFile({ name: file.name, storagePath: storageData?.path });
      setUploading(false);

      if (!backendAvailable) {
        // Backend unavailable — record document and skip preview
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

      // ── Step 2: Fetch preview from backend ──────────────────────
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
      setStep(1);

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

      // Save document metadata to Supabase
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
  };

  const handleReset = () => {
    setStep(0);
    setPreview(null);
    setUploadedFile(null);
    setLastResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Recent uploads display
  const displayDocs = documents.slice(0, 6);

  return (
    <div className="uc-wrap animate-fade-in">

      {/* ── Preview Modal (Step 1) ── */}
      {step === 1 && preview && (
        <UploadPreviewModal
          preview={preview}
          onConfirm={handleConfirm}
          onDiscard={handleDiscard}
          confirming={confirming}
        />
      )}

      {/* ── Header ── */}
      <div className="uc-header">
        <div>
          <h1 className="uc-title page-title">Upload Center</h1>
          <p className="uc-subtitle page-subtitle">
            Upload POs, Invoices, and Change Orders — each document is previewed and
            mapped to <strong>Client_Requirments_Doc.xlsx</strong> before saving.
          </p>
        </div>
        {step > 0 && (
          <button className="uc-reset-btn" onClick={handleReset}>
            <X size={14} /> Start Over
          </button>
        )}
      </div>

      {/* ── Step Indicator ── */}
      <StepBar step={step} />

      {/* ── Error Banner ── */}
      {error && (
        <div className="uc-error">
          <AlertCircle size={16} />
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Step 0: Upload Form ── */}
      {step === 0 && (
        <div className="uc-upload-section">

          {/* Document type selector */}
          <div className="uc-type-select">
            <p className="uc-type-label">Document Type</p>
            <div className="uc-type-grid">
              {DOC_TYPES.map(dt => (
                <button
                  key={dt.value}
                  className={`uc-type-btn ${docType === dt.value ? 'selected' : ''}`}
                  style={{ '--type-color': dt.color }}
                  onClick={() => setDocType(dt.value)}
                >
                  <span className="uc-type-code">{dt.value}</span>
                  <span className="uc-type-name">{dt.label}</span>
                  <span className="uc-type-desc">{dt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Drop zone */}
          <div
            className={`uc-drop-zone ${dragOver ? 'drag-over' : ''} ${uploading || previewing ? 'loading' : ''}`}
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
            <div className="uc-drop-icon">
              {uploading || previewing
                ? <Loader2 size={40} className="animate-spin" color="#3B82F6" />
                : <UploadCloud size={40} color="#3B82F6" />
              }
            </div>
            <h3 className="uc-drop-title">
              {uploading ? 'Uploading document...' : previewing ? 'Analyzing and mapping to Excel...' : 'Drop a PDF here or click to browse'}
            </h3>
            <p className="uc-drop-desc">
              {previewing
                ? 'Matching line items to Client_Requirments_Doc.xlsx rows...'
                : `PDF only · max 50MB · will be classified as ${docType}`}
            </p>
            {!uploading && !previewing && (
              <button className="uc-browse-btn" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                Browse Files <ChevronRight size={14} />
              </button>
            )}
          </div>

          {isDemoMode && (
            <div className="uc-demo-note">
              <Info size={14} />
              Demo mode — uploads go to backend for parsing but data won't persist to Supabase.
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

      {/* ── Recent Uploads ── */}
      {displayDocs.length > 0 && step === 0 && (
        <div className="uc-recent animate-fade-in">
          <h3 className="uc-recent-title">
            <FileSearch size={16} />
            Recent Uploads
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
