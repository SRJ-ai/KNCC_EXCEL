const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wjpmruxpwhcbmzaurcbq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcG1ydXhwd2hjYm16YXVyY2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDYzMjcsImV4cCI6MjA5ODAyMjMyN30.N6gYkDaLBG3ZMWl2DSvuyrFipnuu4DOeu8YJRXhj9pk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function createDemoAccount() {
  const { data, error } = await supabase.auth.signUp({
    email: 'demo@kncc.com',
    password: 'Demo123!',
    options: {
      data: {
        name: 'Demo Engineer',
        organization_name: 'KNCC Demo Organization',
        role: 'admin'
      }
    }
  });

  if (error) {
    console.error('Error creating account:', error.message);
  } else {
    console.log('Account created successfully:', data.user?.email);
    console.log('If Email Confirmation is required, you must disable it in Supabase Dashboard -> Auth -> Providers -> Email -> Confirm email.');
  }
}

createDemoAccount();
