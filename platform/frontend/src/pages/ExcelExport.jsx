import React, { useState } from 'react';
import { Download, FileSpreadsheet, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { usePlatform } from '../context/PlatformContext';
import { generateClientRequirementsExcel } from '../utils/excelExport';
import { supabase } from '../supabaseClient';
import './ExcelExport.css';

export default function ExcelExport() {
  const { activeProject, pos, invoices, cos, materials } = usePlatform();
  const [exported, setExported] = useState(false);

  const handleExport = async () => {
    try {
      if (!activeProject) {
        alert("No active project selected");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const backendUrl = (
        import.meta.env.VITE_BACKEND_URL ||
        import.meta.env.VITE_API_URL ||
        (import.meta.env.DEV ? 'http://localhost:8000' : '')
      ).replace(/\/$/, '');

      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${backendUrl}/api/export/${activeProject.id}`, {
        method: 'POST',
        headers
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const dateStr = new Date().toISOString().split('T')[0];
      const sanitizedProjectName = (activeProject?.name || 'Project').replace(/\s+/g, '_');
      const fileName = `KNCC_${sanitizedProjectName}_${dateStr}.xlsx`;

      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExported(true);
      setTimeout(() => setExported(false), 3000);
    } catch (err) {
      console.error('Export error:', err);
      alert('Export failed: ' + err.message);
    }
  };

  const totalPOs = pos.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalInvoices = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalCOs = cos.reduce((s, c) => s + Number(c.amount || c.cost || 0), 0);

  return (
    <div className="export-container animate-fade-in">
      <div className="export-card">
        <FileSpreadsheet size={64} className="export-icon" />
        <h1 className="export-title page-title">Generate Master Excel Report</h1>
        <p className="export-desc page-subtitle" style={{ margin: '0 auto 2.5rem auto' }}>
          Download a comprehensive Excel workbook following the KNCC Client Requirements structure for <strong>{activeProject?.name || 'this project'}</strong>. Includes all dynamic COs, delivery tracking, and calculated cost formulas.
        </p>

        <button className="export-btn" onClick={handleExport} disabled={exported}>
          {exported ? (
            <><CheckCircle size={24} /> Downloaded!</>
          ) : (
            <><Download size={24} /> Download .xlsx</>
          )}
        </button>

        <div className="data-summary animate-fade-in delay-200">
          <div className="summary-item">
            <span className="summary-label">POs Tracked</span>
            <span className="summary-value">{pos.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total PO Value</span>
            <span className="summary-value">${totalPOs.toLocaleString()}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Invoices Logged</span>
            <span className="summary-value">{invoices.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total Invoiced</span>
            <span className="summary-value">${totalInvoices.toLocaleString()}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Active COs</span>
            <span className="summary-value">{cos.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">CO Impact</span>
            <span className="summary-value">${totalCOs.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
