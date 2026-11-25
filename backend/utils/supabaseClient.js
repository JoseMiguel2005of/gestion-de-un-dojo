import { createClient } from '@supabase/supabase-js';
import { envConfig } from '../config/env.js';

const supabase = createClient(envConfig.supabaseUrl, envConfig.supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export default supabase;
