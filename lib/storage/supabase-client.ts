import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { StorageConfigurationError } from './drivers';

export const SUPABASE_UPLOADS_BUCKET = 'uploads';

interface SupabaseGlobals {
  __aviatorSupabaseClient?: SupabaseClient;
  __aviatorSupabaseConfig?: string;
}

const supabaseGlobals = globalThis as typeof globalThis & SupabaseGlobals;

function getSupabaseConfig(): { url: string; serviceRoleKey: string } {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new StorageConfigurationError(
      'Supabase receipt storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Set both as server-only environment variables, then redeploy.',
    );
  }

  return { url, serviceRoleKey };
}

/**
 * Returns a cached server-side Supabase client for the private uploads bucket.
 * The service-role key must never be exposed through a NEXT_PUBLIC_ variable.
 */
export function getSupabaseClient(): SupabaseClient {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const configKey = `${url}\0${serviceRoleKey}`;

  if (
    !supabaseGlobals.__aviatorSupabaseClient ||
    supabaseGlobals.__aviatorSupabaseConfig !== configKey
  ) {
    supabaseGlobals.__aviatorSupabaseClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    supabaseGlobals.__aviatorSupabaseConfig = configKey;
  }

  return supabaseGlobals.__aviatorSupabaseClient;
}
