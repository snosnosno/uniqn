import type { JobPosting, PostingRoleAvailability, PostingWorkflow } from '@/types';
import { getRoleDisplayName } from '@/types/unified';
import { getPostingDateGroups, getPostingRoleKey, getPostingRoleStats } from './core';

export type { PostingSettlementContext } from '@/types';
export {
  createPostingLegacyDateRequirements,
  getPostingRoleStats,
  getPostingDefaultSalary,
  getPostingSettlementContext,
} from './core';

export function selectPostingWorkflow(posting: JobPosting): PostingWorkflow {
  const isFixed = posting.schedule.kind === 'fixed';
  const isTournament = posting.postingType === 'tournament';
  const dateGroups = isFixed ? [] : getPostingDateGroups(posting);
  const hasGroupedRequirements =
    posting.schedule.kind === 'dated' &&
    posting.schedule.requirements.some((requirement) => requirement.isGrouped === true);
  const usesGroupedDateRanges = !isFixed && hasGroupedRequirements && dateGroups.length > 0;

  return {
    scheduleKind: posting.schedule.kind,
    isFixed,
    isDated: !isFixed,
    isTournament,
    isUrgent: posting.postingType === 'urgent',
    recruitmentType: isFixed ? 'fixed' : 'event',
    usesGroupedDateRanges,
  };
}

/**
 * 공고 삭제 가능 여부 — 확정된 지원자가 1명이라도 있으면 삭제할 수 없다(EF-crud-4).
 *
 * 상세 화면의 캡션("확정된 지원자가 있는 공고는 삭제할 수 없습니다")과 삭제 버튼
 * 활성 상태의 단일 근거. 이 규칙을 우회해 삭제 버튼을 항상 활성화하면 확정 인력이
 * 배정된 공고가 흔적 없이 삭제될 수 있다.
 */
export function isPostingDeletable(confirmedApplicants: number): boolean {
  return confirmedApplicants <= 0;
}

/**
 * 공고 서브맵(`date__slot__role` 키)을 역할키별 확정 인원으로 합산 (S3 역할별 실카운트).
 *
 * @description usePostingFilledCounts + extractPostingFilledSubmap 이 만든 한 공고의 서브맵을
 * 입력받아 날짜·슬롯 차원을 접고 역할키(DB `_posting_role_key`, other 역할은 `other:<custom>`)별
 * 확정 인원을 더한다. 반환 맵의 키는 DB 역할키 형식 그대로이며,
 * selectPostingRoleAvailability 는 bare other(customRole 없음)를 'other:' 콜론 형식으로
 * 정규화해 이 키와 정합하게 조회한다.
 * 새 키 함수를 만들지 않고 기존 3면 키 계약(DB `_posting_role_key` ↔ 클라 슬롯/역할키)을 재사용한다.
 */
export function aggregateRoleFilledFromSubmap(
  submap: Map<string, number> | undefined
): Record<string, number> {
  const totals: Record<string, number> = {};
  if (!submap) {
    return totals;
  }

  for (const [key, value] of submap) {
    const segments = key.split('__');
    // 키 형식: `${date}__${slot}__${role}`. role 세그먼트가 '__' 를 품을 수 있어 slice(2) 후 재결합.
    if (segments.length < 3) {
      continue;
    }
    const roleKey = segments.slice(2).join('__');
    if (!roleKey) {
      continue;
    }
    totals[roleKey] = (totals[roleKey] ?? 0) + value;
  }

  return totals;
}

interface PostingRoleAvailabilityOptions {
  /**
   * 역할키(DB `_posting_role_key`)별 실확정 인원. 주입 시 SP3 dead counter(filled=0) 대신
   * 이 값으로 remaining/isAvailable 을 계산한다. 미주입 시 기존 동작(모든 역할 여유)을 완전히 보존.
   *
   * ⚠️ 지원(apply) 게이트(ApplicationValidator)는 이 옵션을
   * 주입하지 않는다 — 마감 역할 지원 허용은 의도된 정책(대기 성격, 최종 overfill 차단은 서버
   * confirm_application H1 권위). employer 역할 변경 모달처럼 "지금 남은 자리"를 정확히 보여줘야
   * 하는 표시 경로에서만 주입한다.
   */
  filledByRole?: Record<string, number>;
}

export function selectPostingRoleAvailability(
  posting: JobPosting,
  options?: PostingRoleAvailabilityOptions
): PostingRoleAvailability {
  const filledByRole = options?.filledByRole;
  const items = getPostingRoleStats(posting).map((role) => {
    // filledByRole 주입 시 DB 역할키로 실확정 수를 조회, 미주입 시 dead counter(role.filled=0) 유지.
    // bare other(customRole 없음)는 getPostingRoleKey 가 'other' 를 내지만 DB `_posting_role_key` 는
    // 'other:'(콜론 포함) — roleMatchKey 계보에 맞춰 콜론 형식으로 조회한다.
    const dbRoleKey =
      role.role === 'other' ? `other:${role.customRole ?? ''}` : getPostingRoleKey(role);
    const filled = filledByRole ? (filledByRole[dbRoleKey] ?? 0) : role.filled;
    const remaining = Math.max(0, role.count - filled);

    return {
      key: role.role === 'other' && role.customRole ? role.customRole : getPostingRoleKey(role),
      role: role.role,
      customRole: role.customRole,
      roleLabel: getRoleDisplayName(role.role, role.customRole),
      count: role.count,
      filled,
      remaining,
      salary: role.salary,
      isAvailable: remaining > 0,
    };
  });

  const availableItems = items.filter((item) => item.isAvailable);

  return {
    items,
    availableItems,
    totalCount: items.reduce((sum, item) => sum + item.count, 0),
    filledCount: items.reduce((sum, item) => sum + item.filled, 0),
    remainingCount: items.reduce((sum, item) => sum + item.remaining, 0),
    hasAvailableRoles: availableItems.length > 0,
  };
}
