import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../supabaseClient';

const PlatformContext = createContext(null);

// Hardcoded demo data for Client Projects
const DEMO_PROJECTS = [
  {
    id: 'demo-cobia-1',
    name: 'Cobia Cove Appartments',
    status: 'In Progress',
    location: 'Cobia Cove',
    client: 'KNCC Development Corp',
    budget: 1500000,
    created_at: '2025-01-01T00:00:00Z',
    tax_rate: 1.0825
  },
  {
    id: 'demo-willow-2',
    name: 'Willow Way Apts',
    status: 'In Progress',
    location: 'Willow Way Village',
    client: 'KNCC Development Corp',
    budget: 850000,
    created_at: '2025-01-01T00:00:00Z',
    tax_rate: 1.0825
  }
];

const DEMO_POS = [
  { id: 'po-c1', po_number: 'PO-COBIA-001', project_id: 'demo-cobia-1', supplier: 'Lumber Supply Co', vendor: 'Lumber Supply Co', amount: 85000, status: 'Approved', date: '2025-08-01', description: 'Framing Package' },
  { id: 'po-w1', po_number: 'PO-WILLOW-001', project_id: 'demo-willow-2', supplier: 'Lumber Supply Co', vendor: 'Lumber Supply Co', amount: 45000, status: 'Approved', date: '2025-10-01', description: 'Framing Package' },
];

const DEMO_INVOICES = [
  { id: 'inv-c1', invoice_number: 'INV-46098', project_id: 'demo-cobia-1', po_id: 'po-c1', supplier: 'Lumber Supply Co', amount: 25000, status: 'Paid', date: '2025-09-01' },
  { id: 'inv-w1', invoice_number: 'INV-45968', project_id: 'demo-willow-2', po_id: 'po-w1', supplier: 'Lumber Supply Co', amount: 15000, status: 'Paid', date: '2025-11-01' },
];

const DEMO_COS = [
  // Cobia COs
  { id: 'CO-C-01', co_number: 'CO 09.17.2025', description: 'Change order 09.17', amount: 500, cost: 500, status: 'Approved', project_id: 'demo-cobia-1', date: '2025-09-17', title: 'CO 09.17.2025' },
  { id: 'CO-C-02', co_number: 'CO 11.11.2025', description: 'Change order 11.11', amount: 800, cost: 800, status: 'Approved', project_id: 'demo-cobia-1', date: '2025-11-11', title: 'CO 11.11.2025' },
  { id: 'CO-C-03', co_number: 'CO 12.29.2025', description: 'Change order 12.29', amount: 1200, cost: 1200, status: 'Approved', project_id: 'demo-cobia-1', date: '2025-12-29', title: 'CO 12.29.2025' },
  // Willow COs
  { id: 'CO-W-01', co_number: 'CO 11.21.2025', description: 'Change order 11.21', amount: 450, cost: 450, status: 'Approved', project_id: 'demo-willow-2', date: '2025-11-21', title: 'CO 11.21.2025' },
  { id: 'CO-W-02', co_number: 'CO 11.24.2025', description: 'Change order 11.24', amount: 950, cost: 950, status: 'Approved', project_id: 'demo-willow-2', date: '2025-11-24', title: 'CO 11.24.2025' },
  { id: 'CO-W-03', co_number: 'CO 12.08.2025', description: 'Change order 12.08', amount: 320, cost: 320, status: 'Approved', project_id: 'demo-willow-2', date: '2025-12-08', title: 'CO 12.08.2025' },
];

const DEMO_MATERIALS = [
  // Cobia Materials
  { id: 'mat-c1', item_code: 'SYP #2', description: 'Lumber', quantity: 717, uom: 'pcs', unit_price: 435, amount: 717 * 435, footage: '12', dimensions: '2x6', source_document: 'po-c1', project_id: 'demo-cobia-1' },
  { id: 'mat-c2', item_code: 'SYP #2', description: 'Lumber', quantity: 231, uom: 'pcs', unit_price: 435, amount: 231 * 435, footage: '14', dimensions: '2x6', source_document: 'po-c1', project_id: 'demo-cobia-1' },
  { id: 'mat-c3', item_code: 'SYP #2', description: 'Lumber', quantity: 404, uom: 'pcs', unit_price: 435, amount: 404 * 435, footage: '16', dimensions: '2x6', source_document: 'po-c1', project_id: 'demo-cobia-1' },
  { id: 'mat-c4', item_code: 'SYP #2 PET', description: 'Lumber', quantity: 9177, uom: 'pcs', unit_price: 525, amount: 9177 * 525, footage: '104-5/8', dimensions: '2x6', source_document: 'po-c1', project_id: 'demo-cobia-1' },
  
  // Willow Materials
  { id: 'mat-w1', item_code: 'PT', description: 'Lumber', quantity: 5, uom: 'pcs', unit_price: 1145, amount: 5 * 1145, footage: '10', dimensions: '2x6', source_document: 'po-w1', project_id: 'demo-willow-2' },
  { id: 'mat-w2', item_code: 'PT', description: 'Lumber', quantity: 2922, uom: 'pcs', unit_price: 785, amount: 2922 * 785, footage: '1', dimensions: '2x4', source_document: 'po-w1', project_id: 'demo-willow-2' },
  { id: 'mat-w3', item_code: 'PT', description: 'Lumber', quantity: 5, uom: 'pcs', unit_price: 785, amount: 5 * 785, footage: '10', dimensions: '2x4', source_document: 'po-w1', project_id: 'demo-willow-2' },
];

export function PlatformProvider({ children }) {
  const { user, organization } = useAuth();
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [pos, setPos] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [cos, setCos] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const loadDemoProject = (project) => {
    setIsDemoMode(true);
    setActiveProject(project);
    setPos(DEMO_POS.filter(p => p.project_id === project.id));
    setInvoices(DEMO_INVOICES.filter(i => i.project_id === project.id));
    setCos(DEMO_COS.filter(c => c.project_id === project.id));
    setDocuments([]);
    setMaterials(DEMO_MATERIALS.filter(m => m.project_id === project.id));
  };

  const switchProject = (projectId) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    
    if (isDemoMode) {
      loadDemoProject(proj);
    } else {
      // In a real app we'd fetch the data for the new project from Supabase here.
      // For this prototype, if it's not demo mode, we just set the active project.
      setActiveProject(proj);
      setPos([]); setInvoices([]); setCos([]); setDocuments([]); setMaterials([]);
    }
  };

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
          setProjects([projData]);
          setActiveProject(projData);

          const [poRes, invRes, coRes, docRes, matRes] = await Promise.all([
            supabase.from('pos').select('*').eq('project_id', projData.id),
            supabase.from('invoices').select('*').eq('project_id', projData.id),
            supabase.from('cos').select('*').eq('project_id', projData.id),
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
          console.log("No project found. Loading Cobia Cove demo.");
          setProjects(DEMO_PROJECTS);
          loadDemoProject(DEMO_PROJECTS[0]);
        }
      } catch (err) {
        console.error("Failed to fetch platform data, falling back to demo:", err);
        setProjects(DEMO_PROJECTS);
        loadDemoProject(DEMO_PROJECTS[0]);
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
        const { data } = await supabase.from('pos').insert([{ ...poData, project_id: activeProject?.id }]).select().single();
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
        const { data } = await supabase.from('cos').insert([{ ...coData, project_id: activeProject?.id }]).select().single();
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
      projects,
      activeProject,
      setActiveProject,
      switchProject,
      pos,
      invoices,
      cos,
      documents,
      materials,
      loading,
      isDemoMode,
      createProject,
      addPO,
      addInvoice,
      addCO,
      addMaterial
    }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  return useContext(PlatformContext);
}
