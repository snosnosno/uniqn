import { STATUS } from '@/constants';
import type { Application } from '@/types';

/** 목록 카드 상태 칩에 표시 가능한 활성 지원 상태 (JobCard·SCHEDULE_STATUS 키 호환) */
export type JobListApplicationStatus = 'applied' | 'confirmed';

/**
 * 내 지원 목록 → jobPostingId 기준 활성 지원 상태 맵.
 * FlashList renderItem에서 O(1) lookup만 하도록 목록 밖에서 1회 구축한다.
 * cancellation_pending은 승인 전까지 활성 지원이므로 applied로 표시한다.
 */
export function buildJobApplicationStatusMap(
  applications: readonly Pick<Application, 'jobPostingId' | 'status'>[]
): Map<string, JobListApplicationStatus> {
  const map = new Map<string, JobListApplicationStatus>();

  for (const application of applications) {
    if (application.status === STATUS.APPLICATION.CONFIRMED) {
      map.set(application.jobPostingId, 'confirmed');
    } else if (
      (application.status === STATUS.APPLICATION.APPLIED ||
        application.status === STATUS.APPLICATION.CANCELLATION_PENDING) &&
      !map.has(application.jobPostingId)
    ) {
      map.set(application.jobPostingId, 'applied');
    }
  }

  return map;
}
