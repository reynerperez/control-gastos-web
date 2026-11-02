import type { User } from '@supabase/supabase-js';

import type { HouseholdMember } from '@/types';
import { getUserDisplayName } from '@/utils/user';

/**
 * Nombre del autor real de un movimiento dentro del espacio compartido.
 * El hogar comparte movimientos en web y móvil; se distingue quién los registró.
 */
export function getTransactionAuthorName(
  userId: string | null | undefined,
  currentUser: User | null,
  members: HouseholdMember[]
): string {
  if (!userId || userId === currentUser?.id) {
    return getUserDisplayName(currentUser);
  }
  const member = members.find((entry) => entry.user_id === userId);
  return member?.profile?.full_name?.trim() || 'Miembro del espacio';
}
