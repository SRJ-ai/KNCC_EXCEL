import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../supabaseClient';

const PlatformContext = createContext(null);

// Hardcoded demo data for Willow Way Village
const DEMO_PROJECT = {
  id: 'demo-wwv-123',
  name: 'Willow Way Village',
  status: 'In Progress',
  location: '123 Willow Way, Springfield',
  client: 'KNCC Development Corp',
  budget: 500000,
  created_at: '2023-01-01T00:00:00Z'
};

const DEMO_POS = [
  { id: 'po-1', po_number: 'PO-WWV-001', project_id: 'demo-wwv-123', supplier: 'ABC Construction Supplies', vendor: 'ABC Construction Supplies', amount: 50000, status: 'Approved', date: '2023-01-15', description: 'Concrete & Masonry Materials' },
  { id: 'po-2', po_number: 'PO-WWV-002', project_id: 'demo-wwv-123', supplier: 'SteelCore Inc', vendor: 'SteelCore Inc', amount: 35000, status: 'Approved', date: '2023-02-01', description: 'Structural Steel Beams' },
];

const DEMO_INVOICES = [
  { id: 'inv-1', invoice_number: 'INV-001', project_id: 'demo-wwv-123', po_id: 'po-1', supplier: 'ABC Construction Supplies', amount: 15000, status: 'Paid', date: '2023-02-10' },
  { id: 'inv-2', invoice_number: 'INV-002', project_id: 'demo-wwv-123', po_id: 'po-1', supplier: 'ABC Construction Supplies', amount: 20000, status: 'Pending', date: '2023-03-25' },
  { id: 'inv-3', invoice_number: 'INV-003', project_id: 'demo-wwv-123', po_id: 'po-2', supplier: 'SteelCore Inc', amount: 35000, status: 'Paid', date: '2023-03-10' },
];

const DEMO_COS = [
  { id: 'CO-WWV-01', co_number: 'CO-001', description: 'Upgraded landscaping for common areas', amount: 5000, cost: 5000, status: 'Approved', project_id: 'demo-wwv-123', date: '2023-04-05', title: 'Landscaping Upgrade' },
  { id: 'CO-WWV-02', co_number: 'CO-002', description: 'Additional street lighting required by city', amount: 8500, cost: 8500, status: 'Pending', project_id: 'demo-wwv-123', date: '2023-05-12', title: 'Street Lighting Addition' },
];

const DEMO_MATERIALS = [
  { id: 'mat-1', item_code: 'CON-001', description: 'Portland Cement Type II', quantity: 200, uom: 'bags', unit_price: 15, amount: 3000, footage: 0, dimensions: 'N/A', source_document: 'PO-WWV-001', project_id: 'demo-wwv-123' },
  { id: 'mat-2', item_code: 'STL-001', description: 'Rebar #5 Grade 60', quantity: 500, uom: 'lf', unit_price: 12, amount: 6000, footage: 500, dimensions: '5/8" dia', source_document: 'PO-WWV-002', project_id: 'demo-wwv-123' },
];

export function PlatformProvider({ children }) {
  const { user, organization } = useAuth();
  const [activeProject, setActiveProject] = useState(null);
  const [pos, setPos] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [cos, setCos] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (!user) {
          // Not logged in - clear everything
          setActiveProject(null);
          setPos([]); setInvoices([]); setCos([]); setDocuments([]); setMaterials([]);
          setLoading(false);
          return;
        }

        // Try fetching a real project from Supabase
        // Projects are scoped to the auth user via RLS
        const { data: projData, error: projErr } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (projErr) console.warn("Project fetch error (may be RLS):", projErr.message);

        if (projData) {
          setIsDemoMode(false);
          setActiveProject(projData);

          const [poRes, invRes, coRes, docRes, matRes] = await Promise.all([
            supabase.from('purchase_orders').select('*').eq('project_id', projData.id),
            supabase.from('invoices').select('*').eq('project_id', projData.id),
            supabase.from('change_orders').select('*').eq('project_id', projData.id),
            supabase.from('documents').select('*').eq('project_id', projData.id),
            supabase.from('materials').select('*').eq('project_id', projData.id),
          ]);

          if (poRes.data) setPos(poRes.data);
          if (invRes.data) setInvoices(invRes.data);
          if (coRes.data) setCos(coRes.data);
          if (docRes.data) setDocuments(docRes.data);
          if (matRes.data) setMaterials(matRes.data);
        } else {
          // No project found → load demo data automatically
          console.log("No project found. Loading Willow Way Village demo.");
          setIsDemoMode(true);
          setActiveProject(DEMO_PROJECT);
          setPos(DEMO_POS);
          setInvoices(DEMO_INVOICES);
          setCos(DEMO_COS);
          setDocuments([]);
          setMaterials(DEMO_MATERIALS);
        }
      } catch (err) {
        console.error("Failed to fetch platform data, falling back to demo:", err);
        setIsDemoMode(true);
        setActiveProject(DEMO_PROJECT);
        setPos(DEMO_POS);
        setInvoices(DEMO_INVOICES);
        setCos(DEMO_COS);
        setDocuments([]);
        setMaterials(DEMO_MATERIALS);
      }
      setLoading(false);
    };

    fetchData();
  }, [user, organization]);

  const createProject = async (projectData) => {
    // In demo mode or if DB insert fails, just set locally
    try {
      const { data, error } = await supabase.from('projects').insert([projectData]).select().single();
      if (data) {
        setIsDemoMode(false);
        setActiveProject(data);
        setPos([]); setInvoices([]); setCos([]); setDocuments([]); setMaterials([]);
        return;
      }
      if (error) throw error;
    } catch (err) {
      console.warn("DB project creation failed, using local state:", err.message);
    }
    // Fallback to local state
    setIsDemoMode(false);
    setActiveProject({ id: `local-${Date.now()}`, ...projectData, created_at: new Date().toISOString() });
    setPos([]); setInvoices([]); setCos([]); setDocuments([]); setMaterials([]);
  };

  const addPO = async (poData) => {
    const optimisticPO = { id: `local-po-${Date.now()}`, ...poData, project_id: activeProject?.id, created_at: new Date().toISOString() };
    setPos(prev => [...prev, optimisticPO]);
    if (!isDemoMode) {
      try {
        const { data } = await supabase.from('purchase_orders').insert([{ ...poData, project_id: activeProject?.id }]).select().single();
        if (data) setPos(prev => prev.map(p => p.id === optimisticPO.id ? data : p));
      } catch (err) { console.warn("PO save failed:", err.message); }
    }
  };

  const addInvoice = async (invoiceData) => {
    const optimisticInv = { id: `local-inv-${Date.now()}`, ...invoiceData, project_id: activeProject?.id, created_at: new Date().toISOString() };
    setInvoices(prev => [...prev, optimisticInv]);
    if (!isDemoMode) {
      try {
        const { data } = await supabase.from('invoices').insert([{ ...invoiceData, project_id: activeProject?.id }]).select().single();
        if (data) setInvoices(prev => prev.map(i => i.id === optimisticInv.id ? data : i));
      } catch (err) { console.warn("Invoice save failed:", err.message); }
    }
  };

  const addCO = async (coData) => {
    const optimisticCO = { id: coData.id || `local-co-${Date.now()}`, ...coData, project_id: activeProject?.id, created_at: new Date().toISOString() };
    setCos(prev => [...prev, optimisticCO]);
    if (!isDemoMode) {
      try {
        const { data } = await supabase.from('change_orders').insert([{ ...coData, project_id: activeProject?.id }]).select().single();
        if (data) setCos(prev => prev.map(c => c.id === optimisticCO.id ? data : c));
      } catch (err) { console.warn("CO save failed:", err.message); }
    }
  };

  const addMaterial = async (materialData) => {
    const optimisticMat = { id: `local-mat-${Date.now()}`, ...materialData, project_id: activeProject?.id };
    setMaterials(prev => [...prev, optimisticMat]);
    if (!isDemoMode) {
      try {
        const { data } = await supabase.from('materials').insert([{ ...materialData, project_id: activeProject?.id }]).select().single();
        if (data) setMaterials(prev => prev.map(m => m.id === optimisticMat.id ? data : m));
      } catch (err) { console.warn("Material save failed:", err.message); }
    }
  };

  const addDocument = async (docData) => {
    const optimisticDoc = { id: `local-doc-${Date.now()}`, ...docData, project_id: activeProject?.id, created_at: new Date().toISOString() };
    setDocuments(prev => [...prev, optimisticDoc]);
    if (!isDemoMode) {
      try {
        const { data } = await supabase.from('documents').insert([{ ...docData, project_id: activeProject?.id }]).select().single();
        if (data) setDocuments(prev => prev.map(d => d.id === optimisticDoc.id ? data : d));
      } catch (err) { console.warn("Document save failed:", err.message); }
    }
  };

  return (
    <PlatformContext.Provider value={{
      activeProject, createProject,
      documents, addDocument,
      pos, addPO,
      invoices, addInvoice,
      cos, addCO,
      materials, addMaterial,
      loading,
      isDemoMode
    }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  return useContext(PlatformContext);
}
