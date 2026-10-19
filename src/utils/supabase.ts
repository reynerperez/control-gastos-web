import { createClient } from '@supabase/supabase-js'

/**
 * utils/supabase.ts
 *
 * Cliente de Supabase para el navegador. Apunta al MISMO proyecto,
 * mismas tablas y RLS que la app móvil.
 *
 * Diferencias con el cliente móvil:
 * - Sin AsyncStorage ni AppState: en web el SDK usa localStorage por
 *   defecto y refresca el token automáticamente.
 * - detectSessionInUrl activo para poder confirmar correo / magic links.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
// Supabase renombró la clave pública a "publishable key". Aceptamos ambos
// nombres para que desarrollo (anon) y producción (publishable) funcionen.
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (o VITE_SUPABASE_PUBLISHABLE_KEY). Revisa tu archivo .env'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})
