import { createClient } from '@supabase/supabase-js';

// Instructions:
// 1. Go to your Supabase project dashboard.
// 2. Navigate to Settings > API.
// 3. Copy the 'Project URL' and paste it below.
// 4. Copy the 'Project API Key' (the public, anon key) and paste it below.

const supabaseUrl = "https://optogbhbrfvxqrurqzml.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wdG9nYmhicmZ2eHFydXJxem1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxMzE2NzgsImV4cCI6MjA3MTcwNzY3OH0.yyrXaTakJevFoIMqZHgzAnl_CmKh2fcfjdcLpXhWRM0";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);