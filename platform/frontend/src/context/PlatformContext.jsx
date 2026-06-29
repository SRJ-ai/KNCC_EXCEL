import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../supabaseClient';

const PlatformContext = createContext(null);

export function PlatformProvider({ children }) {
  const { user, organization } = useAuth();
  const [activeProject, setActiveProject] = useState(null);
  const [pos, setPos] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [cos, setCos] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Project
        const { data: projData, error: projErr } = await supabase
          .from('projects')
          .select('*')
          .eq('organization_name', organization.name)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (projErr) console.error("Error fetching project:", projErr);
        
        if (projData) {
          setActiveProject(projData);
          
          // Fetch POs
          const { data: poData } = await supabase.from('purchase_orders').select('*').eq('project_id', projData.id);
          if (poData) setPos(poData);

          // Fetch Invoices
          const { data: invData } = await supabase.from('invoices').select('*').eq('organization_name', organization.name);
          if (invData) setInvoices(invData);

          // Fetch COs
          const { data: coData } = await supabase.from('change_orders').select('*').eq('project_id', projData.id);
          if (coData) setCos(coData);

          // Fetch Documents
          const { data: docData } = await supabase.from('documents').select('*').eq('project_id', projData.id);
          if (docData) setDocuments(docData);

          // Fetch Materials
          const { data: matData } = await supabase.from('materials').select('*').eq('project_id', projData.id);
          if (matData) setMaterials(matData);
        }
      } catch (err) {
        console.error("Failed to fetch platform data", err);
      }
      setLoading(false);
    };

    if (user && organization) {
      fetchData();
    } else {
      setActiveProject(null);
      setPos([]);
      setInvoices([]);
      setCos([]);
      setDocuments([]);
      setMaterials([]);
    }
  }, [user, organization]);

  const createProject = async (projectData) => {
    const newProject = { 
      ...projectData, 
      organization_name: organization.name 
    };
    const { data } = await supabase.from('projects').insert([newProject]).select().single();
    if (data) setActiveProject(data);
  };

  const addPO = async (poData) => {
    const newPO = { 
      ...poData, 
      project_id: activeProject.id, 
      organization_name: organization.name 
    };
    const { data } = await supabase.from('purchase_orders').insert([newPO]).select().single();
    if (data) setPos(prev => [...prev, data]);
  };

  const addInvoice = async (invoiceData) => {
    const newInvoice = { 
      ...invoiceData, 
      organization_name: organization.name 
    };
    const { data } = await supabase.from('invoices').insert([newInvoice]).select().single();
    if (data) setInvoices(prev => [...prev, data]);
  };

  const addCO = async (coData) => {
    const newCO = {
      ...coData,
      id: coData.id || `CO-${Math.floor(Math.random() * 1000)}`,
      project_id: activeProject?.id,
      organization_name: organization.name
    };
    const { data, error } = await supabase.from('change_orders').insert(newCO).select().single();
    if (error) console.error("Error adding CO", error);
    else setCos([...cos, data]);
  };

  const addMaterial = async (materialData) => {
    const newMaterial = {
      ...materialData,
      project_id: activeProject?.id,
      organization_name: organization.name
    };
    const { data, error } = await supabase.from('materials').insert(newMaterial).select().single();
    if (error) console.error("Error adding material", error);
    else setMaterials([...materials, data]);
  };

  const addDocument = async (docData) => {
    const newDoc = { 
      ...docData, 
      project_id: activeProject.id, 
      organization_name: organization.name 
    };
    const { data } = await supabase.from('documents').insert([newDoc]).select().single();
    if (data) setDocuments(prev => [...prev, data]);
  };

  return (
    <PlatformContext.Provider value={{
      activeProject, createProject,
      documents, addDocument,
      pos, addPO,
      invoices, addInvoice,
      cos, addCO,
      materials, addMaterial,
      loading
    }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  return useContext(PlatformContext);
}
