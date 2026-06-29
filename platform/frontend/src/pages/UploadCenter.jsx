import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, FileSpreadsheet, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { parseMatheusDocument } from '../utils/pdfParser';
import './UploadCenter.css';

export default function UploadCenter() {
  const { documents, addDocument, addPO, addInvoice, addCO, addMaterial, activeProject } = usePlatform();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);

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
      
      // 3. Scan the document to populate POs, Invoices, COs automatically
      setParsing(true);
      setUploading(false); // Switch UI to parsing state

      try {
        const parsed = await parseMatheusDocument(file, activeProject?.id || 'demo');
        console.log("Document Parsed!", parsed);
        
        if (parsed.type === 'PO') {
          await addPO(parsed.metadata);
          
          // Insert materials
          if (parsed.materials && parsed.materials.length > 0) {
            for (const item of parsed.materials) {
              await addMaterial(item);
            }
          }
        } else if (parsed.type === 'INVOICE') {
          await addInvoice(parsed.metadata);
          if (parsed.materials && parsed.materials.length > 0) {
            for (const item of parsed.materials) {
              await addMaterial(item);
            }
          }
        } else if (parsed.type === 'CO') {
          await addCO(parsed.metadata);
          if (parsed.materials && parsed.materials.length > 0) {
            for (const item of parsed.materials) {
              await addMaterial(item);
            }
          }
        }
        alert(`Successfully parsed ${parsed.type} for ${parsed.metadata.supplier || 'Vendor'}! Check your Dashboard.`);
      } catch (scanErr) {
        console.error("Scan failed:", scanErr);
        alert('Could not extract text from document. Ensure it is a valid PDF.');
      }
      
    } catch (error) {
      console.error('Error uploading file:', error.message);
      alert('Upload failed! Make sure the "documents" bucket exists and is public.');
    } finally {
      setUploading(false);
      setParsing(false);
    }
  };

  return (
    <div className="upload-container animate-fade-in">
      <div className="upload-header">
        <h1 className="upload-title page-title">Upload Center</h1>
        <p className="upload-subtitle page-subtitle">Upload Purchase Orders, Invoices, and Change Orders here.</p>
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
        <h3 className="drop-title">
          {uploading ? 'Uploading to cloud...' : parsing ? 'AI Parsing Document...' : 'Select a file or drag and drop here'}
        </h3>
        <p className="drop-desc">PDF, XLSX, CSV, or DWG, file size no more than 50MB</p>
        <button disabled={uploading || parsing} className="browse-btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
          {uploading || parsing ? <Loader2 size={18} className="animate-spin" /> : 'Browse Files'}
        </button>
      </div>
      {displayDocs.length > 0 && (
        <div className="recent-uploads animate-fade-in delay-200">
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
              <Sparkles size={16} color="#F59E0B" style={{marginLeft: '8px'}} title="AI Parsed" />
            </div>
          </div>
        ))}
        </div>
      </div>
      )}
    </div>
  );
}
