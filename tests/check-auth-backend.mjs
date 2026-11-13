import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load .env.test
if (fs.existsSync('.env.test')) {
  process.loadEnvFile('.env.test');
}
if (fs.existsSync('.env')) {
  process.loadEnvFile('.env');
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ikbvkfainmepzvcljped.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_NcSq5ezTltrzNQ7zZRZi6Q_OO9_mCiw';

console.log('Testing Supabase direct connection at:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuth() {
  const adminEmail = process.env.TEST_ADMIN_EMAIL;
  const adminPassword = process.env.TEST_ADMIN_PASSWORD;
  const studentEmail = process.env.TEST_STUDENT_EMAIL;
  const studentPassword = process.env.TEST_STUDENT_PASSWORD;

  console.log('\n--- 1. Testing Admin Auth ---');
  console.log('Attempting login as:', adminEmail);
  const { data: adminData, error: adminErr } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword
  });

  if (adminErr) {
    console.error('Admin Sign-in FAILED:', adminErr.message, adminErr.status);
  } else {
    console.log('Admin Sign-in SUCCESS! User ID:', adminData.user.id);
    const { data: prof, error: profErr } = await supabase.from('profiles').select('*').eq('id', adminData.user.id).single();
    if (profErr) {
      console.error('Admin profile query error:', profErr);
    } else {
      console.log('Admin profile data:', JSON.stringify(prof, null, 2));
    }
  }

  console.log('\n--- 2. Testing Student Auth ---');
  console.log('Attempting login as:', studentEmail);
  const { data: studentData, error: studentErr } = await supabase.auth.signInWithPassword({
    email: studentEmail,
    password: studentPassword
  });

  if (studentErr) {
    console.error('Student Sign-in FAILED:', studentErr.message, studentErr.status);
  } else {
    console.log('Student Sign-in SUCCESS! User ID:', studentData.user.id);
    const { data: sprof, error: sprofErr } = await supabase.from('profiles').select('*').eq('id', studentData.user.id).single();
    if (sprofErr) {
      console.error('Student profile query error:', sprofErr);
    } else {
      console.log('Student profile data:', JSON.stringify(sprof, null, 2));
    }
  }
}

testAuth().catch(console.error);

