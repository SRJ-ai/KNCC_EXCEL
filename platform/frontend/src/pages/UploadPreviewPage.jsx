import React, { useState } from 'react';
import {
  ArrowLeft, CheckCircle2, AlertTriangle, X, Package,
  FileCheck, BarChart3, ChevronRight, Info, Zap,
  TrendingUp, TrendingDown, Minus, FileSpreadsheet
} from 'lucide-react';
import './UploadPreviewPage.css';

/* ── helpers ── */
const DOC_TYPE_META = {
  PO:  { label: 'Purchase Order', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)'  },
  INV: { label: 'Invoice',         color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)'  },
  CO:  { label: 'Change Order',    color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)'  },
};

const CHANGE_CFG = {
  ADD:        { color:'#10B981', bg:'rgba(16,185,129,0.1)',  icon:<Package size={13}/>,      label:'New Material'      },
  INVOICE:    { color:'#3B82F6', bg:'rgba(59,130,246,0.1)',  icon:<FileCheck size={13}/>,    label:'Matched PO Line'   },
  NEW_CHARGE: { color:'#F59E0B', bg:'rgba(245,158,11,0.1)', icon:<AlertTriangle size={13}/>,label:'⚠ No PO Match'     },
  CO_ADD:     { color:'#10B981', bg:'rgba(16,185,129,0.1)', icon:<TrendingUp size={13}/>,   label:'Qty Increase'      },
  CO_REMOVE:  { color:'#EF4444', bg:'rgba(239,68,68,0.1)',  icon:<TrendingDown size={13}/>, label:'Qty Decrease'      },
  CO_ADJUST:  { color:'#F59E0B', bg:'rgba(245,158,11,0.1)', icon:<Minus size={13}/>,        label:'Adjustment'        },
  UNKNOWN:    { color:'#71717a', bg:'rgba(113,113,122,0.1)',icon:<Info size={13}/>,          label:'Unknown'           },
};

function fmt(n) {
  if (!n && n !== 0) return '—';
  return `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function fmtQty(n, plus=false) {
  if (!n && n !== 0) return '—';
  const s = Number(n).toLocaleString();
  return (plus && n > 0 ? '+' : '') + s;
}

/* ── Excel Interactive Diff Cell ── */
function ExcelDiffCell({ value, highlight, dimmed, changeType }) {
  const bg = highlight
    ? CHANGE_CFG[changeType]?.bg || 'rgba(59,130,246,0.15)'
    : dimmed ? 'transparent' : 'transparent';
  const color = highlight
    ? CHANGE_CFG[changeType]?.color || '#60a5fa'
    : dimmed ? '#3f3f46' : '#a1a1aa';
  const border = highlight
    ? `1px solid ${CHANGE_CFG[changeType]?.color || '#3B82F6'}44`
    : '1px solid transparent';

  return (
    <td className="exc-cell" style={{ background: bg, color, border, position: 'relative' }}>
      {highlight && <span className="exc-cell-dot" style={{ background: CHANGE_CFG[changeType]?.color }} />}
      {value || '—'}
    </td>
  );
}

/* ── Excel-style mini grid showing affected rows ── */
function ExcelDiffGrid({ items, docType }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!items || items.length === 0) return null;

  const cols = docType === 'CO'
    ? ['Type / Item', 'Qty (Before)', 'Change', 'Qty (After)', 'Dimensions', 'Material', 'Excel Row']
    : docType === 'INV'
    ? ['Item Code', 'Description', 'Qty', 'Unit Price', 'Amount', 'PO Match', 'Excel Row']
    : ['Item Code', 'Description', 'Qty', 'Unit Price', 'Amount', 'Dimensions', 'Excel Row'];

  return (
    <div className="exc-wrap">
      <div className="exc-header-bar">
        <FileSpreadsheet size={15} color="#10B981" />
        <span>Client_Requirments_Doc.xlsx</span>
        <span className="exc-badge">{items.length} row{items.length !== 1 ? 's' : ''} affected</span>
      </div>
      <div className="exc-scroll">
        <table className="exc-table">
          <thead>
            <tr className="exc-head-row">
              <th className="exc-row-num">#</th>
              {cols.map(c => <th key={c}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const li = item.line_item || {};
              const ct = item.change_type || 'UNKNOWN';
              const hl = hoveredIdx === null || hoveredIdx === idx;
              const dm = hoveredIdx !== null && hoveredIdx !== idx;
              const rowRef = item.excel_row_ref || '';
              const rowNum = rowRef.match(/Row (\d+)/)?.[1] || '—';

              return (
                <tr
                  key={idx}
                  className={`exc-row ${hoveredIdx === idx ? 'exc-row-active' : ''}`}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <td className="exc-row-num" style={{ color: '#52525b', background: '#0a0a0a' }}>{idx + 1}</td>

                  {docType === 'CO' ? <>
                    <ExcelDiffCell value={li.item_code || li.description?.slice(0,20) || '—'} highlight={hl} dimmed={dm} changeType={ct} />
                    <ExcelDiffCell value={fmtQty(li.quantity)} highlight={false} dimmed={dm} changeType={ct} />
                    <ExcelDiffCell value={fmtQty(li.quantity, true)} highlight={hl} dimmed={dm} changeType={ct} />
                    <ExcelDiffCell value={li.quantity > 0 ? fmtQty((li.quantity || 0) * 1.1) : '—'} highlight={false} dimmed={dm} changeType={ct} />
                    <ExcelDiffCell value={li.dimensions || '—'} highlight={false} dimmed={dm} changeType={ct} />
                    <ExcelDiffCell value={item.matched_material_type || '—'} highlight={false} dimmed={dm} changeType={ct} />
                    <ExcelDiffCell value={`Row ${rowNum}`} highlight={hl} dimmed={dm} changeType={ct} />
                  </> : docType === 'INV' ? <>
                    <ExcelDiffCell value={li.item_code || '—'} highlight={hl} dimmed={dm} changeType={ct} />
                    <ExcelDiffCell value={li.description?.slice(0,28) || '—'} highlight={false} dimmed={dm} changeType={ct} />
                    <ExcelDiffCell value={fmtQty(li.quantity)} highlight={false} dimmed={dm} changeType={ct} />
                    <ExcelDiffCell value={fmt(li.unit_price)} highlight={false} dimmed={dm} changeType={ct} />
                    <ExcelDiffCell value={fmt(li.amount)} highlight={hl} dimmed={dm} changeType={ct} />
                    <ExcelDiffCell value={item.matched_material_type ? '✓ '+item.matched_material_type.slice(0,16) : '✗ No match'} highlight={hl} dimmed={dm} changeType={ct} />
                    <ExcelDiffCell value={`Row ${rowNum}`} highlight={hl} dimmed={dm} changeType={ct} />
                  </> : <>
                    <ExcelDiffCell value={li.item_code || '—'} highlight={hl} dimmed={dm} changeType={ct} />
                    <ExcelDiffCell value={li.description?.slice(0,28) || '—'} highlight={false} dimmed={dm} changeType={ct} />
                    <ExcelDiffCell value={fmtQty(li.quantity) + ' ' + (li.uom||'')} highlight={false} dimmed={dm} changeType={ct} />
                    <ExcelDiffCell value={fmt(li.unit_price)} highlight={false} dimmed={dm} changeType={ct} />
                    <ExcelDiffCell value={fmt(li.amount)} highlight={hl} dimmed={dm} changeType={ct} />
                    <ExcelDiffCell value={li.dimensions || '—'} highlight={false} dimmed={dm} changeType={ct} />
                    <ExcelDiffCell value={`Row ${rowNum}`} highlight={hl} dimmed={dm} changeType={ct} />
                  </>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="exc-hint">↑ Hover a row to highlight it in the grid</p>
    </div>
  );
}

/* ── PO Page: "These materials will be added" ── */
function POPreviewPage({ preview }) {
  const items = preview.preview_items || [];
  const total = items.reduce((s, i) => s + (i.line_item?.amount || 0), 0);

  return (
    <div className="upp-section">
      <div className="upp-section-header">
        <div className="upp-section-badge" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}>
          <Package size={14} /> Purchase Order
        </div>
        <h2 className="upp-section-title">
          {items.length} material{items.length !== 1 ? 's' : ''} will be added to this project
        </h2>
        <p className="upp-section-sub">
          Review each line item below. Once you click <strong>Apply</strong>, these will appear in your Material Grid.
        </p>
      </div>

      {/* Summary stats */}
      <div className="upp-stats-row">
        <div className="upp-stat">
          <span className="upp-stat-val" style={{ color: '#60a5fa' }}>{items.length}</span>
          <span className="upp-stat-lbl">Line Items</span>
        </div>
        <div className="upp-stat">
          <span className="upp-stat-val" style={{ color: '#10B981' }}>{fmt(total)}</span>
          <span className="upp-stat-lbl">Total Value</span>
        </div>
        <div className="upp-stat">
          <span className="upp-stat-val" style={{ color: '#F59E0B' }}>{items.filter(i => i.excel_row_ref).length}</span>
          <span className="upp-stat-lbl">Mapped to Excel</span>
        </div>
        <div className="upp-stat">
          <span className="upp-stat-val" style={{ color: '#a1a1aa' }}>{items.filter(i => !i.excel_row_ref).length}</span>
          <span className="upp-stat-lbl">Unmatched</span>
        </div>
      </div>

      {/* Full material list */}
      <div className="upp-card-list">
        {items.map((item, idx) => {
          const li = item.line_item || {};
          const cfg = CHANGE_CFG[item.change_type] || CHANGE_CFG.UNKNOWN;
          return (
            <div key={idx} className="upp-mat-card" style={{ '--card-color': cfg.color }}>
              <div className="upp-mat-num">{idx + 1}</div>
              <div className="upp-mat-body">
                <div className="upp-mat-top">
                  <span className="upp-mat-code">{li.item_code || 'Item'}</span>
                  {li.dimensions && <span className="upp-mat-dim">{li.dimensions}</span>}
                  {li.footage > 0 && <span className="upp-mat-ft">{li.footage} LF</span>}
                  <span className="upp-mat-badge" style={{ background: cfg.bg, color: cfg.color }}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>
                <p className="upp-mat-desc">{li.description || 'No description'}</p>
                <div className="upp-mat-meta">
                  <span><strong>{fmtQty(li.quantity)}</strong> {li.uom}</span>
                  {li.unit_price > 0 && <span>@ {fmt(li.unit_price)}/{li.price_uom || 'ea'}</span>}
                  {li.amount > 0 && <span className="upp-mat-amount">{fmt(li.amount)}</span>}
                </div>
              </div>
              {item.excel_row_ref && (
                <div className="upp-mat-excel">
                  <FileSpreadsheet size={12} color="#10B981" />
                  <span>{item.excel_row_ref}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Interactive Excel diff */}
      <ExcelDiffGrid items={items} docType="PO" />
    </div>
  );
}

/* ── Invoice Page: "Match or change vs PO" ── */
function INVPreviewPage({ preview }) {
  const items = preview.preview_items || [];
  const matched   = items.filter(i => i.change_type === 'INVOICE');
  const unmatched = items.filter(i => i.change_type !== 'INVOICE');
  const total = items.reduce((s, i) => s + (i.line_item?.amount || 0), 0);

  return (
    <div className="upp-section">
      <div className="upp-section-header">
        <div className="upp-section-badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
          <FileCheck size={14} /> Invoice
        </div>
        <h2 className="upp-section-title">
          {items.length} invoice line{items.length !== 1 ? 's' : ''} — {matched.length} matched to PO, {unmatched.length} unmatched
        </h2>
        <p className="upp-section-sub">
          Matched lines are being billed against existing PO materials. Unmatched lines have no corresponding PO entry.
        </p>
      </div>

      <div className="upp-stats-row">
        <div className="upp-stat">
          <span className="upp-stat-val" style={{ color: '#10B981' }}>{matched.length}</span>
          <span className="upp-stat-lbl">Matched to PO</span>
        </div>
        <div className="upp-stat">
          <span className="upp-stat-val" style={{ color: '#F59E0B' }}>{unmatched.length}</span>
          <span className="upp-stat-lbl">No PO Match</span>
        </div>
        <div className="upp-stat">
          <span className="upp-stat-val" style={{ color: '#60a5fa' }}>{fmt(total)}</span>
          <span className="upp-stat-lbl">Invoice Total</span>
        </div>
      </div>

      {/* Matched items */}
      {matched.length > 0 && (
        <div className="upp-group">
          <h3 className="upp-group-title" style={{ color: '#10B981' }}>
            <CheckCircle2 size={16} /> Matched to Purchase Order
          </h3>
          {matched.map((item, idx) => {
            const li = item.line_item || {};
            return (
              <div key={idx} className="upp-inv-row matched">
                <div className="upp-inv-left">
                  <span className="upp-inv-code">{li.item_code || `Line ${idx+1}`}</span>
                  <span className="upp-inv-desc">{li.description}</span>
                  {li.dimensions && <span className="upp-mat-dim">{li.dimensions}</span>}
                </div>
                <div className="upp-inv-center">
                  <div className="upp-match-chip">
                    <CheckCircle2 size={12} /> {item.matched_material_type || 'Matched'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${item.match_score_pct || 100}%`, height: '100%', background: (item.match_score_pct || 100) > 75 ? '#10B981' : '#F59E0B' }} />
                    </div>
                    <span style={{ fontSize: '0.65rem', color: '#a1a1aa', fontWeight: 600 }}>{item.match_score_pct || 100}% Match</span>
                  </div>
                  {item.excel_row_ref && (
                    <div className="upp-mat-excel sm" style={{ marginTop: '4px' }}>
                      <FileSpreadsheet size={11} color="#10B981" />
                      <span>{item.excel_row_ref}</span>
                    </div>
                  )}
                </div>
                <div className="upp-inv-right">
                  <span className="upp-inv-qty">{fmtQty(li.quantity)} {li.uom}</span>
                  <span className="upp-inv-amt">{fmt(li.amount)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unmatched items */}
      {unmatched.length > 0 && (
        <div className="upp-group">
          <h3 className="upp-group-title" style={{ color: '#F59E0B' }}>
            <AlertTriangle size={16} /> No Matching PO Line — Review Required
          </h3>
          {unmatched.map((item, idx) => {
            const li = item.line_item || {};
            return (
              <div key={idx} className="upp-inv-row unmatched">
                <div className="upp-inv-left">
                  <span className="upp-inv-code">{li.item_code || `Line ${idx+1}`}</span>
                  <span className="upp-inv-desc">{li.description}</span>
                </div>
                <div className="upp-inv-center">
                  <div className="upp-nomatch-chip">
                    <AlertTriangle size={12} /> No PO match found
                  </div>
                </div>
                <div className="upp-inv-right">
                  <span className="upp-inv-qty">{fmtQty(li.quantity)} {li.uom}</span>
                  <span className="upp-inv-amt warn">{fmt(li.amount)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ExcelDiffGrid items={items} docType="INV" />
    </div>
  );
}

/* ── CO Page: "+/- changes per Excel row" ── */
function COPreviewPage({ preview }) {
  const items = preview.preview_items || [];
  const adds    = items.filter(i => i.change_type === 'CO_ADD');
  const removes = items.filter(i => i.change_type === 'CO_REMOVE');
  const adjusts = items.filter(i => !['CO_ADD','CO_REMOVE'].includes(i.change_type));

  return (
    <div className="upp-section">
      <div className="upp-section-header">
        <div className="upp-section-badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
          <Zap size={14} /> Change Order
        </div>
        <h2 className="upp-section-title">
          {items.length} quantity change{items.length !== 1 ? 's' : ''} across Excel rows
        </h2>
        <p className="upp-section-sub">
          These adjustments will be applied to materials matched in <strong>Client_Requirments_Doc.xlsx</strong>.
        </p>
      </div>

      <div className="upp-stats-row">
        <div className="upp-stat">
          <span className="upp-stat-val" style={{ color: '#10B981' }}>+{adds.reduce((s,i) => s + Math.abs(i.line_item?.quantity||0), 0)}</span>
          <span className="upp-stat-lbl">Added Qty</span>
        </div>
        <div className="upp-stat">
          <span className="upp-stat-val" style={{ color: '#EF4444' }}>-{removes.reduce((s,i) => s + Math.abs(i.line_item?.quantity||0), 0)}</span>
          <span className="upp-stat-lbl">Removed Qty</span>
        </div>
        <div className="upp-stat">
          <span className="upp-stat-val" style={{ color: '#F59E0B' }}>{adjusts.length}</span>
          <span className="upp-stat-lbl">Other Adjustments</span>
        </div>
        <div className="upp-stat">
          <span className="upp-stat-val" style={{ color: '#a1a1aa' }}>{items.filter(i => i.excel_row_ref).length}</span>
          <span className="upp-stat-lbl">Excel Rows Mapped</span>
        </div>
      </div>

      {/* CO delta list */}
      <div className="upp-co-list">
        {items.map((item, idx) => {
          const li = item.line_item || {};
          const cfg = CHANGE_CFG[item.change_type] || CHANGE_CFG.UNKNOWN;
          const delta = li.quantity || 0;
          return (
            <div key={idx} className="upp-co-row" style={{ '--co-color': cfg.color }}>
              <div className="upp-co-delta" style={{ background: cfg.bg, color: cfg.color }}>
                {delta > 0 ? <TrendingUp size={18}/> : delta < 0 ? <TrendingDown size={18}/> : <Minus size={18}/>}
                <span className="upp-co-delta-val">
                  {delta > 0 ? '+' : ''}{delta}
                </span>
              </div>
              <div className="upp-co-body">
                <div className="upp-co-top">
                  <span className="upp-co-desc">{li.description || li.item_code || 'Adjustment'}</span>
                  {li.dimensions && <span className="upp-mat-dim">{li.dimensions}</span>}
                </div>
                <div className="upp-co-meta">
                  {li.unit_price > 0 && <span>@ {fmt(li.unit_price)}</span>}
                  {li.amount !== 0 && <span className="upp-co-cost" style={{ color: cfg.color }}>{fmt(Math.abs(li.amount))}</span>}
                  {item.matched_material_type && (
                    <span className="upp-co-material">→ {item.matched_material_type}</span>
                  )}
                </div>
              </div>
              {item.excel_row_ref && (
                <div className="upp-mat-excel sm">
                  <FileSpreadsheet size={11} color="#10B981"/>
                  <span>{item.excel_row_ref}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ExcelDiffGrid items={items} docType="CO" />
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN EXPORT — Full-page preview
══════════════════════════════════════════════════════ */
export default function UploadPreviewPage({ preview, onConfirm, onDiscard, confirming }) {
  const [showCoModal, setShowCoModal] = useState(false);

  if (!preview) return null;

  const { filename, doc_type, doc_number, doc_date, total_amount, tax,
          preview_items = [], duplicate_warning } = preview;

  const dtMeta = DOC_TYPE_META[doc_type] || DOC_TYPE_META.PO;
  const totalValue = preview_items.reduce((s, i) => s + (i.line_item?.amount || 0), 0);

  const handleApplyClick = () => {
    if (doc_type === 'CO') {
      setShowCoModal(true);
    } else {
      onConfirm();
    }
  };

  return (
    <div className="upp-wrap animate-fade-in">

      {/* ── Top Bar ── */}
      <div className="upp-topbar">
        <button className="upp-back-btn" onClick={onDiscard}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="upp-topbar-center">
          <span className="upp-doc-badge" style={{ background: dtMeta.bg, color: dtMeta.color, border: `1px solid ${dtMeta.border}` }}>
            {dtMeta.label}
          </span>
          <span className="upp-filename">{filename}</span>
          {doc_number && <span className="upp-docnum">#{doc_number}</span>}
          {doc_date && <span className="upp-docdate">{doc_date.split('T')[0]}</span>}
        </div>
        <div className="upp-topbar-right">
          {totalValue > 0 && <span className="upp-total">{fmt(totalValue)}</span>}
          <button className="upp-discard-btn" onClick={onDiscard} disabled={confirming}>
            <X size={14}/> Discard
          </button>
          <button
            className="upp-confirm-btn"
            onClick={handleApplyClick}
            disabled={confirming || !!duplicate_warning}
            title={duplicate_warning || undefined}
          >
            {confirming
              ? <><span className="upp-spinner"/> Applying...</>
              : <><CheckCircle2 size={15}/> Apply Changes</>}
          </button>
        </div>
      </div>

      {/* ── Duplicate warning ── */}
      {duplicate_warning && (
        <div className="upp-dup-warn">
          <AlertTriangle size={15}/> {duplicate_warning}
        </div>
      )}

      {/* ── Body ── */}
      <div className="upp-body">
        {doc_type === 'PO'  && <POPreviewPage  preview={preview} />}
        {doc_type === 'INV' && <INVPreviewPage preview={preview} />}
        {doc_type === 'CO'  && <COPreviewPage  preview={preview} />}
        {!['PO','INV','CO'].includes(doc_type) && (
          <div className="upp-empty">
            <Info size={32} color="#52525b"/>
            <p>{preview_items.length} items parsed. Doc type: {doc_type}</p>
          </div>
        )}
      </div>

      {/* ── Bottom Action Bar ── */}
      <div className="upp-bottom-bar">
        <div className="upp-bottom-left">
          <span style={{ color: '#52525b', fontSize: 13 }}>
            {preview_items.length} change{preview_items.length !== 1 ? 's' : ''} ready to apply
          </span>
        </div>
        <div className="upp-bottom-right">
          <button className="upp-discard-btn" onClick={onDiscard} disabled={confirming}>
            <X size={14}/> Discard
          </button>
          <button
            className="upp-confirm-btn lg"
            onClick={handleApplyClick}
            disabled={confirming || !!duplicate_warning}
          >
            {confirming
              ? <><span className="upp-spinner"/> Applying Changes...</>
              : <><CheckCircle2 size={16}/> Apply Changes to Project</>}
          </button>
        </div>
      </div>

      {/* ── Change Order Confirmation Modal (Interactive Row Changes) ── */}
      {showCoModal && (
        <div className="co-confirm-overlay" style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          animation: 'fadeIn 0.25s ease'
        }}>
          <div className="co-confirm-modal glass-card" style={{
            background: 'rgba(15, 15, 15, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 80px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(10, 10, 10, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Zap size={18} color="#F59E0B" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f4f4f5' }}>
                    Confirm Change Order Adjustments
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#71717a' }}>
                    Verify row quantity deltas before writing to Master Excel
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCoModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#71717a',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#e4e4e7'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.background = 'none'; }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <p style={{ fontSize: '0.85rem', color: '#a1a1aa', margin: '0 0 0.5rem 0', lineHeight: 1.4 }}>
                You are applying a Change Order that will modify the following rows in the Master Excel document:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {preview_items.map((item, idx) => {
                  const li = item.line_item || {};
                  const delta = li.quantity || 0;
                  const isIncrease = delta > 0;
                  const isDecrease = delta < 0;
                  const deltaColor = isIncrease ? '#10B981' : isDecrease ? '#EF4444' : '#F59E0B';
                  const deltaBg = isIncrease ? 'rgba(16, 185, 129, 0.1)' : isDecrease ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)';

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '10px',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {item.excel_row_ref ? (
                            <span style={{
                              fontFamily: 'JetBrains Mono, monospace',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: '#34d399',
                              background: 'rgba(16, 185, 129, 0.08)',
                              border: '1px solid rgba(16, 185, 129, 0.15)',
                              borderRadius: '4px',
                              padding: '1px 6px'
                            }}>
                              {item.excel_row_ref}
                            </span>
                          ) : (
                            <span style={{ color: '#52525b', fontSize: '0.72rem' }}>—</span>
                          )}
                          <span style={{
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            color: '#e4e4e7',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {li.description || li.item_code || 'Material Adjustment'}
                          </span>
                        </div>
                        {item.matched_material_type && (
                          <span style={{ fontSize: '0.72rem', color: '#71717a' }}>
                            Material Type: {item.matched_material_type}
                          </span>
                        )}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: deltaBg,
                        color: deltaColor,
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        whiteSpace: 'nowrap'
                      }}>
                        {isIncrease ? <TrendingUp size={14} /> : isDecrease ? <TrendingDown size={14} /> : <Minus size={14} />}
                        <span>{isIncrease ? '+' : ''}{delta} {li.uom || ''}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(10, 10, 10, 0.4)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem'
            }}>
              <button
                onClick={() => setShowCoModal(false)}
                disabled={confirming}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.55rem 1.25rem',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  color: '#a1a1aa',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#e4e4e7'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'; }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowCoModal(false);
                  onConfirm();
                }}
                disabled={confirming}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.55rem 1.5rem',
                  background: '#F59E0B',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#000',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: '0 0 16px rgba(245, 158, 11, 0.25)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#d97706'; e.currentTarget.style.boxShadow = '0 0 24px rgba(245, 158, 11, 0.4)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#F59E0B'; e.currentTarget.style.boxShadow = '0 0 16px rgba(245, 158, 11, 0.25)'; }}
              >
                {confirming ? (
                  <><span className="upp-spinner" style={{ borderTopColor: '#000' }} /> Confirming...</>
                ) : (
                  <><CheckCircle2 size={15} /> Confirm Adjustments</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
