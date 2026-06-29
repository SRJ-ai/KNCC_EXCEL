import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://wjpmruxpwhcbmzaurcbq.supabase.co', process.env.SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@kncc.com',
    password: 'Password123!'
  });
  console.log('Result:', data, error);
}

test();
