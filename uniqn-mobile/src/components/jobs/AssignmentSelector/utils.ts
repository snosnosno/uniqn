import type { RoleInfo } from '@/types/unified';

export function getEffectiveRoleId(role: Pick<RoleInfo, 'roleId' | 'customName'>): string {
  return role.roleId === 'other' && role.customName ? role.customName : role.roleId;
}

export function getRoleCheckboxKey(
  role: Pick<RoleInfo, 'roleId' | 'customName'>,
  fallbackIndex: number
): string {
  const effectiveRoleId = getEffectiveRoleId(role);
  return `${effectiveRoleId || role.roleId || 'role'}-${fallbackIndex}`;
}
