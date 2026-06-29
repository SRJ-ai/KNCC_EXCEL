import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wjpmruxpwhcbmzaurcbq.supabase.co';
// Using the anon key from the user's project
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcG1ydXhwd2hjYm16YXVyY2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDYzMjcsImV4cCI6MjA5ODAyMjMyN30.N6gYkDaLBG3ZMWl2DSvuyrFipnuu4DOeu8YJRXhj9pk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function seed() {
  console.log("Logging in as Admin...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@kncc.com',
    password: 'Password123!'
  });

  if (authErr) {
    console.error("Login failed:", authErr);
    return;
  }
  
  const orgName = authData.user.user_metadata?.organization_name || 'KNCC';
  console.log("Logged in! Org:", orgName);

  // 1. Create Project
  console.log("Creating Project...");
  const { data: projData, error: projErr } = await supabase.from('projects').insert([{
    name: 'Willow Way Village',
    status: 'In Progress'
  }]).select().single();

  if (projErr) {
    console.error("Error creating project:", projErr);
    return;
  }
  const projectId = projData.id;
  console.log("Project created:", projectId);

  // 2. Create Purchase Order
  console.log("Creating PO...");
  const { data: poData, error: poErr } = await supabase.from('purchase_orders').insert([{
    po_number: 'PO-WWV-001',
    project_id: projectId,
    organization_name: orgName,
    supplier: 'ABC Construction Supplies',
    amount: 50000.00,
    status: 'Approved',
    date: '2023-01-15'
  }]).select().single();
  
  if (poErr) console.error("PO Error:", poErr);
  
  // 3. Create Invoices
  console.log("Creating Invoices...");
  const invoices = [
    {
      invoice_number: 'INV-001',
      project_id: projectId,
      po_id: poData?.id,
      organization_name: orgName,
      supplier: 'ABC Construction Supplies',
      amount: 15000.00,
      status: 'Paid',
      date: '2023-02-10'
    },
    {
      invoice_number: 'INV-002',
      project_id: projectId,
      po_id: poData?.id,
      organization_name: orgName,
      supplier: 'ABC Construction Supplies',
      amount: 20000.00,
      status: 'Pending',
      date: '2023-03-25'
    }
  ];
  const { error: invErr } = await supabase.from('invoices').insert(invoices);
  if (invErr) console.error("Invoice Error:", invErr);

  // 4. Create Change Orders
  console.log("Creating Change Orders...");
  const cos = [
    {
      id: 'CO-WWV-01',
      description: 'Upgraded landscaping for common areas',
      amount: 5000.00,
      status: 'Approved',
      project_id: projectId,
      organization_name: orgName,
      date: '2023-04-05'
    },
    {
      id: 'CO-WWV-02',
      description: 'Additional street lighting required by city',
      amount: 8500.00,
      status: 'Pending',
      project_id: projectId,
      organization_name: orgName,
      date: '2023-05-12'
    }
  ];
  const { error: coErr } = await supabase.from('change_orders').insert(cos);
  if (coErr) console.error("CO Error:", coErr);
  
  console.log("Seed complete! You can now log in to the app to see Willow Way Village.");
}

seed();
