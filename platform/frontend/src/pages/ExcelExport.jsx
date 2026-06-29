import React from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { usePlatform } from '../context/PlatformContext';
import './ExcelExport.css';

export default function ExcelExport() {
  const { activeProject, pos, invoices, cos, materials } = usePlatform();

  const handleExport = async () => {
    try {
      const response = await fetch('/api/export/client-requirements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_name: activeProject?.name || "KNCC Project",
          materials: materials || [],
          pos: pos || [],
          cos: cos || [],
          invoices: invoices || []
        })
      });

      if (!response.ok) throw new Error('Export failed');

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Client_Requirements_${activeProject?.name?.replace(/\s+/g, '_') || 'Project'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate export", err);
      alert("Failed to generate export document.");
    }
  };

  return (
    <div className="export-container animate-fade-in">
      <div className="export-card">
        <FileSpreadsheet size={64} className="export-icon" />
        <h1 className="export-title page-title">Generate Master Excel Report</h1>
        <p className="export-desc page-subtitle" style={{ margin: '0 auto 2.5rem auto' }}>
          Download a comprehensive, formatting-preserved Excel document containing all 
          Purchase Orders, Invoices, and Change Orders for this project. 
          The document will include the KNCC logo placeholder, company name, and project metadata in the header.
        </p>
        
        <button className="export-btn" onClick={handleExport}>
          <Download size={24} /> Download .xlsx
        </button>

        <div className="data-summary animate-fade-in delay-200">
          <div className="summary-item">
            <span className="summary-label">POs Tracked</span>
            <span className="summary-value">{pos.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Invoices Logged</span>
            <span className="summary-value">{invoices.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Active COs</span>
            <span className="summary-value">{cos.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
