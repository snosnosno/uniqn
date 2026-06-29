/**
 * copyLastWeekService 테스트 — 지난주 구간 산출 / 그룹별 add_direct_staff 호출 / 집계 결과 / 빈 소스 단락.
 */
import type { WorkLog } from '@/types';
import { workLogRepository, confirmedStaffRepository } from '@/repositories';
import { copyLastWeek } from '../copyLastWeekService';
import { STATUS } from '@/constants';
import { BusinessError, ERROR_CODES } from '@/errors';

jest.mock('@/repositories', () => ({
  workLogRepository: {
    getByVenueSpanInRange: jest.fn(),
  },
  confirmedStaffRepository: {
    addDirectStaff: jest.fn(),
  },
}));

jest.mock('@/services/auth/authCoreService', () => ({
  requireCurrentUser: jest.fn(() => ({ id: 'owner-1' })),
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const getByVenueSpanInRange = workLogRepository.getByVenueSpanInRange as jest.Mock;
const addDirectStaff = confirmedStaffRepository.addDirectStaff as jest.Mock;

function mkLog(partial: Partial<WorkLog>): WorkLog {
  return {
    id: 'wl-x',
    staffId: 'staff-1',
    jobPostingId: 'container-1',
    date: '2026-06-22',
    status: STATUS.WORK_LOG.SCHEDULED,
    role: 'dealer',
    ...partial,
  } as WorkLog;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('copyLastWeek', () => {
  it('지난주 구간(이번 주 시작 −7 ~ −1)으로 소스를 조회한다', async () => {
    getByVenueSpanInRange.mockResolvedValue([]);

    await copyLastWeek({ venueId: 'container-1', targetWeekStart: '2026-06-29' });

    expect(getByVenueSpanInRange).toHaveBeenCalledWith('container-1', '2026-06-22', '2026-06-28');
  });

  it('그룹별로 add_direct_staff 를 호출하고 결과를 집계한다', async () => {
    getByVenueSpanInRange.mockResolvedValue([
      mkLog({ staffId: 'a', jobPostingId: 'container-1', date: '2026-06-22' }),
      mkLog({ staffId: 'b', jobPostingId: 'container-1', date: '2026-06-23' }),
    ]);
    addDirectStaff.mockResolvedValueOnce(['new-1']).mockResolvedValueOnce(['new-2']);

    const result = await copyLastWeek({ venueId: 'container-1', targetWeekStart: '2026-06-29' });

    expect(addDirectStaff).toHaveBeenCalledTimes(2);
    // 날짜는 +7일 시프트되어 전달된다.
    const firstArg = addDirectStaff.mock.calls[0][0];
    expect(firstArg.assignments[0].date).toBe('2026-06-29');
    expect(result.staffGroups).toBe(2);
    expect(result.assignments).toBe(2);
    expect(result.workLogIds.sort()).toEqual(['new-1', 'new-2']);
  });

  it('멱등: 한 그룹이 DUPLICATE(이미 배정)면 스킵하고 나머지는 적용한다(부분성공, throw 없음)', async () => {
    getByVenueSpanInRange.mockResolvedValue([
      mkLog({ staffId: 'a', jobPostingId: 'container-1', date: '2026-06-22' }),
      mkLog({ staffId: 'b', jobPostingId: 'container-1', date: '2026-06-23' }),
    ]);
    addDirectStaff
      .mockRejectedValueOnce(
        new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '이미 같은 날짜/역할로 추가된 스태프입니다.',
        })
      )
      .mockResolvedValueOnce(['new-2']);

    const result = await copyLastWeek({ venueId: 'container-1', targetWeekStart: '2026-06-29' });

    expect(addDirectStaff).toHaveBeenCalledTimes(2);
    // 중복 그룹은 생성 0, 다른 그룹만 created. 전체 reject 되지 않는다(멱등 재클릭 안전).
    expect(result.workLogIds).toEqual(['new-2']);
    expect(result.staffGroups).toBe(2);
  });

  it('멱등: 정원 초과(MAX_CAPACITY)도 그룹 스킵으로 흡수한다(throw 없음)', async () => {
    getByVenueSpanInRange.mockResolvedValue([
      mkLog({ staffId: 'a', jobPostingId: 'container-1', date: '2026-06-22' }),
    ]);
    addDirectStaff.mockRejectedValueOnce(
      new BusinessError(ERROR_CODES.BUSINESS_MAX_CAPACITY_REACHED, {
        userMessage: '해당 일정의 모집 인원이 가득 찼습니다.',
      })
    );

    const result = await copyLastWeek({ venueId: 'container-1', targetWeekStart: '2026-06-29' });
    expect(result.workLogIds).toEqual([]);
    expect(result.staffGroups).toBe(1);
  });

  it('실제 오류(권한 등)는 양성 스킵으로 흡수하지 않고 표면화한다', async () => {
    getByVenueSpanInRange.mockResolvedValue([
      mkLog({ staffId: 'a', jobPostingId: 'container-1', date: '2026-06-22' }),
    ]);
    addDirectStaff.mockRejectedValueOnce(
      new BusinessError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
        userMessage: '이 작업을 수행할 권한이 없습니다.',
      })
    );

    await expect(
      copyLastWeek({ venueId: 'container-1', targetWeekStart: '2026-06-29' })
    ).rejects.toThrow();
  });

  it('복사 대상이 없으면 쓰기 없이 0 집계를 반환한다', async () => {
    getByVenueSpanInRange.mockResolvedValue([]);

    const result = await copyLastWeek({ venueId: 'container-1', targetWeekStart: '2026-06-29' });

    expect(addDirectStaff).not.toHaveBeenCalled();
    expect(result).toEqual({ staffGroups: 0, assignments: 0, workLogIds: [] });
  });

  it('targetWeekStart 형식이 올바르지 않으면 ValidationError', async () => {
    await expect(
      copyLastWeek({ venueId: 'container-1', targetWeekStart: 'bad' })
    ).rejects.toThrow();
    expect(getByVenueSpanInRange).not.toHaveBeenCalled();
  });
});
