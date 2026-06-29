import React, { useState, useEffect } from 'react';
import { Link as LinkIcon, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import './Reconciliation.css';

export default function Reconciliation() {
  const { activeProject, materials, pos, invoices, cos } = usePlatform();
  const [unmatchedItems, setUnmatchedItems] = useState([]);
  const [mappings, setMappings] = useState({});
  const [linkedItems, setLinkedItems] = useState([]);

  // Client-side reconciliation: find invoices not matched to any PO
  const scanUnmatched = () => {
    const poIds = new Set(pos.map(p => p.id).concat(pos.map(p => p.po_number)));
    const unmatched = invoices.filter(inv => {
      const linkedPoId = inv.po_id || inv.poId;
      return !linkedPoId || !poIds.has(linkedPoId);
    }).map(inv => ({
      id: inv.id,
      invoice_number: inv.invoice_number || inv.id,
      date: inv.date || (inv.created_at ? new Date(inv.created_at).toLocaleDateString() : 'N/A'),
      description: `Invoice from ${inv.supplier || 'Unknown'} — $${Number(inv.amount || 0).toLocaleString()}`,
      quantity: 1,
      uom: 'ea',
      amount: inv.amount
    }));
    setUnmatchedItems(unmatched);
  };

  // Auto-scan when data loads
  useEffect(() => {
    if (invoices.length > 0) scanUnmatched();
  }, [invoices, pos]);

  const handleLink = (item) => {
    const materialId = mappings[item.id];
    if (!materialId) return alert("Please select a PO to link this invoice to.");
    setLinkedItems(prev => [...prev, { ...item, linkedTo: materialId }]);
    setUnmatchedItems(prev => prev.filter(i => i.id !== item.id));
    setMappings(prev => { const m = { ...prev }; delete m[item.id]; return m; });
  };

  // Build dropdown options from POs
  const poOptions = pos.map(po => ({
    id: po.id,
    label: `${po.po_number || po.id} — ${po.supplier || po.vendor || 'N/A'} ($${Number(po.amount || 0).toLocaleString()})`
  }));

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalPOs = pos.reduce((s, p) => s + Number(p.amount || 0), 0);
  const variance = totalPOs - totalInvoiced;

  return (
    <div className="recon-container animate-fade-in">
      <div className="recon-header">
        <div>
          <h1 className="recon-title page-title">Invoice Reconciliation</h1>
          <p className="page-subtitle" style={{ color: '#a1a1aa', margin: 0 }}>
            Match invoice payments against Purchase Orders to ensure accurate billing.
          </p>
        </div>
        <button
          onClick={scanUnmatched}
          style={{ padding: '0.75rem 1.5rem', background: '#3B82F6', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <RefreshCw size={16} /> Scan Now
        </button>
      </div>

      {/* Summary Stats */}
      <div className="recon-stats animate-fade-in delay-100" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div className="stat-box">
          <div className="stat-label">Total PO Value</div>
          <div className="stat-value" style={{ color: '#3B82F6' }}>${totalPOs.toLocaleString()}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Total Invoiced</div>
          <div className="stat-value" style={{ color: '#10B981' }}>${totalInvoiced.toLocaleString()}</div>
        </div>
        <div className="stat-box" style={{ borderColor: variance < 0 ? '#EF4444' : '#10B981' }}>
          <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {variance < 0
              ? <AlertTriangle size={16} color="#EF4444" />
              : <CheckCircle size={16} color="#10B981" />}
            Variance (PO − Invoice)
          </div>
          <div className="stat-value" style={{ color: variance < 0 ? '#EF4444' : '#10B981' }}>
            {variance < 0 ? '-' : '+'}${Math.abs(variance).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Unmatched Items Table */}
      <div className="recon-table-container animate-fade-in delay-200">
        <h3 style={{ marginBottom: '1rem', color: unmatchedItems.length > 0 ? '#F59E0B' : '#10B981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {unmatchedItems.length > 0
            ? <><AlertTriangle size={18} /> {unmatchedItems.length} Unmatched Invoice(s)</>
            : <><CheckCircle size={18} /> All Invoices Matched — Ready to Export!</>}
        </h3>
        <table className="recon-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Date</th>
              <th style={{ width: '35%' }}>Description</th>
              <th>Amount</th>
              <th style={{ width: '25%' }}>Link to PO</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {unmatchedItems.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#a1a1aa' }}>
                  {invoices.length === 0
                    ? 'No invoices found. Add invoices in Vendor POs & Invoices page.'
                    : 'All invoices are matched to Purchase Orders. Your export will be complete!'}
                </td>
              </tr>
            ) : (
              unmatchedItems.map((item) => (
                <tr key={item.id}>
                  <td style={{ color: '#F87171', fontWeight: 600 }}>{item.invoice_number}</td>
                  <td>{item.date}</td>
                  <td style={{ color: '#e4e4e7' }}>{item.description}</td>
                  <td style={{ color: '#F59E0B' }}>${Number(item.amount || 0).toLocaleString()}</td>
                  <td>
                    <select
                      style={{ width: '100%', padding: '0.5rem', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '4px' }}
                      value={mappings[item.id] || ''}
                      onChange={(e) => setMappings({ ...mappings, [item.id]: e.target.value })}
                    >
                      <option value="">Select a PO...</option>
                      {poOptions.map(po => (
                        <option key={po.id} value={po.id}>{po.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      onClick={() => handleLink(item)}
                      style={{ padding: '0.5rem 1rem', background: '#10B981', border: 'none', borderRadius: '4px', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      <LinkIcon size={14} /> Link
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Linked Items */}
      {linkedItems.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ color: '#10B981', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={18} /> Recently Linked ({linkedItems.length})
          </h3>
          {linkedItems.map((item, idx) => (
            <div key={idx} style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '0.5rem', color: '#d1fae5', fontSize: '0.875rem' }}>
              ✓ {item.invoice_number} linked to PO {item.linkedTo}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
