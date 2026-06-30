import React, { useState, useMemo } from 'react';
import { Search, Filter, Download, Trash2, Edit3 } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import './MaterialGrid.css';

export default function MaterialGrid() {
  const { materials, activeProject } = usePlatform();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [filterCategory, setFilterCategory] = useState('All');

  // Derive categories from real data
  const categories = useMemo(() => {
    const cats = new Set(materials.map(m => m.category || 'Uncategorized'));
    return ['All', ...Array.from(cats)];
  }, [materials]);

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = (m.description || m.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (m.item_code || m.id || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || (m.category || 'Uncategorized') === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMaterials.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMaterials.map(m => m.id)));
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleExport = () => {
    const dataToExport = filteredMaterials.map(m => ({
      'Item Code': m.item_code || m.id,
      'Description': m.description || m.name,
      'Category': m.category || 'Uncategorized',
      'Quantity': m.quantity || m.stock || 0,
      'UOM': m.uom || m.unit || 'ea',
      'Unit Price': m.unit_price || 0,
      'Total Amount': m.amount || ((m.quantity || 0) * (m.unit_price || 0)),
      'Source Document': m.source_document || 'Manual'
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Materials");
    XLSX.writeFile(wb, `Materials_${activeProject?.name || 'Export'}.xlsx`);
  };

  return (
    <motion.div 
      className="grid-container"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="grid-header">
        <div>
          <h1 className="grid-title">Material Inventory</h1>
          <p style={{ color: '#a1a1aa', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {filteredMaterials.length} items found
          </p>
        </div>
        <div className="grid-controls">
          <div style={{ position: 'relative' }}>
            <Search size={18} color="#a1a1aa" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search code or description..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            className="filter-select"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <button onClick={handleExport} className="export-btn">
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bulk-actions"
          >
            <span style={{ color: '#fff', fontSize: '0.875rem' }}>{selectedIds.size} selected</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="bulk-btn"><Edit3 size={16}/> Edit Selected</button>
              <button className="bulk-btn danger"><Trash2 size={16}/> Delete</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input 
                  type="checkbox" 
                  checked={filteredMaterials.length > 0 && selectedIds.size === filteredMaterials.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>Item Code</th>
              <th>Description</th>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>Quantity</th>
              <th>UOM</th>
              <th style={{ textAlign: 'right' }}>Unit Price</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th>Source Document</th>
            </tr>
          </thead>
          <tbody>
            {filteredMaterials.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: '#52525b' }}>
                  No materials found. Upload a PO or Invoice to populate this grid.
                </td>
              </tr>
            ) : (
              filteredMaterials.map(item => (
                <tr key={item.id} className={selectedIds.has(item.id) ? 'selected-row' : ''}>
                  <td>
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                    />
                  </td>
                  <td style={{ fontFamily: 'monospace', color: '#3B82F6' }}>{item.item_code || item.id?.split('-')[0]}</td>
                  <td style={{ fontWeight: 500 }}>{item.description || item.name}</td>
                  <td style={{ color: '#a1a1aa' }}>{item.category || 'Material'}</td>
                  <td style={{ textAlign: 'right' }}>{(item.quantity || item.stock || 0).toLocaleString()}</td>
                  <td>{item.uom || item.unit || 'ea'}</td>
                  <td style={{ textAlign: 'right' }}>${Number(item.unit_price || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${Number(item.amount || ((item.quantity||0)*(item.unit_price||0))).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>{item.source_document || 'Manual Entry'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
