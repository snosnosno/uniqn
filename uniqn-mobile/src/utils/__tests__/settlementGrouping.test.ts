/**
 * UNIQN Mobile - settlementGrouping.ts 테스트
 *
 * @description 정산 그룹핑 유틸리티 함수들의 단위 테스트
 */

import type { WorkLog } from '@/types/schedule';
import type { GroupedSettlement } from '@/types/settlement';

// Mock the settlement calculation utility
jest.mock('../settlement', () => ({
  calculateSettlementFromWorkLogWithTax: jest.fn(() => ({
    hoursWorked: 8,
    basePay: 120000,
    allowancePay: 10000,
    totalPay: 130000,
    taxAmount: 4290,
    afterTaxPay: 125710,
  })),
}));

import {
  groupSettlementsByStaff,
  getSettlableWorkLogIds,
  getSettlableWorkLogs,
  calculateGroupedSettlementStats,
  filterGroupedSettlements,
  formatGroupRolesDisplay,
} from '../settlementGrouping';
import type { SettlementGroupingContext } from '../settlementGrouping';

// ============================================================================
// Test Helpers
// ============================================================================

function createWorkLog(overrides: Partial<WorkLog> = {}): WorkLog {
  return {
    id: 'wl-1',
    staffId: 'staff-1',
    jobPostingId: 'job-1',
    date: '2025-01-15',
    status: 'checked_out',
    role: 'dealer',
    staffName: '홍길동',
    staffNickname: '길동',
    staffPhotoURL: 'https://example.com/photo.jpg',
    ...overrides,
  } as WorkLog;
}

const defaultContext: SettlementGroupingContext = {
  roles: [{ role: 'dealer', salary: { type: 'daily', amount: 150000 } }],
  defaultSalary: { type: 'daily', amount: 150000 },
};

function createGroupedSettlement(overrides: Partial<GroupedSettlement> = {}): GroupedSettlement {
  return {
    id: 'grouped_settlement_staff-1',
    staffId: 'staff-1',
    jobPostingId: 'job-1',
    staffProfile: {
      name: '홍길동',
      nickname: '길동',
      photoURL: 'https://example.com/photo.jpg',
    },
    dateRange: {
      start: '2025-01-15',
      end: '2025-01-17',
      dates: ['2025-01-15', '2025-01-16', '2025-01-17'],
      totalDays: 3,
      isConsecutive: true,
    },
    roles: ['dealer'],
    dateStatuses: [
      {
        date: '2025-01-15',
        formattedDate: '1/15(수)',
        payrollStatus: 'pending',
        amount: 125710,
        workLogId: 'wl-1',
        role: 'dealer',
        hasValidTimes: true,
      },
      {
        date: '2025-01-16',
        formattedDate: '1/16(목)',
        payrollStatus: 'pending',
        amount: 125710,
        workLogId: 'wl-2',
        role: 'dealer',
        hasValidTimes: true,
      },
      {
        date: '2025-01-17',
        formattedDate: '1/17(금)',
        payrollStatus: 'completed',
        amount: 125710,
        workLogId: 'wl-3',
        role: 'dealer',
        hasValidTimes: true,
      },
    ],
    originalWorkLogs: [],
    summary: {
      totalCount: 3,
      pendingCount: 2,
      completedCount: 1,
      totalAmount: 377130,
      pendingAmount: 251420,
      completedAmount: 125710,
      settlableCount: 2,
    },
    overallStatus: 'partial',
    ...overrides,
  };
}

// ============================================================================
// groupSettlementsByStaff
// ============================================================================

describe('groupSettlementsByStaff', () => {
  it('빈 배열은 빈 배열을 반환한다', () => {
    const result = groupSettlementsByStaff([], defaultContext);
    expect(result).toEqual([]);
  });

  it('단일 WorkLog도 GroupedSettlement로 변환한다 (minGroupSize=1 기본)', () => {
    const workLogs = [createWorkLog()];
    const result = groupSettlementsByStaff(workLogs, defaultContext);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('grouped_settlement_staff-1');
    expect(result[0].staffId).toBe('staff-1');
  });

  it('같은 staffId의 WorkLog들을 하나의 그룹으로 통합한다', () => {
    const workLogs = [
      createWorkLog({ id: 'wl-1', date: '2025-01-15' }),
      createWorkLog({ id: 'wl-2', date: '2025-01-16' }),
      createWorkLog({ id: 'wl-3', date: '2025-01-17' }),
    ];
    const result = groupSettlementsByStaff(workLogs, defaultContext);
    expect(result).toHaveLength(1);
    expect(result[0].dateRange.totalDays).toBe(3);
    expect(result[0].dateRange.dates).toEqual(['2025-01-15', '2025-01-16', '2025-01-17']);
  });

  it('다른 staffId는 별도 그룹으로 분리한다', () => {
    const workLogs = [
      createWorkLog({ id: 'wl-1', staffId: 'staff-1', date: '2025-01-15' }),
      createWorkLog({ id: 'wl-2', staffId: 'staff-1', date: '2025-01-16' }),
      createWorkLog({ id: 'wl-3', staffId: 'staff-2', date: '2025-01-15', staffName: '김철수' }),
    ];
    const result = groupSettlementsByStaff(workLogs, defaultContext);
    expect(result).toHaveLength(2);
    const staffIds = result.map((g) => g.staffId);
    expect(staffIds).toContain('staff-1');
    expect(staffIds).toContain('staff-2');
  });

  it('결과가 최신 날짜순으로 정렬된다', () => {
    const workLogs = [
      createWorkLog({ id: 'wl-1', staffId: 'staff-1', date: '2025-01-10' }),
      createWorkLog({ id: 'wl-2', staffId: 'staff-2', date: '2025-01-20', staffName: '김철수' }),
    ];
    const result = groupSettlementsByStaff(workLogs, defaultContext);
    expect(result).toHaveLength(2);
    expect(result[0].staffId).toBe('staff-2'); // 최신 날짜 먼저
    expect(result[1].staffId).toBe('staff-1');
  });

  it('그룹핑 비활성화 시에도 스태프별 그룹은 생성한다', () => {
    const workLogs = [
      createWorkLog({ id: 'wl-1', staffId: 'staff-1', date: '2025-01-15' }),
      createWorkLog({ id: 'wl-2', staffId: 'staff-1', date: '2025-01-16' }),
    ];
    const result = groupSettlementsByStaff(workLogs, defaultContext, { enabled: false });
    expect(result).toHaveLength(1);
    expect(result[0].dateRange.totalDays).toBe(2);
  });

  it('스태프 프로필 정보가 올바르게 추출된다', () => {
    const workLogs = [
      createWorkLog({
        staffName: '홍길동',
        staffNickname: '길동',
        staffPhotoURL: 'https://example.com/photo.jpg',
      }),
    ];
    const result = groupSettlementsByStaff(workLogs, defaultContext);
    expect(result[0].staffProfile).toEqual({
      name: '홍길동',
      nickname: '길동',
      photoURL: 'https://example.com/photo.jpg',
    });
  });

  it('역할 정보가 중복 없이 수집된다', () => {
    const workLogs = [
      createWorkLog({ id: 'wl-1', date: '2025-01-15', role: 'dealer' as any }),
      createWorkLog({ id: 'wl-2', date: '2025-01-16', role: 'dealer' as any }),
    ];
    const result = groupSettlementsByStaff(workLogs, defaultContext);
    expect(result[0].roles).toEqual(['dealer']);
  });

  it('여러 역할이 수집된다', () => {
    const workLogs = [
      createWorkLog({ id: 'wl-1', date: '2025-01-15', role: 'dealer' as any }),
      createWorkLog({ id: 'wl-2', date: '2025-01-16', role: 'floor' as any }),
    ];
    const result = groupSettlementsByStaff(workLogs, defaultContext);
    expect(result[0].roles).toContain('dealer');
    expect(result[0].roles).toContain('floor');
  });

  it('customRoles가 올바르게 매핑된다', () => {
    const workLogs = [
      createWorkLog({
        id: 'wl-1',
        date: '2025-01-15',
        role: 'other' as any,
        customRole: '조명담당',
      }),
    ];
    const result = groupSettlementsByStaff(workLogs, defaultContext);
    expect(result[0].roles).toEqual(['other']);
    expect(result[0].customRoles).toEqual(['조명담당']);
  });

  it('customRoles가 모두 undefined이면 customRoles는 undefined이다', () => {
    const workLogs = [createWorkLog({ id: 'wl-1', date: '2025-01-15', role: 'dealer' as any })];
    const result = groupSettlementsByStaff(workLogs, defaultContext);
    expect(result[0].customRoles).toBeUndefined();
  });

  it('연속 날짜 여부가 올바르게 판단된다', () => {
    const consecutiveWorkLogs = [
      createWorkLog({ id: 'wl-1', date: '2025-01-15' }),
      createWorkLog({ id: 'wl-2', date: '2025-01-16' }),
      createWorkLog({ id: 'wl-3', date: '2025-01-17' }),
    ];
    const result = groupSettlementsByStaff(consecutiveWorkLogs, defaultContext);
    expect(result[0].dateRange.isConsecutive).toBe(true);

    const nonConsecutiveWorkLogs = [
      createWorkLog({ id: 'wl-1', date: '2025-01-15' }),
      createWorkLog({ id: 'wl-3', date: '2025-01-20' }),
    ];
    const result2 = groupSettlementsByStaff(nonConsecutiveWorkLogs, defaultContext);
    expect(result2[0].dateRange.isConsecutive).toBe(false);
  });

  it('overallStatus가 all_pending으로 올바르게 설정된다', () => {
    const workLogs = [
      createWorkLog({ id: 'wl-1', date: '2025-01-15', payrollStatus: 'pending' }),
      createWorkLog({ id: 'wl-2', date: '2025-01-16', payrollStatus: 'pending' }),
    ];
    const result = groupSettlementsByStaff(workLogs, defaultContext);
    expect(result[0].overallStatus).toBe('all_pending');
  });

  it('payrollStatus 기본값은 pending이다', () => {
    const workLogs = [createWorkLog({ id: 'wl-1', date: '2025-01-15' })];
    const result = groupSettlementsByStaff(workLogs, defaultContext);
    expect(result[0].dateStatuses[0].payrollStatus).toBe('pending');
  });

  it('overallStatus가 all_completed로 올바르게 설정된다', () => {
    const workLogs = [
      createWorkLog({ id: 'wl-1', date: '2025-01-15', payrollStatus: 'completed' }),
      createWorkLog({ id: 'wl-2', date: '2025-01-16', payrollStatus: 'completed' }),
    ];
    const result = groupSettlementsByStaff(workLogs, defaultContext);
    expect(result[0].overallStatus).toBe('all_completed');
  });

  it('overallStatus가 partial로 올바르게 설정된다', () => {
    const workLogs = [
      createWorkLog({ id: 'wl-1', date: '2025-01-15', payrollStatus: 'pending' }),
      createWorkLog({ id: 'wl-2', date: '2025-01-16', payrollStatus: 'completed' }),
    ];
    const result = groupSettlementsByStaff(workLogs, defaultContext);
    expect(result[0].overallStatus).toBe('partial');
  });

  it('dateStatuses가 날짜순으로 정렬된다', () => {
    const workLogs = [
      createWorkLog({ id: 'wl-2', date: '2025-01-17' }),
      createWorkLog({ id: 'wl-1', date: '2025-01-15' }),
    ];
    const result = groupSettlementsByStaff(workLogs, defaultContext);
    expect(result[0].dateStatuses[0].date).toBe('2025-01-15');
    expect(result[0].dateStatuses[1].date).toBe('2025-01-17');
  });
});

// ============================================================================
// getSettlableWorkLogIds
// ============================================================================

describe('getSettlableWorkLogIds', () => {
  it('출퇴근 완료 + 미정산인 WorkLog ID를 반환한다', () => {
    const group = createGroupedSettlement();
    const ids = getSettlableWorkLogIds(group);
    expect(ids).toEqual(['wl-1', 'wl-2']);
  });

  it('이미 정산 완료된 항목은 제외한다', () => {
    const group = createGroupedSettlement({
      dateStatuses: [
        {
          date: '2025-01-15',
          formattedDate: '1/15(수)',
          payrollStatus: 'completed',
          amount: 125710,
          workLogId: 'wl-1',
          role: 'dealer',
          hasValidTimes: true,
        },
      ],
    });
    const ids = getSettlableWorkLogIds(group);
    expect(ids).toEqual([]);
  });

  it('출퇴근 미완료인 항목은 제외한다', () => {
    const group = createGroupedSettlement({
      dateStatuses: [
        {
          date: '2025-01-15',
          formattedDate: '1/15(수)',
          payrollStatus: 'pending',
          amount: 125710,
          workLogId: 'wl-1',
          role: 'dealer',
          hasValidTimes: false,
        },
      ],
    });
    const ids = getSettlableWorkLogIds(group);
    expect(ids).toEqual([]);
  });

  it('빈 dateStatuses는 빈 배열을 반환한다', () => {
    const group = createGroupedSettlement({ dateStatuses: [] });
    const ids = getSettlableWorkLogIds(group);
    expect(ids).toEqual([]);
  });
});

// ============================================================================
// getSettlableWorkLogs
// ============================================================================

describe('getSettlableWorkLogs', () => {
  it('정산 가능한 WorkLog를 반환한다', () => {
    const wl1 = createWorkLog({ id: 'wl-1' });
    const wl2 = createWorkLog({ id: 'wl-2' });
    const wl3 = createWorkLog({ id: 'wl-3' });

    const group = createGroupedSettlement({
      originalWorkLogs: [wl1, wl2, wl3],
    });
    const result = getSettlableWorkLogs(group);
    // wl-1 and wl-2 are pending + hasValidTimes=true, wl-3 is completed
    expect(result).toHaveLength(2);
    expect(result.map((wl) => wl.id)).toEqual(['wl-1', 'wl-2']);
  });

  it('정산 가능한 WorkLog가 없으면 빈 배열을 반환한다', () => {
    const group = createGroupedSettlement({
      dateStatuses: [
        {
          date: '2025-01-15',
          formattedDate: '1/15(수)',
          payrollStatus: 'completed',
          amount: 125710,
          workLogId: 'wl-1',
          role: 'dealer',
          hasValidTimes: true,
        },
      ],
      originalWorkLogs: [createWorkLog({ id: 'wl-1' })],
    });
    const result = getSettlableWorkLogs(group);
    expect(result).toEqual([]);
  });
});

// ============================================================================
// calculateGroupedSettlementStats
// ============================================================================

describe('calculateGroupedSettlementStats', () => {
  it('빈 배열에서 모든 값이 0인 통계를 반환한다', () => {
    const stats = calculateGroupedSettlementStats([]);
    expect(stats).toEqual({
      totalGroups: 0,
      totalWorkLogs: 0,
      totalPendingCount: 0,
      totalCompletedCount: 0,
      totalAmount: 0,
      totalPendingAmount: 0,
      totalCompletedAmount: 0,
      totalSettlableCount: 0,
    });
  });

  it('단일 그룹의 통계를 올바르게 계산한다', () => {
    const group = createGroupedSettlement();
    const stats = calculateGroupedSettlementStats([group]);
    expect(stats.totalGroups).toBe(1);
    expect(stats.totalWorkLogs).toBe(3);
    expect(stats.totalPendingCount).toBe(2);
    expect(stats.totalCompletedCount).toBe(1);
    expect(stats.totalAmount).toBe(377130);
    expect(stats.totalPendingAmount).toBe(251420);
    expect(stats.totalCompletedAmount).toBe(125710);
    expect(stats.totalSettlableCount).toBe(2);
  });

  it('여러 그룹의 통계를 올바르게 합산한다', () => {
    const group1 = createGroupedSettlement({
      summary: {
        totalCount: 2,
        pendingCount: 1,
        completedCount: 1,
        totalAmount: 200000,
        pendingAmount: 100000,
        completedAmount: 100000,
        settlableCount: 1,
      },
    });
    const group2 = createGroupedSettlement({
      id: 'grouped_settlement_staff-2',
      staffId: 'staff-2',
      summary: {
        totalCount: 3,
        pendingCount: 3,
        completedCount: 0,
        totalAmount: 300000,
        pendingAmount: 300000,
        completedAmount: 0,
        settlableCount: 2,
      },
    });
    const stats = calculateGroupedSettlementStats([group1, group2]);
    expect(stats.totalGroups).toBe(2);
    expect(stats.totalWorkLogs).toBe(5);
    expect(stats.totalPendingCount).toBe(4);
    expect(stats.totalCompletedCount).toBe(1);
    expect(stats.totalAmount).toBe(500000);
    expect(stats.totalPendingAmount).toBe(400000);
    expect(stats.totalCompletedAmount).toBe(100000);
    expect(stats.totalSettlableCount).toBe(3);
  });
});

// ============================================================================
// filterGroupedSettlements
// ============================================================================

describe('filterGroupedSettlements', () => {
  const groups = [
    createGroupedSettlement({ id: 'g1', overallStatus: 'all_pending' }),
    createGroupedSettlement({ id: 'g2', overallStatus: 'all_completed' }),
    createGroupedSettlement({ id: 'g3', overallStatus: 'partial' }),
  ];

  it('payrollStatus가 undefined이면 전체를 반환한다', () => {
    const result = filterGroupedSettlements(groups);
    expect(result).toHaveLength(3);
  });

  it('pending 필터는 all_pending과 partial을 반환한다', () => {
    const result = filterGroupedSettlements(groups, 'pending');
    expect(result).toHaveLength(2);
    expect(result.map((g) => g.id)).toEqual(['g1', 'g3']);
  });

  it('completed 필터는 all_completed만 반환한다', () => {
    const result = filterGroupedSettlements(groups, 'completed');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('g2');
  });

  it('processing 같은 다른 상태는 전체를 반환한다', () => {
    const result = filterGroupedSettlements(groups, 'processing');
    expect(result).toHaveLength(3);
  });

  it('빈 배열은 빈 배열을 반환한다', () => {
    expect(filterGroupedSettlements([], 'pending')).toEqual([]);
  });
});

// ============================================================================
// formatGroupRolesDisplay
// ============================================================================

describe('formatGroupRolesDisplay', () => {
  it('단일 역할을 표시명으로 변환한다', () => {
    const group = createGroupedSettlement({ roles: ['dealer'] });
    expect(formatGroupRolesDisplay(group)).toBe('딜러');
  });

  it('빈 역할 배열은 빈 문자열을 반환한다', () => {
    const group = createGroupedSettlement({ roles: [] });
    expect(formatGroupRolesDisplay(group)).toBe('');
  });

  it('여러 역할은 "X 외 N개 역할" 형식으로 표시한다', () => {
    const group = createGroupedSettlement({
      roles: ['dealer', 'floor'],
    });
    const result = formatGroupRolesDisplay(group);
    expect(result).toBe('딜러 외 1개 역할');
  });

  it('other 역할에 customRole이 적용된다', () => {
    const group = createGroupedSettlement({
      roles: ['other'],
      customRoles: ['조명담당'],
    });
    expect(formatGroupRolesDisplay(group)).toBe('조명담당');
  });

  it('중복 역할 표시명이 제거된다', () => {
    const group = createGroupedSettlement({
      roles: ['dealer', 'dealer'],
    });
    // 딜러가 1번만 나오므로 단일 역할 형태
    expect(formatGroupRolesDisplay(group)).toBe('딜러');
  });
});
