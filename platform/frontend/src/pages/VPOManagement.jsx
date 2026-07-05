import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import './VPOManagement.css';

export default function VPOManagement() {
  const { pos, addPO, invoices, addInvoice } = usePlatform();
  const [showPOModal, setShowPOModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const [poData, setPoData] = useState({ vendor: '', description: '', amount: '' });
  const [invoiceData, setInvoiceData] = useState({ poId: '', amount: '' });

  const displayPOs = pos;
  const displayInvoices = invoices;

  const handleCreatePO = (e) => {
    e.preventDefault();
    addPO({
      id: `PO-${1000 + displayPOs.length + 1}`,
      vendor: poData.vendor,
      description: poData.description,
      amount: parseFloat(poData.amount),
      status: 'pending'
    });
    setShowPOModal(false);
    setPoData({ vendor: '', description: '', amount: '' });
  };

  const handleCreateInvoice = (e) => {
    e.preventDefault();
    addInvoice({
      id: `INV-${900 + displayInvoices.length + 1}`,
      poId: invoiceData.poId,
      amount: parseFloat(invoiceData.amount),
      status: 'pending',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    });
    setShowInvoiceModal(false);
    setInvoiceData({ poId: '', amount: '' });
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <div className="vpo-container">
      <div className="vpo-header">
        <div>
          <h1 className="vpo-title">Vendor POs & Invoices</h1>
          <p style={{ color: '#a1a1aa', margin: '0.25rem 0 0 0' }}>Manage purchase orders and track invoice payments.</p>
        </div>
        <div className="vpo-controls">
          <button onClick={() => setShowPOModal(true)} style={{ padding: '0.75rem 1.5rem', background: '#3B82F6', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <Plus size={18} /> New PO
          </button>
          <button onClick={() => setShowInvoiceModal(true)} style={{ padding: '0.75rem 1.5rem', background: '#10B981', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <Plus size={18} /> Log Invoice
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Purchase Orders</h3>
          <div className="vpo-table-container">
            <table className="vpo-table">
              <thead>
                <tr>
                  <th>PO ID</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayPOs.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', color: '#a1a1aa', padding: '2rem' }}>No Purchase Orders found.</td></tr>
                ) : (
                  displayPOs.map(po => (
                    <tr key={po.id}>
                      <td style={{ color: '#3B82F6', fontWeight: 600 }}>{po.id}</td>
                      <td>{po.vendor}</td>
                      <td>{formatMoney(po.amount)}</td>
                      <td><span className={`status-badge status-${po.status === 'approved' ? 'paid' : po.status === 'pending' ? 'pending' : 'draft'}`}>{po.status}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Invoices</h3>
          <div className="vpo-table-container">
            <table className="vpo-table">
              <thead>
                <tr>
                  <th>Invoice ID</th>
                  <th>Against PO</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayInvoices.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', color: '#a1a1aa', padding: '2rem' }}>No Invoices found.</td></tr>
                ) : (
                  displayInvoices.map(inv => (
                    <tr key={inv.id}>
                      <td style={{ color: '#10B981', fontWeight: 600 }}>{inv.id}</td>
                      <td>{inv.poId}</td>
                      <td>{formatMoney(inv.amount)}</td>
                      <td><span className={`status-badge status-${inv.status === 'paid' ? 'paid' : 'pending'}`}>{inv.status}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showPOModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Create Purchase Order</h2>
              <button onClick={() => setShowPOModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <form onSubmit={handleCreatePO}>
              <div className="form-group">
                <label>Vendor Name</label>
                <input required type="text" value={poData.vendor} onChange={e => setPoData({...poData, vendor: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input required type="text" value={poData.description} onChange={e => setPoData({...poData, description: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Total Amount (USD)</label>
                <input required type="number" value={poData.amount} onChange={e => setPoData({...poData, amount: e.target.value})} />
              </div>
              <button type="submit" style={{ width: '100%', padding: '1rem', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', marginTop: '1rem' }}>Generate PO</button>
            </form>
          </div>
        </div>
      )}

      {showInvoiceModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Log Invoice</h2>
              <button onClick={() => setShowInvoiceModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <form onSubmit={handleCreateInvoice}>
              <div className="form-group">
                <label>Select PO</label>
                <select required value={invoiceData.poId} onChange={e => setInvoiceData({...invoiceData, poId: e.target.value})}>
                  <option value="">-- Select --</option>
                  {displayPOs.map(po => (
                    <option key={po.id} value={po.id}>{po.id} ({po.vendor})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Invoice Amount (USD)</label>
                <input required type="number" value={invoiceData.amount} onChange={e => setInvoiceData({...invoiceData, amount: e.target.value})} />
              </div>
              <button type="submit" style={{ width: '100%', padding: '1rem', background: '#10B981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', marginTop: '1rem' }}>Log Invoice</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
