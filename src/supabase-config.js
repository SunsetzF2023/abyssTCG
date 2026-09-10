// ============================================================
// Supabase client configuration — shared with spire-climber project
//
// These are PUBLIC client-side values. The anon key is safe to expose
// because Row Level Security (RLS) policies control data access on the
// Supabase side. Do NOT use the service_role key here.
// ============================================================

const SUPABASE_URL = 'https://gwsggzowjibnwbnllctz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3c2dnem93amlibndibmxsY3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MDE2ODMsImV4cCI6MjEwMjA3NzY4M30.F5gsxD_CwyQ_txBzI6qb-RboTXioF5UaKJDCNRCVlH4';

/** @type {import('@supabase/supabase-js').SupabaseClient} */
export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { SUPABASE_URL, SUPABASE_ANON_KEY };
