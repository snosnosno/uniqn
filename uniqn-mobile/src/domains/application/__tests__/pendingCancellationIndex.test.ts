/**
 * 구인자 IA S1b — [근무] 사람 줄에 취소 요청을 붙이기 위한 인덱스.
 *
 * 사람 줄(`ConfirmedStaff`)에는 취소 요청이 없다. 취소 요청은 지원서(Application)에 있고
 * `workLog.applicationId` 로만 이어진다. 이 순수 함수가 그 연결 규칙을 소유한다.
 */
import { STATUS } from '@/constants';
import type { Application, ConfirmedStaff } from '@/types';
import {
  buildPendingCancellationIndex,
  countWorkRowsByApplication,
  findPendingCancellation,
} from '../pendingCancellationIndex';

function createApplication(overrides: Partial<Application> = {}): Application {
  return {
    id: 'app-1',
    jobPostingId: 'job-1',
    applicantId: 'staff-1',
    applicantName: '김딜러',
    applicantPhone: '01012345678',
    status: STATUS.APPLICATION.CANCELLATION_PENDING,
    assignments: [],
    cancellationRequest: {
      status: STATUS.CANCELLATION_REQUEST.PENDING,
      reason: '개인 사정',
      requestedAt: '2026-09-14T01:00:00.000Z',
    },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  } as Application;
}

function createStaff(id: string, applicationId: string | null | undefined): ConfirmedStaff {
  return {
    id,
    staffId: 'staff-1',
    staffName: '김딜러',
    role: 'dealer',
    date: '2026-09-20',
    status: 'scheduled',
    workLog: applicationId === undefined ? undefined : { applicationId },
  } as unknown as ConfirmedStaff;
}

describe('buildPendingCancellationIndex', () => {
  it('검토 대기 취소 요청만 담는다 — 사유·요청 시각·전화번호를 함께 싣는다', () => {
    const index = buildPendingCancellationIndex([createApplication()]);

    expect(index.get('app-1')).toEqual({
      applicationId: 'app-1',
      reason: '개인 사정',
      requestedAt: '2026-09-14T01:00:00.000Z',
      phone: '01012345678',
    });
  });

  it('승인·거절이 끝난 요청은 담지 않는다', () => {
    const index = buildPendingCancellationIndex([
      createApplication({
        id: 'approved',
        status: STATUS.APPLICATION.CANCELLED,
        cancellationRequest: {
          status: STATUS.CANCELLATION_REQUEST.APPROVED,
          reason: '사정',
          requestedAt: '2026-09-14T01:00:00.000Z',
          reviewedAt: '2026-09-14T02:00:00.000Z',
          reviewedBy: 'owner',
        },
      }),
      createApplication({
        id: 'rejected',
        status: STATUS.APPLICATION.CONFIRMED,
        cancellationRequest: {
          status: STATUS.CANCELLATION_REQUEST.REJECTED,
          reason: '사정',
          requestedAt: '2026-09-14T01:00:00.000Z',
          reviewedAt: '2026-09-14T02:00:00.000Z',
          reviewedBy: 'owner',
          rejectionReason: '대체 인원 없음',
        },
      }),
    ]);

    expect(index.size).toBe(0);
  });

  it('🔴 지원서 상태가 검토 대기가 아니면 요청 객체가 pending 이어도 담지 않는다 — RPC 가 거부한다', () => {
    const index = buildPendingCancellationIndex([
      createApplication({ status: STATUS.APPLICATION.CONFIRMED }),
    ]);

    expect(index.size).toBe(0);
  });

  it('전화번호가 없으면 phone 은 undefined 다(빈 문자열도 없음으로 본다)', () => {
    const index = buildPendingCancellationIndex([createApplication({ applicantPhone: '  ' })]);

    expect(index.get('app-1')?.phone).toBeUndefined();
  });
});

describe('findPendingCancellation', () => {
  const index = buildPendingCancellationIndex([createApplication()]);

  it('workLog.applicationId 로 사람 줄과 지원서를 잇는다', () => {
    expect(findPendingCancellation(createStaff('wl-1', 'app-1'), index)?.applicationId).toBe(
      'app-1'
    );
  });

  it('직접 추가한 줄(applicationId 없음)은 취소 요청이 생길 수 없다', () => {
    expect(findPendingCancellation(createStaff('wl-2', null), index)).toBeUndefined();
    expect(findPendingCancellation(createStaff('wl-3', undefined), index)).toBeUndefined();
  });

  it('다른 지원서의 줄에는 붙지 않는다', () => {
    expect(findPendingCancellation(createStaff('wl-4', 'app-2'), index)).toBeUndefined();
  });
});

describe('countWorkRowsByApplication', () => {
  it('🔴 승인은 지원서 단위라 같은 지원서의 날짜 줄을 모두 센다 — 확인창이 몇 일이 취소되는지 밝힌다', () => {
    const counts = countWorkRowsByApplication([
      { staff: [createStaff('wl-1', 'app-1'), createStaff('wl-2', null)] },
      { staff: [createStaff('wl-3', 'app-1'), createStaff('wl-4', 'app-2')] },
    ]);

    expect(counts.get('app-1')).toBe(2);
    expect(counts.get('app-2')).toBe(1);
    expect(counts.size).toBe(2);
  });
});
