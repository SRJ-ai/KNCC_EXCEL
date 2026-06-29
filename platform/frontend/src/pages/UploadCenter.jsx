import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, FileSpreadsheet, CheckCircle2, Loader2 } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import './UploadCenter.css';

export default function UploadCenter() {
  const { documents, addDocument } = usePlatform();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  // Fallback to initial mock data if no documents exist in state yet
  const displayDocs = documents.length > 0 ? documents : [
    { id: 1, file_name: 'Structural_Plans_v2.pdf', size: '14.2 MB', type: 'pdf', created_at: new Date().toISOString() }
  ];

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      // 1. Upload to Supabase Storage Bucket
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (error) {
        throw error;
      }

      // 2. Save metadata to Postgres via Context
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const type = isPdf ? 'pdf' : 'excel';
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      
      await addDocument({
        file_name: file.name,
        file_path: data.path,
        size: `${sizeMB} MB`,
        type: type,
        uploader: user?.email || 'Unknown'
      });
      
    } catch (error) {
      console.error('Error uploading file:', error.message);
      alert('Upload failed! Make sure the "documents" bucket exists and is public.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-container">
      <div className="upload-header">
        <h1 className="upload-title">Upload Center</h1>
        <p className="upload-subtitle">Drag and drop construction plans, Excel data, or specifications.</p>
      </div>

      <div className="drop-zone" onClick={() => fileInputRef.current?.click()}>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileUpload}
          accept=".pdf,.xlsx,.csv,.dwg"
        />
        <UploadCloud size={64} className="drop-icon" />
        <h3 className="drop-title">{uploading ? 'Uploading to cloud...' : 'Select a file or drag and drop here'}</h3>
        <p className="drop-desc">PDF, XLSX, CSV, or DWG, file size no more than 50MB</p>
        <button disabled={uploading} className="browse-btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
          {uploading ? <Loader2 size={18} className="animate-spin" /> : 'Browse Files'}
        </button>
      </div>

      <h3 className="recent-uploads-title">Recent Uploads</h3>
      <div className="upload-list">
        {displayDocs.map(file => (
          <div key={file.id} className="upload-item">
            <div className="upload-info">
              <div className={`file-icon ${file.type === 'pdf' ? 'file-pdf' : 'file-excel'}`}>
                {file.type === 'pdf' ? <FileText size={24} /> : <FileSpreadsheet size={24} />}
              </div>
              <div className="file-details">
                <h4>{file.file_name || file.name}</h4>
                <p>{file.size} • {new Date(file.created_at || file.date).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="upload-status">
              <CheckCircle2 size={18} /> Processed
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
