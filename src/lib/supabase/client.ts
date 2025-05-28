import { createClient } from '@supabase/supabase-js';

// Check if required environment variables are set
if (!process.env.SUPABASE_URL) {
  throw new Error('Missing environment variable: SUPABASE_URL');
}

if (!process.env.SUPABASE_KEY) {
  throw new Error('Missing environment variable: SUPABASE_KEY');
}

// Create Supabase client
export const supabaseClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Export Supabase client for use in other modules
export default supabaseClient; 