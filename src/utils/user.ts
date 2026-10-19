import { User } from '@supabase/supabase-js';

/** Nombre visible del usuario (full_name del perfil) con fallback genérico. */
export function getUserDisplayName(user: User | null): string {
  const name = (user?.user_metadata?.full_name as string) ?? '';
  return name.trim() || 'Usuario';
}
