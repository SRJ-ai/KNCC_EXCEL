import React, { useState } from 'react';
import { X } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';

export default function ManualEntryModal({ isOpen, onClose }) {
  const { addPO, addInvoice, addCO, addMaterial } = usePlatform();
  const [entryType, setEntryType] = useState('PO');
  const [formData, setFormData] = useState({});

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (entryType === 'PO') {
        await addPO({ vendor: formData.vendor, amount: Number(formData.amount), description: 'Manual Entry' });
      } else if (entryType === 'Invoice') {
        await addInvoice({ amount: Number(formData.amount), date: new Date().toISOString() });
      } else if (entryType === 'CO') {
        await addCO({ title: formData.title, cost: Number(formData.amount), description: 'Manual Entry' });
      } else if (entryType === 'Material') {
        await addMaterial({
          description: formData.description,
          quantity: Number(formData.quantity) || 0,
          uom: formData.uom,
          unit_price: Number(formData.unit_price) || 0,
          amount: (Number(formData.quantity) || 0) * (Number(formData.unit_price) || 0),
          source_document: 'Manual Entry'
        });
      }
      alert(`${entryType} added successfully!`);
      setFormData({});
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to add entry.');
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#18181b', padding: '2rem', borderRadius: '12px',
        width: '400px', border: '1px solid #3f3f46', position: 'relative'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
          <X size={20} />
        </button>
        
        <h2 style={{ color: '#fff', marginTop: 0, marginBottom: '1.5rem' }}>Manual Entry</h2>
        
        <select 
          value={entryType} 
          onChange={(e) => { setEntryType(e.target.value); setFormData({}); }}
          style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: '6px' }}
        >
          <option value="PO">Purchase Order</option>
          <option value="Invoice">Invoice</option>
          <option value="CO">Change Order</option>
          <option value="Material">Material</option>
        </select>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {(entryType === 'PO' || entryType === 'CO' || entryType === 'Invoice') && (
            <input 
              type="number" step="0.01" name="amount" placeholder="Amount ($)" required
              onChange={handleChange} value={formData.amount || ''}
              style={{ padding: '0.75rem', background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: '6px' }}
            />
          )}

          {entryType === 'PO' && (
            <input 
              type="text" name="vendor" placeholder="Vendor Name" required
              onChange={handleChange} value={formData.vendor || ''}
              style={{ padding: '0.75rem', background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: '6px' }}
            />
          )}

          {entryType === 'CO' && (
            <input 
              type="text" name="title" placeholder="CO Title/Description" required
              onChange={handleChange} value={formData.title || ''}
              style={{ padding: '0.75rem', background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: '6px' }}
            />
          )}

          {entryType === 'Material' && (
            <>
              <input 
                type="text" name="description" placeholder="Material Description" required
                onChange={handleChange} value={formData.description || ''}
                style={{ padding: '0.75rem', background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: '6px' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="number" name="quantity" placeholder="Qty" required
                  onChange={handleChange} value={formData.quantity || ''}
                  style={{ flex: 1, padding: '0.75rem', background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: '6px' }}
                />
                <input 
                  type="text" name="uom" placeholder="UOM (e.g. PC)" required
                  onChange={handleChange} value={formData.uom || ''}
                  style={{ flex: 1, padding: '0.75rem', background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: '6px' }}
                />
              </div>
              <input 
                type="number" step="0.01" name="unit_price" placeholder="Unit Price ($)" required
                onChange={handleChange} value={formData.unit_price || ''}
                style={{ padding: '0.75rem', background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: '6px' }}
              />
            </>
          )}

          <button type="submit" style={{
            padding: '0.75rem',
            background: '#3B82F6',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: '0.5rem'
          }}>
            Save Entry
          </button>
        </form>
      </div>
    </div>
  );
}
