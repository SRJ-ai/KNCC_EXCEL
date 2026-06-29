import React, { useState } from 'react';
import { Download, FileSpreadsheet, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { usePlatform } from '../context/PlatformContext';
import './ExcelExport.css';

export default function ExcelExport() {
  const { activeProject, pos, invoices, cos, materials } = usePlatform();
  const [exported, setExported] = useState(false);

  const handleExport = () => {
    try {
      const wb = XLSX.utils.book_new();

      // ── Sheet 1: Project Summary ──────────────────────────────────────
      const summaryData = [
        ['KNCC EXCEL — Project Summary'],
        [],
        ['Project Name', activeProject?.name || 'N/A'],
        ['Status', activeProject?.status || 'N/A'],
        ['Location', activeProject?.location || 'N/A'],
        ['Client', activeProject?.client || 'N/A'],
        ['Budget (USD)', activeProject?.budget ? `$${Number(activeProject.budget).toLocaleString()}` : 'N/A'],
        ['Generated On', new Date().toLocaleString()],
        [],
        ['Metric', 'Count', 'Total Value (USD)'],
        ['Purchase Orders', pos.length, pos.reduce((s, p) => s + Number(p.amount || 0), 0)],
        ['Invoices', invoices.length, invoices.reduce((s, i) => s + Number(i.amount || 0), 0)],
        ['Change Orders', cos.length, cos.reduce((s, c) => s + Number(c.amount || c.cost || 0), 0)],
        ['Materials', materials.length, materials.reduce((s, m) => s + Number(m.amount || 0), 0)],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Project Summary');

      // ── Sheet 2: Purchase Orders ──────────────────────────────────────
      const poRows = [
        ['PO #', 'Supplier / Vendor', 'Description', 'Amount (USD)', 'Status', 'Date'],
        ...pos.map(po => [
          po.po_number || po.id || '',
          po.supplier || po.vendor || '',
          po.description || '',
          Number(po.amount || 0),
          po.status || '',
          po.date || po.created_at || '',
        ])
      ];
      const wsPO = XLSX.utils.aoa_to_sheet(poRows);
      wsPO['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 35 }, { wch: 16 }, { wch: 12 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsPO, 'Purchase Orders');

      // ── Sheet 3: Invoices ─────────────────────────────────────────────
      const invRows = [
        ['Invoice #', 'Against PO', 'Supplier', 'Amount (USD)', 'Status', 'Date'],
        ...invoices.map(inv => [
          inv.invoice_number || inv.id || '',
          inv.po_id || '',
          inv.supplier || '',
          Number(inv.amount || 0),
          inv.status || '',
          inv.date || inv.created_at || '',
        ])
      ];
      const wsInv = XLSX.utils.aoa_to_sheet(invRows);
      wsInv['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsInv, 'Invoices');

      // ── Sheet 4: Change Orders ────────────────────────────────────────
      const coRows = [
        ['CO #', 'Title / Description', 'Amount (USD)', 'Status', 'Date'],
        ...cos.map(co => [
          co.co_number || co.id || '',
          co.title || co.description || '',
          Number(co.amount || co.cost || 0),
          co.status || '',
          co.date || co.created_at || '',
        ])
      ];
      const wsCO = XLSX.utils.aoa_to_sheet(coRows);
      wsCO['!cols'] = [{ wch: 14 }, { wch: 45 }, { wch: 16 }, { wch: 12 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsCO, 'Change Orders');

      // ── Sheet 5: Materials ────────────────────────────────────────────
      if (materials.length > 0) {
        const matRows = [
          ['Item Code', 'Description', 'Qty', 'UOM', 'Dimensions', 'Unit Price', 'Amount', 'Source PO'],
          ...materials.map(m => [
            m.item_code || '',
            m.description || '',
            m.quantity || 0,
            m.uom || '',
            m.dimensions || '',
            Number(m.unit_price || 0),
            Number(m.amount || 0),
            m.source_document || '',
          ])
        ];
        const wsMat = XLSX.utils.aoa_to_sheet(matRows);
        wsMat['!cols'] = [{ wch: 12 }, { wch: 35 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, wsMat, 'Materials');
      }

      // ── Download ──────────────────────────────────────────────────────
      const fileName = `KNCC_${(activeProject?.name || 'Project').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
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
          Download a comprehensive Excel workbook with all Purchase Orders, Invoices,
          Change Orders, and Materials for <strong>{activeProject?.name || 'this project'}</strong>.
          Includes a project summary sheet with totals.
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
