import { createClient } from '@supabase/supabase-js';

// Supabase anon key is a PUBLIC key — safe to embed in client code.
// It is secured by Row Level Security (RLS) policies on the database.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wjpmruxpwhcbmzaurcbq.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcG1ydXhwd2hjYm16YXVyY2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDYzMjcsImV4cCI6MjA5ODAyMjMyN30.N6gYkDaLBG3ZMWl2DSvuyrFipnuu4DOeu8YJRXhj9pk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
