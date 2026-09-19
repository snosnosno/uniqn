/**
 * [근무] 사람 줄 ↔ 취소 요청 연결 규칙 (구인자 IA S1b)
 *
 * 사람 줄(`ConfirmedStaff`)에는 취소 요청이 없다. 취소 요청은 지원서(Application)에 있고
 * `workLog.applicationId` 로만 이어진다. 직접 추가한 줄은 지원서가 없어 요청이 생길 수 없다.
 *
 * 🔴 승인 RPC(`cancel_application_atomically`)는 **지원서 단위**다 — 그 지원서의 날짜 줄이
 *    한꺼번에 취소된다. 그래서 같은 지원서의 모든 줄에 요청을 붙이고, 확인창이 일수를 밝힌다.
 */
import { STATUS } from '@/constants';
import type { Application, ConfirmedStaff } from '@/types';

export interface PendingCancellation {
  applicationId: string;
  reason: string;
  requestedAt: string | Date;
  /** 지원 시 남긴 연락처. 없거나 공백이면 undefined — 전화 버튼을 그리지 않는다. */
  phone?: string;
}

export type PendingCancellationIndex = ReadonlyMap<string, PendingCancellation>;

/**
 * 검토 대기 취소 요청만 모은다.
 * 지원서 상태와 요청 상태를 **둘 다** 본다 — 서버 검토 경로가 둘 다 요구하므로
 * 한쪽만 맞는 행에 버튼을 띄우면 누르는 순간 거부된다.
 */
export function buildPendingCancellationIndex(
  applications: readonly Application[]
): PendingCancellationIndex {
  const index = new Map<string, PendingCancellation>();

  for (const application of applications) {
    const request = application.cancellationRequest;
    if (
      application.status !== STATUS.APPLICATION.CANCELLATION_PENDING ||
      request?.status !== STATUS.CANCELLATION_REQUEST.PENDING
    ) {
      continue;
    }

    const phone = application.applicantPhone?.trim();
    index.set(application.id, {
      applicationId: application.id,
      reason: request.reason,
      requestedAt: request.requestedAt,
      phone: phone ? phone : undefined,
    });
  }

  return index;
}

export function findPendingCancellation(
  staff: ConfirmedStaff,
  index: PendingCancellationIndex
): PendingCancellation | undefined {
  const applicationId = staff.workLog?.applicationId;
  return applicationId ? index.get(applicationId) : undefined;
}

/** 지원서별 [근무] 줄 수 — 승인 확인창이 "근무 N일이 모두 취소됩니다"를 밝히는 데 쓴다. */
export function countWorkRowsByApplication(
  groups: readonly { staff: readonly ConfirmedStaff[] }[]
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();

  for (const { staff } of groups) {
    for (const row of staff) {
      const applicationId = row.workLog?.applicationId;
      if (applicationId) {
        counts.set(applicationId, (counts.get(applicationId) ?? 0) + 1);
      }
    }
  }

  return counts;
}
