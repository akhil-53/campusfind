import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

export const supabase = (env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY)
  ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  : null;
