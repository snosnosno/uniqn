/**
 * useStaffSettlementsHandlers — 노쇼 신고의 2단계 실패 분리 (#475 잔여)
 *
 * 노쇼 신고는 `createReport` → `markAsNoShow` 두 번의 쓰기다. 둘을 한 try 로 묶어 두면
 * 신고만 성공하고 노쇼가 실패했을 때 **신고 행은 남은 채** 사용자는 '신고 접수에 실패'
 * 라는 거짓 안내를 받는다. 재시도하면 중복 신고로 막혀 빠져나갈 길이 없다.
 *
 * 신고는 접수된 사실이므로 되돌리지 않는다(감사 기록이고 삭제 권한도 없다).
 * 대신 접수 사실을 알리고 노쇼만 다시 하도록 후속 경로를 안내한다.
 */
import { renderHook } from '@testing-library/react-native';
import { useStaffSettlementsHandlers } from '../useStaffSettlementsHandlers';
import type { CreateReportInput } from '@/types';

const mockCreateReport = jest.fn();
const mockMarkAsNoShow = jest.fn();

jest.mock('@/services', () => ({
  reportService: {
    createReport: (...args: unknown[]) => mockCreateReport(...args),
  },
  markAsNoShow: (...args: unknown[]) => mockMarkAsNoShow(...args),
  updateWorkLogCustomSettlement: jest.fn(),
  updateJobPostingSettlementSettings: jest.fn(),
}));

jest.mock('@/errors', () => ({
  isDuplicateReportError: jest.fn(() => false),
  isCannotReportSelfError: jest.fn(() => false),
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const addToast = jest.fn();
const closeReportModal = jest.fn();
const setIsSubmittingReport = jest.fn();

function makeModals() {
  return {
    setIsSubmittingReport,
    closeReportModal,
    selectedWorkLogForEdit: null,
  } as unknown as Parameters<typeof useStaffSettlementsHandlers>[0]['modals'];
}

function renderHandlers() {
  return renderHook(() =>
    useStaffSettlementsHandlers({
      jobPostingId: 'job-1',
      modals: makeModals(),
      salaryConfig: { defaultSalary: undefined, allowances: undefined } as never,
      rolesForList: [],
      addToast,
      refresh: jest.fn(),
      refreshJobDetail: jest.fn(),
    })
  ).result.current;
}

const NO_SHOW_INPUT = {
  type: 'no_show',
  workLogId: 'worklog-1',
  targetId: 'staff-1',
  jobPostingId: 'job-1',
  description: '연락 두절',
} as unknown as CreateReportInput;

function lastToastMessage(): string {
  const calls = addToast.mock.calls;
  return calls[calls.length - 1][0].message as string;
}

describe('노쇼 신고의 2단계 실패 분리', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateReport.mockResolvedValue('report-1');
    mockMarkAsNoShow.mockResolvedValue(undefined);
  });

  it('노쇼 처리만 실패하면 신고가 접수된 사실을 알리고 후속 경로를 안내한다', async () => {
    mockMarkAsNoShow.mockRejectedValueOnce(new Error('이미 정산이 완료된 근무입니다'));

    await renderHandlers().handleReportSubmit(NO_SHOW_INPUT);

    // 신고는 실제로 접수됐다 — '접수 실패' 라고 말하면 거짓이다.
    expect(lastToastMessage()).toContain('신고는 접수');
    expect(lastToastMessage()).not.toContain('신고 접수에 실패');
    // 재시도해도 중복 신고로 막히므로 모달을 닫아 막다른 길을 없앤다.
    expect(closeReportModal).toHaveBeenCalledTimes(1);
  });

  it('신고 생성 자체가 실패하면 기존 실패 안내를 유지하고 모달을 닫지 않는다(대조군)', async () => {
    mockCreateReport.mockRejectedValueOnce(new Error('network'));

    await renderHandlers().handleReportSubmit(NO_SHOW_INPUT);

    expect(lastToastMessage()).toContain('신고 접수에 실패');
    expect(mockMarkAsNoShow).not.toHaveBeenCalled();
    expect(closeReportModal).not.toHaveBeenCalled();
  });

  it('둘 다 성공하면 성공 안내 후 모달을 닫는다', async () => {
    await renderHandlers().handleReportSubmit(NO_SHOW_INPUT);

    expect(mockMarkAsNoShow).toHaveBeenCalledWith('worklog-1', '연락 두절');
    expect(lastToastMessage()).toBe('신고가 접수되었습니다.');
    expect(closeReportModal).toHaveBeenCalledTimes(1);
  });

  it('노쇼가 아닌 신고는 markAsNoShow 를 타지 않는다', async () => {
    await renderHandlers().handleReportSubmit({
      ...NO_SHOW_INPUT,
      type: 'tardiness',
    } as unknown as CreateReportInput);

    expect(mockMarkAsNoShow).not.toHaveBeenCalled();
    expect(closeReportModal).toHaveBeenCalledTimes(1);
  });

  it('제출 플래그는 어느 경로에서도 반드시 내려간다', async () => {
    mockMarkAsNoShow.mockRejectedValueOnce(new Error('boom'));

    await renderHandlers().handleReportSubmit(NO_SHOW_INPUT);

    expect(setIsSubmittingReport).toHaveBeenNthCalledWith(1, true);
    expect(setIsSubmittingReport).toHaveBeenLastCalledWith(false);
  });
});
