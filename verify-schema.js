import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Load them from .env before running this script.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

try {
  const { data, error } = await supabase.from('tests').select('duration_minutes').limit(1);
  if (error) {
    console.error('Supabase schema probe failed:', error);
    process.exitCode = 1;
  } else {
    console.log('Supabase schema probe succeeded: tests.duration_minutes is recognized.');
    console.log('Returned rows:', data);
  }
} catch (error) {
  console.error('Supabase schema probe threw an unexpected error:', error);
  process.exitCode = 1;
}
