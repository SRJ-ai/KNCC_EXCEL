import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '.env.production') });
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Anon Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function injectUsers() {
  console.log("Injecting real accounts into Supabase...");

  const users = [
    { email: 'admin@kncc.com', password: 'Password123!', name: 'KNCC Admin', role: 'admin' },
    { email: 'engineer@kncc.com', password: 'Password123!', name: 'Site Engineer', role: 'member' }
  ];

  for (const u of users) {
    console.log(`Attempting to sign up ${u.email}...`);
    const { data, error } = await supabase.auth.signUp({
      email: u.email,
      password: u.password,
      options: {
        data: {
          name: u.name,
          role: u.role,
          organization_name: 'KNCC'
        }
      }
    });

    if (error) {
      console.error(`Error creating ${u.email}:`, error.message);
    } else {
      console.log(`Success! Created account: ${u.email}`);
      if (data.session) {
        console.log(`Session established immediately (Email confirmation is likely disabled).`);
      } else {
        console.log(`No active session returned (Email confirmation might be required).`);
      }
    }
  }
}

injectUsers();
