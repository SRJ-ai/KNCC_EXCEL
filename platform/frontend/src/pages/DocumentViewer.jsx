import React, { useState } from 'react';
import { Folder, FileText, FileImage, FileSpreadsheet, Search, Plus, Download } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import './DocumentViewer.css';

export default function DocumentViewer() {
  const { documents } = usePlatform();
  const [activeFolder, setActiveFolder] = useState('Purchase Orders');

  const folders = ['Purchase Orders', 'Invoices', 'Change Orders'];

  // Group real documents by their doc_type
  const files = {
    'Purchase Orders': documents.filter(d => d.doc_type === 'PO'),
    'Invoices': documents.filter(d => d.doc_type === 'INV'),
    'Change Orders': documents.filter(d => d.doc_type === 'CO'),
  };

  const currentFiles = files[activeFolder] || [];

  return (
    <div className="doc-container">
      <div className="doc-header">
        <h1 className="doc-title">Document Control</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} color="#a1a1aa" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search documents..." 
              style={{ background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.75rem 1rem 0.75rem 2.5rem', color: '#fff', width: '250px' }}
            />
          </div>
        </div>
      </div>

      <div className="doc-layout">
        <div className="doc-sidebar">
          <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 600, color: '#a1a1aa' }}>
            FOLDERS
          </div>
          <ul className="folder-list">
            {folders.map(folder => (
              <li 
                key={folder} 
                className={`folder-item ${activeFolder === folder ? 'active' : ''}`}
                onClick={() => setActiveFolder(folder)}
              >
                <Folder size={18} fill={activeFolder === folder ? '#3B82F6' : 'none'} />
                {folder}
                <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', color: '#a1a1aa' }}>
                  {files[folder].length}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="doc-main">
          {currentFiles.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#a1a1aa', marginTop: '4rem' }}>
              <Folder size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p>No documents uploaded in this folder yet.</p>
            </div>
          ) : (
            currentFiles.map(file => (
              <div key={file.id} className="file-card">
                <FileText size={48} className="file-card-icon" />
                <div className="file-card-name">{file.filename || file.file_name}</div>
                <div className="file-card-size">
                  {new Date(file.created_at).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

