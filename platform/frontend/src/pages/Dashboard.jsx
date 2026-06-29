import React from 'react';
import { useAuth } from '../context/AuthContext';
import { usePlatform } from '../context/PlatformContext';
import { Activity, BarChart2, Package, TrendingUp, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();

  const { pos, invoices, cos, documents } = usePlatform();

  const totalPOAmount = pos.reduce((sum, po) => sum + Number(po.amount || 0), 0);
  const totalCOAmount = cos.reduce((sum, co) => sum + Number(co.cost || 0), 0);
  
  const kpis = [
    { title: 'Total POs (Live)', value: pos.length.toString(), trend: 'Active', isPositive: true, icon: <Package size={20} color="#3B82F6" />, bg: 'rgba(59, 130, 246, 0.1)' },
    { title: 'Total Spend ($)', value: `$${totalPOAmount.toLocaleString()}`, trend: 'In Budget', isPositive: true, icon: <TrendingUp size={20} color="#10B981" />, bg: 'rgba(16, 185, 129, 0.1)' },
    { title: 'CO Impact ($)', value: `$${totalCOAmount.toLocaleString()}`, trend: `${cos.length} COs`, isPositive: false, icon: <AlertCircle size={20} color="#F59E0B" />, bg: 'rgba(245, 158, 11, 0.1)' },
    { title: 'Cloud Documents', value: documents.length.toString(), trend: 'Live Sync', isPositive: true, icon: <CheckCircle2 size={20} color="#8B5CF6" />, bg: 'rgba(139, 92, 246, 0.1)' },
  ];

  // Create actual chart data from POs
  const chartData = pos.slice(-7).map((po, index) => ({
    name: `PO-${index + 1}`,
    amount: Number(po.amount) || 0
  }));

  // Map recent items to the activity feed
  const allActivities = [
    ...pos.map(po => ({ action: `PO Created: ${po.vendor} - $${po.amount}`, time: new Date(po.created_at || new Date()).toLocaleString(), color: '#3B82F6' })),
    ...cos.map(co => ({ action: `CO Submitted: ${co.title} - $${co.cost}`, time: new Date(co.created_at || new Date()).toLocaleString(), color: '#F59E0B' })),
    ...documents.map(doc => ({ action: `Document Uploaded: ${doc.file_name}`, time: new Date(doc.created_at || new Date()).toLocaleString(), color: '#8B5CF6' })),
    ...invoices.map(inv => ({ action: `Invoice Processed: $${inv.amount}`, time: new Date(inv.created_at || new Date()).toLocaleString(), color: '#10B981' }))
  ];

  // Sort by newest first and take top 5
  const activities = allActivities.sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5);

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Welcome back, {user?.name || 'Engineer'}</h1>
          <p className="dashboard-subtitle">Here is what is happening on site today.</p>
        </div>
        <button style={{
          padding: '0.75rem 1.5rem',
          background: 'linear-gradient(135deg, #F59E0B, #3B82F6)',
          border: 'none',
          borderRadius: '6px',
          color: '#fff',
          fontWeight: 600,
          cursor: 'pointer'
        }}>
          Generate Report
        </button>
      </div>

      {/* KPI Row */}
      <div className="kpi-grid">
        {kpis.map((kpi, index) => (
          <div key={index} className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-title">{kpi.title}</span>
              <div className="kpi-icon" style={{ background: kpi.bg }}>
                {kpi.icon}
              </div>
            </div>
            <div className="kpi-value">{kpi.value}</div>
            <div className={`kpi-trend ${kpi.isPositive ? 'trend-up' : 'trend-down'}`}>
              {kpi.trend} from last week
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-main-grid">
        {/* Main Chart Panel */}
        <div className="panel">
          <div className="panel-title">Recent Purchase Orders Amount ($)</div>
          <div className="live-chart" style={{ height: '250px', marginTop: '20px' }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                  <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ background: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px', color: '#fff' }} />
                  <Bar dataKey="amount" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa' }}>
                No PO data available to graph. Add some POs first!
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed Panel */}
        <div className="panel">
          <div className="panel-title">Recent Activity</div>
          <div className="activity-feed">
            {activities.length > 0 ? activities.map((activity, idx) => (
              <div key={idx} className="activity-item">
                <div className="activity-dot" style={{ background: activity.color }}></div>
                <div className="activity-content">
                  <p>{activity.action}</p>
                  <span className="activity-time">
                    <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {activity.time}
                  </span>
                </div>
              </div>
            )) : (
              <div style={{ color: '#a1a1aa', padding: '1rem' }}>No recent activity.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
