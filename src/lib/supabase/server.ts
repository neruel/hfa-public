import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client using Service Role key
// Fallbacks prevent build-time static evaluation errors when env vars are injected at runtime
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

export const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
