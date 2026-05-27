/**
 * UNIQN Mobile - Supabase JobPosting Repository Settlement Helpers
 *
 * @description 정산 설정 업데이트 시 역할 카탈로그 병합/정규화 헬퍼
 */

import type { PostingRoleCatalogEntry } from '@/types';
import type { StaffRole } from '@/types/role';

export type SettlementRolePayload = {
  role?: PostingRoleCatalogEntry['role'];
  name?: string;
  customRole?: string;
  salary?: PostingRoleCatalogEntry['salary'];
};

export function settlementRoleKey(r: {
  role?: string;
  name?: string;
  customRole?: string;
}): string {
  const id = r.role ?? r.name ?? '';
  return id === 'other' && r.customRole ? `other:${r.customRole}` : id;
}

export function mergeSettlementRoles(
  base: PostingRoleCatalogEntry[],
  incoming: Record<string, unknown>[]
): PostingRoleCatalogEntry[] {
  const typed = incoming as SettlementRolePayload[];
  if (base.length === 0) {
    return typed.map((r) => ({
      role: (r.role ?? r.name ?? 'dealer') as StaffRole | 'other',
      ...(r.customRole ? { customRole: r.customRole } : {}),
      ...(r.salary ? { salary: r.salary } : {}),
    }));
  }
  const byKey = new Map(typed.map((r) => [settlementRoleKey(r), r] as const));
  return base.map((r) => {
    const inc = byKey.get(settlementRoleKey(r));
    if (!inc || !Object.prototype.hasOwnProperty.call(inc, 'salary')) return r;
    return { ...r, ...(inc.salary ? { salary: inc.salary } : { salary: undefined }) };
  });
}

export function normalizeRoleKeys(catalog?: PostingRoleCatalogEntry[]): string[] {
  if (!catalog || catalog.length === 0) return [];
  return catalog
    .map((e) => (e.role === 'other' && e.customRole ? `other:${e.customRole}` : (e.role ?? '')))
    .filter((k) => k.length > 0)
    .sort();
}

export function hasRoleCatalogIdentityMutation(
  current?: PostingRoleCatalogEntry[],
  next?: PostingRoleCatalogEntry[]
): boolean {
  if (next === undefined) return false;
  const nextKeys = normalizeRoleKeys(next);
  if (new Set(nextKeys).size !== nextKeys.length) return true;
  const currentKeys = normalizeRoleKeys(current);
  if (currentKeys.length !== nextKeys.length) return true;
  return currentKeys.some((k, i) => k !== nextKeys[i]);
}
