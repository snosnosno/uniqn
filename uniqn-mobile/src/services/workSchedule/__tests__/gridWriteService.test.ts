import { setVenueRoleSalary, updateVenueContainer } from '../gridWriteService';

import { ERROR_CODES, ValidationError } from '@/errors';
import { workScheduleRepository } from '@/repositories/workSchedule';
import { jobPostingRepository } from '@/repositories';
import type { SetVenueRoleSalaryInput } from '@/repositories';

// 레포 경계는 mock — 이 스위트는 Service 의 customRole 선차단(XSS·길이) 검증만 대상으로 한다.
// xssValidation(@/utils/security)·에러 클래스(@/errors)는 실물 유지(선차단 로직의 실제 동작 검증).
jest.mock('@/repositories/workSchedule', () => ({
  workScheduleRepository: {
    setVenueRoleSalary: jest.fn(async () => undefined),
    setVenueSoftTarget: jest.fn(async () => undefined),
  },
}));

jest.mock('@/repositories', () => ({
  workLogRepository: { updateSlot: jest.fn() },
  jobPostingRepository: {
    getOrCreateVenueContainer: jest.fn(),
    updateVenueContainer: jest.fn(async () => undefined),
  },
}));

jest.mock('@/services/work/confirmedStaffService', () => ({
  cancelConfirmedStaffConfirmation: jest.fn(),
}));

const mockRepo = workScheduleRepository as jest.Mocked<typeof workScheduleRepository>;

const baseInput = (customRole: string): SetVenueRoleSalaryInput => ({
  role: 'custom',
  customRole,
  salary: { type: 'hourly', amount: 15000 },
});

// 선차단은 async 함수가 아니라 동기 throw(레포 위임 promise 반환 전) 이므로 rejects 로는 잡히지 않는다 —
// 호출을 감싸 던져진 에러를 포획해 code/인스턴스를 단언한다.
const catchThrown = (fn: () => unknown): unknown => {
  try {
    fn();
    return undefined;
  } catch (error) {
    return error;
  }
};

describe('gridWriteService.setVenueRoleSalary — customRole 선차단', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('XSS 패턴 customRole 은 SECURITY_XSS_DETECTED 로 차단하고 레포를 호출하지 않는다', () => {
    const input = baseInput('<script>alert(1)</script>');

    const thrown = catchThrown(() => setVenueRoleSalary('venue-1', input));

    expect(thrown).toBeInstanceOf(ValidationError);
    expect((thrown as ValidationError).code).toBe(ERROR_CODES.SECURITY_XSS_DETECTED);
    expect(mockRepo.setVenueRoleSalary).not.toHaveBeenCalled();
  });

  it('51자 customRole 은 길이 초과(VALIDATION_SCHEMA)로 차단하고 레포를 호출하지 않는다', () => {
    const input = baseInput('가'.repeat(51));

    const thrown = catchThrown(() => setVenueRoleSalary('venue-1', input));

    expect(thrown).toBeInstanceOf(ValidationError);
    expect((thrown as ValidationError).code).toBe(ERROR_CODES.VALIDATION_SCHEMA);
    expect((thrown as ValidationError).field).toBe('customRole');
    expect(mockRepo.setVenueRoleSalary).not.toHaveBeenCalled();
  });

  it('정상 한글 customRole 은 레포에 원본 인자 그대로 위임한다', async () => {
    const input = baseInput('칩 러너');

    await expect(setVenueRoleSalary('venue-1', input)).resolves.toBeUndefined();
    expect(mockRepo.setVenueRoleSalary).toHaveBeenCalledTimes(1);
    expect(mockRepo.setVenueRoleSalary).toHaveBeenCalledWith('venue-1', input);
  });
});

describe('gridWriteService.updateVenueContainer — 지점 프로필 선차단 + 부분 갱신 의미론', () => {
  const mockJobPostingRepo = jobPostingRepository as jest.Mocked<typeof jobPostingRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 🔴 이 프로젝트의 관용구는 null→undefined 정규화다. 그 습관이 이 경로에 새어 들어오면
  //    사용자가 칸을 비운 행위가 조용히 "안 바꿈"이 된다(서버는 ''를 "제거"로 읽는다).
  it('빈 문자열을 undefined 로 뭉개지 않고 그대로 레포에 넘긴다(= 제거 신호 보존)', async () => {
    await updateVenueContainer('venue-1', { name: '강남점', contactPhone: '', description: '' });

    expect(mockJobPostingRepo.updateVenueContainer).toHaveBeenCalledWith('venue-1', {
      name: '강남점',
      contactPhone: '',
      description: '',
    });
  });

  it('넘기지 않은 필드는 입력에 나타나지 않는다(= 미변경 신호 보존)', async () => {
    await updateVenueContainer('venue-1', { name: '강남점' });

    const [, input] = mockJobPostingRepo.updateVenueContainer.mock.calls[0]!;
    expect(Object.keys(input)).toEqual(['name']);
  });

  it('공백만인 지점명은 레포에 도달하지 않는다', () => {
    const error = catchThrown(() => updateVenueContainer('venue-1', { name: '   ' }));
    expect(error).toBeInstanceOf(ValidationError);
    expect(mockJobPostingRepo.updateVenueContainer).not.toHaveBeenCalled();
  });

  it('지점명 XSS 는 RPC 미도달로 선차단한다', () => {
    const error = catchThrown(() =>
      updateVenueContainer('venue-1', { name: '<script>alert(1)</script>' })
    );
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).code).toBe(ERROR_CODES.SECURITY_XSS_DETECTED);
    expect(mockJobPostingRepo.updateVenueContainer).not.toHaveBeenCalled();
  });

  it('장소명 XSS 도 선차단한다(location 은 서버 XSS 트리거 대상이 아니다)', () => {
    const error = catchThrown(() =>
      updateVenueContainer('venue-1', { location: { name: '<iframe src=x>' } })
    );
    expect(error).toBeInstanceOf(ValidationError);
    expect(mockJobPostingRepo.updateVenueContainer).not.toHaveBeenCalled();
  });

  it('길이 상한은 서버 규약(이름 50 / 연락처 25 / 소개 500)과 같다', () => {
    expect(catchThrown(() => updateVenueContainer('v', { name: 'ㄱ'.repeat(51) }))).toBeInstanceOf(
      ValidationError
    );
    expect(
      catchThrown(() => updateVenueContainer('v', { contactPhone: '0'.repeat(26) }))
    ).toBeInstanceOf(ValidationError);
    expect(
      catchThrown(() => updateVenueContainer('v', { description: 'ㄱ'.repeat(501) }))
    ).toBeInstanceOf(ValidationError);
    expect(mockJobPostingRepo.updateVenueContainer).not.toHaveBeenCalled();
  });
});
