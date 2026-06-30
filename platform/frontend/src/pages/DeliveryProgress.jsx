import React, { useMemo } from 'react';
import { Truck, MapPin, Search } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import './DeliveryProgress.css';

export default function DeliveryProgress() {
  const { materials } = usePlatform();

  const deliveries = [
    { id: 'SHP-9021', vendor: 'Cemex', material: 'Type II Cement (400 Bags)', origin: 'Plant B', destination: 'Gate 2', status: 'In Transit', progress: 65, color: '#3B82F6', eta: 'Today, 2:30 PM' },
    { id: 'SHP-9022', vendor: 'Nucor Steel', material: 'Rebar #5 (20 Tons)', origin: 'Mill 4', destination: 'Laydown Yard A', status: 'Arriving Soon', progress: 90, color: '#F59E0B', eta: 'Today, 11:15 AM' },
    { id: 'SHP-9023', vendor: 'Local Lumber Co', material: '2x4 Studs (800 pcs)', origin: 'Warehouse', destination: 'Gate 1', status: 'Delivered', progress: 100, color: '#10B981', eta: 'Delivered 8:00 AM' },
    { id: 'SHP-9024', vendor: 'Trane', material: 'RTU HVAC Units (2)', origin: 'Distribution Center', destination: 'Roof Hoist', status: 'In Transit', progress: 30, color: '#3B82F6', eta: 'Tomorrow, 9:00 AM' },
  ];

  // Derive some fulfillment stats from real materials for the chart
  const fulfillmentData = useMemo(() => {
    if (materials.length === 0) return [
      { name: 'Concrete', shipped: 400, pending: 200 },
      { name: 'Steel', shipped: 300, pending: 500 },
      { name: 'Lumber', shipped: 800, pending: 100 }
    ];
    
    const catMap = {};
    materials.forEach(m => {
      const cat = m.category || 'Other';
      if (!catMap[cat]) catMap[cat] = { name: cat, shipped: 0, pending: 0 };
      // mock a 70/30 split for demonstration since we don't have real ship status
      const qty = m.quantity || m.stock || 100;
      catMap[cat].shipped += Math.floor(qty * 0.7);
      catMap[cat].pending += Math.ceil(qty * 0.3);
    });
    return Object.values(catMap).slice(0, 5); // top 5 categories
  }, [materials]);

  const getStatusClass = (status) => {
    switch (status) {
      case 'In Transit': return 'status-transit';
      case 'Arriving Soon': return 'status-arriving';
      case 'Delivered': return 'status-delivered';
      default: return '';
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  return (
    <div className="delivery-container">
      <motion.div 
        className="delivery-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div>
          <h1 className="delivery-title">Delivery Progress</h1>
          <p style={{ color: '#a1a1aa', margin: 0 }}>Live tracking of inbound materials and fulfillment rates.</p>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={18} color="#a1a1aa" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="Track shipment..." 
            style={{ background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.75rem 1rem 0.75rem 2.5rem', color: '#fff', width: '250px' }}
          />
        </div>
      </motion.div>

      <motion.div 
        style={{ background: 'rgba(10,10,10,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h3 style={{ margin: '0 0 1rem 0', color: '#fff', fontWeight: 600 }}>Material Fulfillment by Category</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={fulfillmentData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis type="number" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} width={100} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
              itemStyle={{ color: '#fff' }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="shipped" name="Shipped/Received" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
            <Bar dataKey="pending" name="Pending/Backordered" stackId="a" fill="#3B82F6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      <motion.div 
        className="delivery-grid"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {deliveries.map(delivery => (
          <motion.div key={delivery.id} className="delivery-card" variants={itemVariants} whileHover={{ y: -4, scale: 1.01 }}>
            <div className="delivery-card-header">
              <div>
                <h3 className="delivery-id">
                  <Truck size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  {delivery.id}
                </h3>
                <span className="delivery-vendor">{delivery.vendor} - {delivery.material}</span>
              </div>
              <span className={`delivery-status ${getStatusClass(delivery.status)}`}>{delivery.status}</span>
            </div>

            <div className="delivery-details">
              <div className="detail-block">
                <span className="detail-label">Origin</span>
                <span className="detail-value">{delivery.origin}</span>
              </div>
              <div className="detail-block" style={{ textAlign: 'right' }}>
                <span className="detail-label">Destination</span>
                <span className="detail-value">
                  <MapPin size={14} color="#EF4444" style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  {delivery.destination}
                </span>
              </div>
            </div>

            <div className="progress-container">
              <div className="progress-header">
                <span>Progress: {delivery.progress}%</span>
                <span style={{ color: delivery.status === 'Delivered' ? '#10B981' : '#fff', fontWeight: 500 }}>ETA: {delivery.eta}</span>
              </div>
              <div className="progress-bar-bg">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${delivery.progress}%`, background: delivery.color, boxShadow: `0 0 10px ${delivery.color}` }}
                ></div>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
