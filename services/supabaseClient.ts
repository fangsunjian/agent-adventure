import { createClient } from '@supabase/supabase-js';

// Instructions:
// 1. Go to your Supabase project dashboard.
// 2. Navigate to Settings > API.
// 3. Copy the 'Project URL' and paste it below.
// 4. Copy the 'Project API Key' (the public, anon key) and paste it below.

const supabaseUrl = "https://gfupalrefrtsghidecjt.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdXBhbHJlZnJ0c2doaWRlY2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzODI3NjgsImV4cCI6MjA3MTk1ODc2OH0.phdoLraVKKaYh24vkxvPYL7x2a2rhwdflnZfpH8FWFs";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);