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
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Faltan las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Revisa tu archivo .env'
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
