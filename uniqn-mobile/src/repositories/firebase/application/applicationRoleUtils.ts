import type { Application } from '@/types';
import { normalizeAssignmentRole, type NormalizedAssignmentRole } from '@/types/assignment';

export function resolvePrimaryApplicationRole(
  application: Pick<Application, 'assignments' | 'customRole' | 'applicantRole'>
): NormalizedAssignmentRole {
  const rawRole =
    application.assignments[0]?.roleIds?.[0] ??
    application.customRole ??
    application.applicantRole ??
    'other';

  return normalizeAssignmentRole(rawRole);
}
