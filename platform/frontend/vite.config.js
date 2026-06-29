import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Fallback: manually load Vercel env file from root if it exists
  const vercelEnvPath = path.resolve(process.cwd(), '../../.vercel/.env.production.local');
  if (fs.existsSync(vercelEnvPath)) {
    console.log("Loading Vercel env file from root:", vercelEnvPath);
    const envContent = fs.readFileSync(vercelEnvPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#')) {
        const [key, ...valParts] = line.split('=');
        if (key && key.startsWith('VITE_') && !process.env[key]) {
          let val = valParts.join('=').trim();
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1);
          }
          process.env[key] = val;
        }
      }
    }
  }

  // Load normal Vite envs
  const env = loadEnv(mode, process.cwd());
  
  console.log("Loaded VITE_SUPABASE_URL during build:", env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL);

  return {
    plugins: [react()],
    define: {
      // Explicitly define if process.env has them but loadEnv didn't pick them up
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY),
    }
  };
});
