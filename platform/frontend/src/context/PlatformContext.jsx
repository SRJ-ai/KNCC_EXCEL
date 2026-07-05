import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../supabaseClient';

const PlatformContext = createContext(null);

export function PlatformProvider({ children }) {
  const { user, organization } = useAuth();
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(() => {
    const saved = localStorage.getItem('kncc_active_project');
    return saved ? JSON.parse(saved) : null;
  });
  const [pos, setPos] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [cos, setCos] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  // Keep localStorage in sync with state changes
  useEffect(() => {
    if (activeProject) {
      localStorage.setItem('kncc_active_project', JSON.stringify(activeProject));
    } else {
      localStorage.removeItem('kncc_active_project');
    }
  }, [activeProject]);

  const switchProject = (projectId) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    
    setActiveProject(proj);
    setPos([]); setInvoices([]); setCos([]); setDocuments([]); setMaterials([]);
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

        // Try fetching all real projects from Supabase
        const { data: projData, error: projErr } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });

        if (projErr) console.warn("Project fetch error (may be RLS):", projErr.message);

        if (projData && projData.length > 0) {
          setProjects(projData);
        } else {
          setProjects([]);
          setActiveProject(null);
        }
      } catch (err) {
        console.error("Failed to fetch platform data:", err);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const clearActiveProject = () => {
    setActiveProject(null);
    setPos([]); setInvoices([]); setCos([]); setDocuments([]); setMaterials([]);
  };

  useEffect(() => {
    if (!activeProject) return;
    
    const fetchProjectData = async () => {
      try {
        const pId = activeProject.id;
        const [posRes, invRes, cosRes, docsRes, matsRes] = await Promise.all([
          supabase.from('pos').select('*').eq('project_id', pId),
          supabase.from('invoices').select('*').eq('project_id', pId),
          supabase.from('cos').select('*').eq('project_id', pId),
          supabase.from('documents').select('*').eq('project_id', pId).order('created_at', { ascending: false }),
          supabase.from('materials').select('*').eq('project_id', pId),
        ]);

        if (posRes.data) setPos(posRes.data);
        if (invRes.data) setInvoices(invRes.data);
        if (cosRes.data) setCos(cosRes.data);
        if (docsRes.data) setDocuments(docsRes.data);
        if (matsRes.data) setMaterials(matsRes.data);
      } catch (err) {
        console.error("Failed to fetch project data:", err);
      }
    };
    fetchProjectData();
  }, [activeProject?.id]);

  const createProject = async (projectData) => {
    try {
      // Get the current session to get the token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      
      // Render uses VITE_BACKEND_URL, while older/local environments may use
      // VITE_API_URL. In production, fall back to the same-origin Vercel API.
      const backendUrl = (
        import.meta.env.VITE_BACKEND_URL ||
        import.meta.env.VITE_API_URL ||
        (import.meta.env.DEV ? 'http://localhost:8000' : '')
      ).replace(/\/$/, '');
      
      const res = await fetch(`${backendUrl}/api/projects/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(projectData)
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to create project: ${res.statusText}`);
      }
      
      const data = await res.json();
      setProjects(currentProjects => [data, ...currentProjects]);
      setActiveProject(data);
      return data;
    } catch (err) {
      console.error("Project creation failed:", err.message);
      throw err;
    }
  };

  const addPO = async (poData) => {
    const optimisticPO = { id: `local-po-${Date.now()}`, ...poData, project_id: activeProject?.id, created_at: new Date().toISOString() };
    setPos(prev => [...prev, optimisticPO]);
    try {
      const { data } = await supabase.from('pos').insert([{ ...poData, project_id: activeProject?.id }]).select().single();
      if (data) setPos(prev => prev.map(p => p.id === optimisticPO.id ? data : p));
    } catch (err) { console.warn("PO save failed:", err.message); }
  };

  const addInvoice = async (invoiceData) => {
    const optimisticInv = { id: `local-inv-${Date.now()}`, ...invoiceData, project_id: activeProject?.id, created_at: new Date().toISOString() };
    setInvoices(prev => [...prev, optimisticInv]);
    try {
      const { data } = await supabase.from('invoices').insert([{ ...invoiceData, project_id: activeProject?.id }]).select().single();
      if (data) setInvoices(prev => prev.map(i => i.id === optimisticInv.id ? data : i));
    } catch (err) { console.warn("Invoice save failed:", err.message); }
  };

  const addCO = async (coData) => {
    const optimisticCO = { id: coData.id || `local-co-${Date.now()}`, ...coData, project_id: activeProject?.id, created_at: new Date().toISOString() };
    setCos(prev => [...prev, optimisticCO]);
    try {
      const { data } = await supabase.from('cos').insert([{ ...coData, project_id: activeProject?.id }]).select().single();
      if (data) setCos(prev => prev.map(c => c.id === optimisticCO.id ? data : c));
    } catch (err) { console.warn("CO save failed:", err.message); }
  };

  const addMaterial = async (materialData) => {
    const optimisticMat = { id: `local-mat-${Date.now()}`, ...materialData, project_id: activeProject?.id };
    setMaterials(prev => [...prev, optimisticMat]);
    try {
      const { data } = await supabase.from('materials').insert([{ ...materialData, project_id: activeProject?.id }]).select().single();
      if (data) setMaterials(prev => prev.map(m => m.id === optimisticMat.id ? data : m));
    } catch (err) { console.warn("Material save failed:", err.message); }
  };

  const addDocument = async (docData) => {
    const optimisticDoc = { id: `local-doc-${Date.now()}`, ...docData, project_id: activeProject?.id, created_at: new Date().toISOString() };
    setDocuments(prev => [...prev, optimisticDoc]);
    try {
      const { data } = await supabase.from('documents').insert([{ ...docData, project_id: activeProject?.id }]).select().single();
      if (data) setDocuments(prev => prev.map(d => d.id === optimisticDoc.id ? data : d));
    } catch (err) { console.warn("Document save failed:", err.message); }
  };

  return (
    <PlatformContext.Provider value={{
      projects,
      activeProject,
      setActiveProject,
      switchProject,
      clearActiveProject,
      pos,
      invoices,
      cos,
      documents,
      materials,
      loading,
      createProject,
      addPO,
      addInvoice,
      addCO,
      addMaterial,
      addDocument
    }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  return useContext(PlatformContext);
}
