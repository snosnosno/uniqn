import { RoleResolver } from '@/shared/role';
import { REVIEWER_TYPES, type ReviewerType } from '@/types/review';

const REVIEWER_TYPE_SET = new Set<ReviewerType>(REVIEWER_TYPES);

export function isReviewerType(value: string | null | undefined): value is ReviewerType {
  return !!value && REVIEWER_TYPE_SET.has(value as ReviewerType);
}

export function resolveReviewerTypeFromRole(role: string | null | undefined): ReviewerType {
  return RoleResolver.hasPermission(role, 'employer') ? 'employer' : 'staff';
}

export function resolveReviewerType(
  reviewerType: string | null | undefined,
  role: string | null | undefined
): ReviewerType {
  return isReviewerType(reviewerType) ? reviewerType : resolveReviewerTypeFromRole(role);
}
