import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePlatform } from '../context/PlatformContext';
import {
  Package, TrendingUp, AlertCircle, FileCheck,
  Download, Plus, ArrowUpRight, ArrowDownRight,
  Clock, ChevronRight, Activity, Layers, DollarSign,
  FileText
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie
} from 'recharts';
import * as XLSX from 'xlsx';
import { generateClientRequirementsExcel } from '../utils/excelExport';
import ManualEntryModal from '../components/ManualEntryModal';
import './Dashboard.css';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];

export default function Dashboard() {
  const { user } = useAuth();
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { pos, invoices, cos, documents, materials, activeProject, isDemoMode } = usePlatform();

  // ── Computed Metrics ──────────────────────────────────────────────────
  const totalPOValue   = pos.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalInvoiced  = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalCOImpact  = cos.reduce((s, c) => s + Number(c.amount || c.cost || 0), 0);
  const billedPct      = totalPOValue > 0 ? Math.round((totalInvoiced / totalPOValue) * 100) : 0;
  const pendingInvoices = invoices.filter(i => (i.status || '').toLowerCase() === 'pending').length;
  const approvedCOs    = cos.filter(c => (c.status || '').toLowerCase() === 'approved').length;

  // ── Chart Data ────────────────────────────────────────────────────────
  // Area chart: PO vs Invoice over time
  const areaData = pos.slice(0, 7).map((po, i) => ({
    name: po.po_number || `PO ${i + 1}`,
    po: Number(po.amount || 0),
    invoiced: Number(invoices[i]?.amount || 0),
  }));

  // Pie chart: spend breakdown
  const pieData = [
    { name: 'PO Value', value: totalPOValue },
    { name: 'Invoiced', value: totalInvoiced },
    { name: 'CO Impact', value: totalCOImpact },
  ].filter(d => d.value > 0);

  // Status breakdown bar chart
  const statusData = [
    { label: 'Approved COs', count: approvedCOs, color: '#10B981' },
    { label: 'Pending Invoices', count: pendingInvoices, color: '#F59E0B' },
    { label: 'Documents', count: documents.length, color: '#8B5CF6' },
    { label: 'Materials', count: materials.length, color: '#3B82F6' },
  ];

  // ── Activity Feed ─────────────────────────────────────────────────────
  const activities = [
    ...pos.map(p => ({ icon: <Package size={14}/>, label: `PO ${p.po_number || p.id}`, sub: `${p.supplier || p.vendor || 'Vendor'} · $${Number(p.amount||0).toLocaleString()}`, color: '#3B82F6', time: p.date || p.created_at })),
    ...invoices.map(i => ({ icon: <FileCheck size={14}/>, label: `Invoice ${i.invoice_number || i.id}`, sub: `${i.supplier||''} · $${Number(i.amount||0).toLocaleString()}`, color: '#10B981', time: i.date || i.created_at })),
    ...cos.map(c => ({ icon: <AlertCircle size={14}/>, label: `CO ${c.co_number || c.id}`, sub: `${c.description?.slice(0,40)||'Change Order'}…`, color: '#F59E0B', time: c.date || c.created_at })),
  ].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0)).slice(0, 6);

  // ── Export ────────────────────────────────────────────────────────────
  const handleExport = () => {
    setExporting(true);
    try {
      const wb = generateClientRequirementsExcel(activeProject, materials, pos, invoices, cos);
      XLSX.writeFile(wb, `KNCC_${(activeProject?.name||'Project').replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) { alert('Export failed: ' + err.message); }
    setExporting(false);
  };

  const fmt = (n) => `$${Number(n||0).toLocaleString()}`;

  const kpis = [
    {
      title: 'Total PO Value',
      value: fmt(totalPOValue),
      sub: `${pos.length} Purchase Orders`,
      icon: <Package size={22} />,
      gradient: 'from-blue to-blue-dim',
      accent: '#3B82F6',
      trend: '+12%',
      up: true,
    },
    {
      title: 'Total Invoiced',
      value: fmt(totalInvoiced),
      sub: `${billedPct}% of PO value billed`,
      icon: <FileCheck size={22} />,
      gradient: 'from-green to-green-dim',
      accent: '#10B981',
      trend: `${billedPct}%`,
      up: true,
    },
    {
      title: 'CO Impact',
      value: fmt(totalCOImpact),
      sub: `${cos.length} Change Orders`,
      icon: <AlertCircle size={22} />,
      gradient: 'from-amber to-amber-dim',
      accent: '#F59E0B',
      trend: `${approvedCOs} approved`,
      up: false,
    },
    {
      title: 'Budget Variance',
      value: fmt(Math.abs(totalPOValue - totalInvoiced)),
      sub: totalPOValue >= totalInvoiced ? 'Under budget ✓' : 'Over budget ⚠',
      icon: <DollarSign size={22} />,
      gradient: 'from-purple to-purple-dim',
      accent: totalPOValue >= totalInvoiced ? '#10B981' : '#EF4444',
      trend: totalPOValue >= totalInvoiced ? 'Healthy' : 'Review',
      up: totalPOValue >= totalInvoiced,
    },
  ];

  return (
    <div className="db-wrap">

      {/* ── Banner ─────────────────────────────────────────── */}
      <div className="db-banner animate-fade-in">
        <div className="db-banner-left">
          <div className="db-greeting">
            <span className="db-greeting-emoji">👋</span>
            <div>
              <h1 className="db-title">Welcome back, <span className="db-name">{user?.name || user?.email?.split('@')[0] || 'Engineer'}</span></h1>
              <p className="db-sub">
                <span className="db-project-badge">
                  <Layers size={13} /> {activeProject?.name || 'No Project'}
                  {isDemoMode && <span className="db-demo-tag">Demo</span>}
                </span>
                &nbsp;·&nbsp; {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
        <div className="db-banner-right">
          <button className="db-btn-ghost" onClick={() => setIsManualModalOpen(true)}>
            <Plus size={16} /> Manual Entry
          </button>
          <button className="db-btn-primary" onClick={handleExport} disabled={exporting}>
            <Download size={16} /> {exporting ? 'Generating…' : 'Export Report'}
          </button>
        </div>
      </div>

      <ManualEntryModal isOpen={isManualModalOpen} onClose={() => setIsManualModalOpen(false)} />

      {/* ── KPI Row ────────────────────────────────────────── */}
      <div className="db-kpi-grid">
        {kpis.map((k, i) => (
          <div key={i} className="db-kpi animate-fade-in" style={{ '--accent': k.accent, animationDelay: `${i * 60}ms` }}>
            <div className="db-kpi-top">
              <span className="db-kpi-label">{k.title}</span>
              <div className="db-kpi-icon" style={{ background: k.accent + '22', color: k.accent }}>
                {k.icon}
              </div>
            </div>
            <div className="db-kpi-value">{k.value}</div>
            <div className="db-kpi-footer">
              <span className="db-kpi-sub">{k.sub}</span>
              <span className={`db-kpi-trend ${k.up ? 'up' : 'down'}`}>
                {k.up ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>}
                {k.trend}
              </span>
            </div>
            <div className="db-kpi-bar" style={{ '--pct': `${Math.min(billedPct, 100)}%`, '--clr': k.accent }}></div>
          </div>
        ))}
      </div>

      {/* ── Main Grid ─────────────────────────────────────── */}
      <div className="db-main-grid">

        {/* Area Chart */}
        <div className="db-panel db-panel-wide animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="db-panel-header">
            <div>
              <h3 className="db-panel-title">PO vs Invoice Spend</h3>
              <p className="db-panel-sub">Purchase order value compared to invoiced amounts</p>
            </div>
            <div className="db-legend">
              <span className="db-legend-dot" style={{ background: '#3B82F6' }}></span>PO
              <span className="db-legend-dot" style={{ background: '#10B981' }}></span>Invoiced
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={areaData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gPO" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gInv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: '10px', color: '#fff', fontSize: 12 }} formatter={v => [`$${Number(v).toLocaleString()}`, '']} />
              <Area type="monotone" dataKey="po" stroke="#3B82F6" strokeWidth={2} fill="url(#gPO)" dot={{ fill: '#3B82F6', r: 3 }} />
              <Area type="monotone" dataKey="invoiced" stroke="#10B981" strokeWidth={2} fill="url(#gInv)" dot={{ fill: '#10B981', r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Spend Breakdown Pie */}
        <div className="db-panel animate-fade-in" style={{ animationDelay: '250ms' }}>
          <div className="db-panel-header">
            <div>
              <h3 className="db-panel-title">Spend Breakdown</h3>
              <p className="db-panel-sub">Financial distribution</p>
            </div>
          </div>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: '10px', color: '#fff', fontSize: 12 }} formatter={v => [`$${Number(v).toLocaleString()}`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="db-pie-legend">
                {pieData.map((d, i) => (
                  <div key={i} className="db-pie-row">
                    <span className="db-legend-dot" style={{ background: COLORS[i] }}></span>
                    <span className="db-pie-label">{d.name}</span>
                    <span className="db-pie-val">${Number(d.value).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="db-empty">No financial data yet</div>
          )}
        </div>

        {/* Status Bar Chart */}
        <div className="db-panel animate-fade-in" style={{ animationDelay: '300ms' }}>
          <div className="db-panel-header">
            <div>
              <h3 className="db-panel-title">Project Snapshot</h3>
              <p className="db-panel-sub">Item counts by category</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={statusData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <XAxis type="number" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: '10px', color: '#fff', fontSize: 12 }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Activity Feed */}
        <div className="db-panel db-panel-wide animate-fade-in" style={{ animationDelay: '350ms' }}>
          <div className="db-panel-header">
            <div>
              <h3 className="db-panel-title"><Activity size={16} style={{ display: 'inline', marginRight: 6 }} />Recent Activity</h3>
              <p className="db-panel-sub">Latest project events</p>
            </div>
          </div>
          <div className="db-activity">
            {activities.length > 0 ? activities.map((a, i) => (
              <div key={i} className="db-activity-row" style={{ animationDelay: `${350 + i * 50}ms` }}>
                <div className="db-activity-icon" style={{ background: a.color + '22', color: a.color }}>
                  {a.icon}
                </div>
                <div className="db-activity-body">
                  <span className="db-activity-label">{a.label}</span>
                  <span className="db-activity-sub">{a.sub}</span>
                </div>
                <div className="db-activity-time">
                  <Clock size={11} />
                  {a.time ? new Date(a.time).toLocaleDateString() : 'Recent'}
                </div>
              </div>
            )) : (
              <div className="db-empty">No activity yet. Upload a PO or invoice to get started.</div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="db-panel animate-fade-in" style={{ animationDelay: '400ms' }}>
          <div className="db-panel-header">
            <h3 className="db-panel-title">Quick Actions</h3>
          </div>
          <div className="db-quick-links">
            {[
              { label: 'Upload Documents', sub: 'POs, Invoices, COs', href: '/upload', color: '#3B82F6', icon: <FileText size={18}/> },
              { label: 'Reconcile Invoices', sub: `${pendingInvoices} pending`, href: '/reconciliation', color: '#F59E0B', icon: <FileCheck size={18}/> },
              { label: 'Export Excel', sub: 'Full project workbook', href: '/export', color: '#10B981', icon: <Download size={18}/> },
              { label: 'View POs & Invoices', sub: `${pos.length} POs · ${invoices.length} invoices`, href: '/vpos', color: '#8B5CF6', icon: <Package size={18}/> },
            ].map((link, i) => (
              <a key={i} href={link.href} className="db-quick-link" style={{ '--accent': link.color }}>
                <div className="db-quick-icon" style={{ background: link.color + '22', color: link.color }}>{link.icon}</div>
                <div className="db-quick-body">
                  <span className="db-quick-label">{link.label}</span>
                  <span className="db-quick-sub">{link.sub}</span>
                </div>
                <ChevronRight size={16} className="db-quick-chevron" />
              </a>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
