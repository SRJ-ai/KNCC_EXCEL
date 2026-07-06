import React, { useState, useMemo } from 'react';
import { Search, Filter, Download, FileSpreadsheet } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import './MaterialGrid.css';

const EXCEL_COLS = [
  { key: 'type', label: 'Type' },
  { key: 'qty', label: 'Qty', align: 'right' },
  { key: 'co_qty', label: 'CO Qty', align: 'right' },
  { key: 'po_co_qty', label: 'PO+CO Qty', align: 'right' },
  { key: 'thickness', label: 'Thickness', align: 'right' },
  { key: 'spacer_x1', label: 'X', align: 'center', virtual: 'X' },
  { key: 'width', label: 'Width', align: 'right' },
  { key: 'spacer_x2', label: 'X', align: 'center', virtual: 'X' },
  { key: 'length', label: 'Length', align: 'right' },
  { key: 'material_type', label: 'Material Type', width: 250 },
  { key: 'lf_pcs', label: 'L/F (Pcs)', align: 'right' },
  { key: 'bf_sf', label: 'B/F or S/F', align: 'right' },
  { key: 'cost_mbf', label: 'Cost / MBF', align: 'right', isCurrency: true },
  { key: 'total_cost', label: 'Total Cost', align: 'right', isCurrency: true, highlight: true },
  { key: 'total_cost_tax', label: 'Total Cost w/Tax', align: 'right', isCurrency: true },
  { key: 'invoice_refs', label: 'Invoice #' },
  { key: 'total_delivered', label: 'Total Delivered', align: 'right', highlight: true, highlightColor: '#10B981' },
  { key: 'delivered_lf', label: 'Delivered L/F', align: 'right' },
  { key: 'delivered_bf_sf', label: 'Delivered BF/SF', align: 'right' },
  { key: 'delivered_cost', label: 'Delivered Cost', align: 'right', isCurrency: true },
  { key: 'delivered_cost_tax', label: 'Delivered Cost w/Tax', align: 'right', isCurrency: true },
  { key: 'pct_delivery', label: '% Delivery', align: 'right', isPct: true },
  { key: 'inv_bundles', label: 'Inv Bundles', align: 'right' },
  { key: 'inv_uom', label: 'Inv UoM' },
  { key: 'pcs_per_bundle', label: 'Pcs/Bundle', align: 'right' },
  { key: 'inv_pcs', label: 'Inv Pcs', align: 'right' },
  { key: 'issues', label: 'Issues', align: 'right', highlight: true, highlightColor: '#EF4444' },
  { key: 'issues_lf', label: 'Issues L/F', align: 'right' },
  { key: 'issues_bf_sf', label: 'Issues BF/SF', align: 'right' },
  { key: 'pct_issued', label: '% Issued', align: 'right', isPct: true },
  { key: 'issues_cost', label: 'Issues Cost', align: 'right', isCurrency: true },
  { key: 'issues_cost_tax', label: 'Issues Cost w/Tax', align: 'right', isCurrency: true },
  { key: 'variance_code', label: 'Variance Code' },
  { key: 'reason', label: 'Reason' }
];

function fmt(val, isCurrency, isPct) {
  if (val === null || val === undefined || val === '') return '';
  if (isCurrency) return `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (isPct) return `${Number(val).toFixed(1)}%`;
  if (typeof val === 'number') return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return val;
}

export default function MaterialGrid() {
  const { materials, activeProject } = usePlatform();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');

  const types = useMemo(() => {
    const ts = new Set(materials.map(m => {
      const t = m.type || 'Unknown';
      if (t === 'lvl') return 'LVL';
      return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    }));
    return ['All', ...Array.from(ts)];
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    let result = materials.map(m => {
      let displayType = m.type || 'Unknown';
      if (displayType === 'lvl') displayType = 'LVL';
      else displayType = displayType.charAt(0).toUpperCase() + displayType.slice(1).toLowerCase();
      return { ...m, displayType };
    }).filter(m => {
      const matchesSearch = (m.material_type || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'All' || m.displayType === filterType;
      return matchesSearch && matchesType;
    });

    const typeOrder = { 'Lumber': 1, 'Panels': 2, 'LVL': 3, 'Each': 4 };
    return result.sort((a, b) => {
      const aOrder = typeOrder[a.displayType] || 5;
      const bOrder = typeOrder[b.displayType] || 5;
      return aOrder - bOrder;
    });
  }, [materials, searchTerm, filterType]);

  const handleExport = () => {
    const dataToExport = filteredMaterials.map(m => {
      const row = {};
      EXCEL_COLS.forEach(c => {
        row[c.label] = c.virtual || m[c.key];
      });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Materials");
    XLSX.writeFile(wb, `Materials_${activeProject?.name || 'Export'}.xlsx`);
  };

  return (
    <motion.div 
      className="exc-grid-container"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="exc-grid-header">
        <div>
          <h1 className="exc-grid-title">
            <FileSpreadsheet size={24} color="#10B981" />
            Client_Requirments_Doc.xlsx — {activeProject?.name || 'No Project'}
          </h1>
          <p className="exc-grid-subtitle">
            {filteredMaterials.length === 0 
              ? "Sheet structure loaded. Upload POs to populate materials."
              : `${filteredMaterials.length} materials tracked · Live Excel View`}
          </p>
        </div>
        <div className="exc-grid-controls">
          <div className="exc-search-wrapper">
            <Search size={16} color="#a1a1aa" />
            <input 
              type="text" 
              placeholder="Search description..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            className="exc-filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <button onClick={handleExport} className="exc-export-btn">
            <Download size={16} /> Export to Excel
          </button>
        </div>
      </div>

      <div className="exc-table-wrapper">
        <table className="exc-native-table">
          <thead>
            <tr>
              <th className="row-num-col"></th>
              {EXCEL_COLS.map((col, i) => (
                <th 
                  key={i} 
                  style={{ 
                    minWidth: col.width || (col.label.length * 8 + 30) + 'px',
                    textAlign: col.align || 'left',
                    color: col.highlightColor || '#a1a1aa'
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredMaterials.length === 0 ? (
              // Empty rows for structure
              Array.from({ length: 15 }).map((_, i) => (
                <tr key={i}>
                  <td className="row-num-col">{i + 3}</td>
                  {EXCEL_COLS.map((col, j) => (
                    <td key={j} style={{ textAlign: col.align || 'left', opacity: 0.3 }}>
                      {col.virtual ? col.virtual : ''}
                    </td>
                  ))}
                </tr>
              ))
            ) : (() => {
              // First sort by displayType
              const sorted = [...filteredMaterials].sort((a, b) => {
                const typeOrder = { 'Lumber': 1, 'Panels': 2, 'LVL': 3, 'Each': 4 };
                const aOrder = typeOrder[a.displayType] || 5;
                const bOrder = typeOrder[b.displayType] || 5;
                return aOrder - bOrder;
              });
              let currentType = null;
              const rows = [];
              let rowIdx = 3;

              sorted.forEach((item, idx) => {
                if (item.displayType !== currentType) {
                  currentType = item.displayType;
                  // Insert category divider
                  rows.push(
                    <tr key={`group-${currentType}`} style={{ background: '#1c1c1e' }}>
                      <td className="row-num-col"></td>
                      <td colSpan={EXCEL_COLS.length} style={{ fontWeight: 700, color: '#f4f4f5', padding: '0.5rem' }}>
                        {currentType ? `${currentType} Division` : 'Uncategorized'}
                      </td>
                    </tr>
                  );
                }

                rows.push(
                  <tr key={item.id || idx}>
                    <td className="row-num-col">{rowIdx++}</td>
                    {EXCEL_COLS.map((col, j) => {
                      const val = col.virtual || item[col.key];
                      return (
                        <td 
                          key={j} 
                          style={{ 
                            textAlign: col.align || 'left',
                            color: col.highlightColor,
                            fontWeight: col.highlight ? 700 : 400
                          }}
                        >
                          {fmt(val, col.isCurrency, col.isPct)}
                        </td>
                      );
                    })}
                  </tr>
                );
              });

              return rows;
            })()}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
