import React from 'react';
import {
  X, CheckCircle2, AlertTriangle, Info, ArrowRight,
  FileText, Package, BarChart3, FileCheck
} from 'lucide-react';
import './UploadPreviewModal.css';

const TYPE_CONFIG = {
  ADD:        { color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', icon: <Package size={14}/>,    label: 'New Material' },
  INVOICE:    { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.35)', icon: <FileCheck size={14}/>,  label: 'Invoiced'     },
  NEW_CHARGE: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)', icon: <AlertTriangle size={14}/>, label: 'New Charge' },
  CO_ADD:     { color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)', icon: <BarChart3 size={14}/>,  label: 'CO Add'       },
  CO_REMOVE:  { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)',  icon: <BarChart3 size={14}/>,  label: 'CO Remove'    },
  CO_ADJUST:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)', icon: <BarChart3 size={14}/>,  label: 'CO Adjust'    },
  UNKNOWN:    { color: '#71717a', bg: 'rgba(113,113,122,0.12)', border: 'rgba(113,113,122,0.35)',icon: <Info size={14}/>,       label: 'Unknown'      },
};

function DocTypeBadge({ type }) {
  const map = { PO: '#3B82F6', INV: '#10B981', CO: '#F59E0B' };
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: (map[type] || '#52525b') + '22', color: map[type] || '#a1a1aa',
      border: `1px solid ${(map[type] || '#52525b')}44`,
      letterSpacing: '0.06em',
    }}>
      {type}
    </span>
  );
}

export default function UploadPreviewModal({ preview, onConfirm, onDiscard, confirming }) {
  if (!preview) return null;

  const { filename, doc_type, doc_number, doc_date, total_amount, tax,
          preview_items = [], duplicate_warning, summary, excel_available } = preview;

  const counts = preview_items.reduce((acc, item) => {
    acc[item.change_type] = (acc[item.change_type] || 0) + 1;
    return acc;
  }, {});

  const totalValue = preview_items.reduce((s, i) => s + (i.line_item?.amount || 0), 0);

  return (
    <div className="upm-overlay">
      <div className="upm-modal">

        {/* ── Header ── */}
        <div className="upm-header">
          <div className="upm-header-left">
            <div className="upm-file-icon">
              <FileText size={22} color="#3B82F6" />
            </div>
            <div>
              <div className="upm-title">Review Changes</div>
              <div className="upm-filename">{filename}</div>
            </div>
          </div>
          <div className="upm-header-right">
            <DocTypeBadge type={doc_type} />
            {doc_number && <span className="upm-docnum">#{doc_number}</span>}
            {doc_date && <span className="upm-docdate">{doc_date.split('T')[0]}</span>}
          </div>
        </div>

        {/* ── Duplicate Warning ── */}
        {duplicate_warning && (
          <div className="upm-warning">
            <AlertTriangle size={16} />
            {duplicate_warning}
          </div>
        )}

        {/* ── Summary Strip ── */}
        <div className="upm-summary-strip">
          <div className="upm-summary-text">
            <CheckCircle2 size={15} color="#10B981" />
            {summary}
          </div>
          <div className="upm-summary-meta">
            {excel_available && (
              <span className="upm-excel-badge">
                ✓ Mapped to Client_Requirments_Doc.xlsx
              </span>
            )}
            {totalValue > 0 && (
              <span className="upm-total">
                Total: ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </div>

        {/* ── Change Type Pills ── */}
        {Object.keys(counts).length > 0 && (
          <div className="upm-pills">
            {Object.entries(counts).map(([type, count]) => {
              const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.UNKNOWN;
              return (
                <span key={type} className="upm-pill" style={{
                  background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`
                }}>
                  {cfg.icon} {count} {cfg.label}
                </span>
              );
            })}
          </div>
        )}

        {/* ── Line Items Table ── */}
        <div className="upm-table-wrap">
          {preview_items.length === 0 ? (
            <div className="upm-empty">
              <Info size={32} color="#52525b" />
              <p>No line items were parsed from this document.</p>
              <p style={{ fontSize: 12, color: '#52525b' }}>
                This may be a scanned/image PDF. You can still confirm to record the document.
              </p>
            </div>
          ) : (
            <table className="upm-table">
              <thead>
                <tr>
                  <th>Change</th>
                  <th>Item / Description</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Amount</th>
                  <th>Matched Excel Row</th>
                </tr>
              </thead>
              <tbody>
                {preview_items.map((item, idx) => {
                  const cfg = TYPE_CONFIG[item.change_type] || TYPE_CONFIG.UNKNOWN;
                  const li = item.line_item;
                  return (
                    <tr key={idx} className="upm-row" style={{ '--row-color': cfg.color }}>
                      <td>
                        <span className="upm-change-badge" style={{
                          background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`
                        }}>
                          {cfg.icon}
                          {item.change_label}
                        </span>
                      </td>
                      <td>
                        <div className="upm-desc">
                          {li.item_code && <strong>{li.item_code}</strong>}
                          {li.description && <span>{li.description}</span>}
                          {li.dimensions && <span className="upm-dim">{li.dimensions}</span>}
                          {li.footage > 0 && <span className="upm-footage">{li.footage} {li.footage_uom || 'LF'}</span>}
                        </div>
                      </td>
                      <td>
                        <span style={{ color: item.change_type === 'CO_REMOVE' ? '#EF4444' : '#e4e4e7' }}>
                          {item.change_type === 'CO_ADD' && '+'}
                          {li.quantity?.toLocaleString() || 0} {li.uom}
                        </span>
                      </td>
                      <td style={{ color: '#a1a1aa' }}>
                        {li.unit_price > 0 ? `$${li.unit_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td style={{ color: cfg.color, fontWeight: 600 }}>
                        {li.amount > 0 ? `$${li.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td>
                        {item.excel_row_ref ? (
                          <span className="upm-excel-ref">
                            <ArrowRight size={11} />
                            {item.excel_row_ref}
                          </span>
                        ) : (
                          <span style={{ color: '#3f3f46', fontSize: 12 }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Totals Footer ── */}
        {(tax > 0 || total_amount > 0) && (
          <div className="upm-totals">
            {tax > 0 && <span>Tax: ${tax.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>}
            {total_amount > 0 && <strong>Total: ${total_amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>}
          </div>
        )}

        {/* ── Action Buttons ── */}
        <div className="upm-actions">
          <button
            className="upm-btn-discard"
            onClick={onDiscard}
            disabled={confirming}
          >
            <X size={16} /> Discard
          </button>
          <button
            className="upm-btn-confirm"
            onClick={onConfirm}
            disabled={confirming || !!duplicate_warning}
            title={duplicate_warning || undefined}
          >
            {confirming ? (
              <><span className="upm-spinner" /> Applying...</>
            ) : (
              <><CheckCircle2 size={16} /> Apply Changes</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
