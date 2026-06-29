import React, { useState, useEffect } from 'react';
import { Download, Link as LinkIcon, CheckCircle, AlertTriangle } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import './Reconciliation.css';

export default function Reconciliation() {
  const { activeProject, materials, pos, invoices, cos } = usePlatform();
  const [unmatchedItems, setUnmatchedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mappings, setMappings] = useState({});

  useEffect(() => {
    if (activeProject && invoices.length > 0) {
      fetchUnmatchedItems();
    }
  }, [activeProject, invoices, pos]);

  const fetchUnmatchedItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/export/unmatched-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: activeProject?.name || "Unknown",
          materials: materials || [],
          pos: pos || [],
          invoices: invoices || [],
          cos: cos || []
        })
      });
      const data = await res.json();
      if (data.unmatched) {
        setUnmatchedItems(data.unmatched);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleLink = async (invoiceItem) => {
    const materialId = mappings[invoiceItem.description];
    if (!materialId) return alert("Please select a PO Material to link to.");

    try {
      await fetch('/api/mappings/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: activeProject?.id || 1,
          invoice_description: invoiceItem.description,
          material_id: parseInt(materialId)
        })
      });
      // Remove from unmatched list
      setUnmatchedItems(prev => prev.filter(i => i.description !== invoiceItem.description));
    } catch (err) {
      console.error(err);
      alert("Failed to save mapping.");
    }
  };

  // Group PO materials for the dropdown
  const availableMaterials = pos.flatMap(p => p.line_items || []).map((item, idx) => ({
    id: idx + 1, // Using index as mock material_id for UI since backend expects ID
    name: `${item.category || 'Item'} - ${item.dimensions ? item.dimensions + ' ' : ''}${item.description}`,
    qty: item.quantity
  }));

  return (
    <div className="recon-container">
      <div className="recon-header">
        <div>
          <h1 className="recon-title">Invoice Reconciliation</h1>
          <p style={{ color: '#a1a1aa', margin: 0 }}>Map unmatched invoice line items to their original Purchase Order materials.</p>
        </div>
        <button onClick={fetchUnmatchedItems} style={{ padding: '0.75rem 1.5rem', background: '#3B82F6', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
          {loading ? 'Scanning...' : 'Scan for Unmatched Items'}
        </button>
      </div>

      <div className="recon-stats">
        <div className="stat-box" style={{ borderColor: unmatchedItems.length > 0 ? '#F59E0B' : '#10B981' }}>
          <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {unmatchedItems.length > 0 ? <AlertTriangle size={18} color="#F59E0B" /> : <CheckCircle size={18} color="#10B981" />}
            Items Requiring Attention
          </div>
          <div className="stat-value">{unmatchedItems.length}</div>
        </div>
      </div>

      <div className="recon-table-container">
        <table className="recon-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Date</th>
              <th style={{ width: '40%' }}>Unmatched Description</th>
              <th>Quantity</th>
              <th style={{ width: '30%' }}>Link to PO Material</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {unmatchedItems.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#a1a1aa' }}>
                  No unmatched items! Your Excel generation will be perfect.
                </td>
              </tr>
            ) : (
              unmatchedItems.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.invoice_number}</td>
                  <td>{item.date}</td>
                  <td style={{ fontWeight: 500, color: '#F87171' }}>{item.description}</td>
                  <td>{item.quantity} {item.uom}</td>
                  <td>
                    <select 
                      style={{ width: '100%', padding: '0.5rem', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '4px' }}
                      value={mappings[item.description] || ""}
                      onChange={(e) => setMappings({...mappings, [item.description]: e.target.value})}
                    >
                      <option value="">Select a PO Material...</option>
                      {availableMaterials.map(mat => (
                        <option key={mat.id} value={mat.id}>
                          {mat.name} (Qty: {mat.qty})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button 
                      onClick={() => handleLink(item)}
                      style={{ padding: '0.5rem 1rem', background: '#10B981', border: 'none', borderRadius: '4px', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                    >
                      <LinkIcon size={16} /> Link
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
