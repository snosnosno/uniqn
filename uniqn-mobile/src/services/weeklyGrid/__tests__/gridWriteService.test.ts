import { setVenueRoleSalary } from '../gridWriteService';

import { ERROR_CODES, ValidationError } from '@/errors';
import { weeklyGridRepository } from '@/repositories/weeklyGrid';
import type { SetVenueRoleSalaryInput } from '@/repositories';

// 레포 경계는 mock — 이 스위트는 Service 의 customRole 선차단(XSS·길이) 검증만 대상으로 한다.
// xssValidation(@/utils/security)·에러 클래스(@/errors)는 실물 유지(선차단 로직의 실제 동작 검증).
jest.mock('@/repositories/weeklyGrid', () => ({
  weeklyGridRepository: {
    setVenueRoleSalary: jest.fn(async () => undefined),
    setVenueSoftTarget: jest.fn(async () => undefined),
  },
}));

jest.mock('@/repositories', () => ({
  workLogRepository: { updateSlot: jest.fn() },
  jobPostingRepository: { getOrCreateVenueContainer: jest.fn() },
}));

jest.mock('@/services/work/confirmedStaffService', () => ({
  cancelConfirmedStaffConfirmation: jest.fn(),
}));

const mockRepo = weeklyGridRepository as jest.Mocked<typeof weeklyGridRepository>;

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
