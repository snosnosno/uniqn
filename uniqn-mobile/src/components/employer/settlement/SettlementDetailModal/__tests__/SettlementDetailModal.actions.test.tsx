/**
 * SettlementDetailModal(계산 근거) — 액션 줄 렌더 규칙 (구인자 IA S2)
 *
 * 앱은 돈을 만지지 않는다. 정산 **워크플로우**(지급 완료 표시·취소)를 없애고 금액 계산·표시만 남겼다.
 *
 * 이 스위트가 고정하는 계약:
 *  1. 🔴 `지급 완료로 표시`·`지급 완료 취소` 는 어떤 상태에서도 없다.
 *  2. 🔴 **이미 확정된 금액이 있는 근무**(과거에 지급 완료로 처리된 행)는 금액 수정이 없다 —
 *     그때 확정된 금액을 그대로 보여주고, 그 사실을 한 줄로 밝힌다.
 *  3. 🔴 `근무 수정` 은 늘 뜬다 — 세 진입점(근무표·스태프관리·계산 근거)이 같은 시트를 연다.
 *  4. 🔴 `평가 남기기` 는 **퇴근이 기록된 근무**에 뜬다. 예전엔 지급 완료에 묶여 있어서
 *     지급 완료 버튼이 사라지면 구인자 쪽 평가 진입점이 영영 안 뜨게 된다.
 *
 * ⚠️ `toHaveTextContent(문자열)` 은 RNTL 13.3.3 에서 완전일치라 `.not.` 형태가 빈 가드가 된다.
 *    여기서는 버튼 존재 여부를 `queryByText` 로 직접 본다.
 */
import { render, screen } from '@testing-library/react-native';
import React from 'react';

import type { WorkLog } from '@/types';
import type { SalaryInfo } from '@/utils/settlement';

import { SettlementDetailModal } from '../SettlementDetailModal';

// SheetModal 은 RNModal + reanimated 라 무겁다 — children 을 그대로 편다.
jest.mock('@/components/ui/SheetModal', () => {
  const { View } = require('react-native');
  return {
    SheetModal: ({ visible, children }: any) => (visible ? <View>{children}</View> : null),
  };
});

jest.mock('@/stores/themeStore', () => ({ useThemeStore: () => ({ isDarkMode: false }) }));

jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    displayName: '김딜러',
    profilePhotoURL: undefined,
    profilePhotoURLBlurhash: null,
  }),
}));

jest.mock('@/hooks/useSettlementDateNavigation', () => ({
  useSettlementDateNavigation: () => ({
    isGroupMode: false,
    currentDateIndex: 0,
    totalDays: 1,
    canGoPrev: false,
    canGoNext: false,
    handlePrevDate: jest.fn(),
    handleNextDate: jest.fn(),
  }),
}));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

// 금액 계산은 이 스위트의 관심사가 아니다 — 액션 줄이 뜨는 조건만 본다.
jest.mock('@/utils/settlement', () => ({
  ...jest.requireActual('@/utils/settlement'),
  calculateSettlementFromWorkLog: () => ({ hoursWorked: 8, totalAmount: 100000 }),
}));

// 표시 섹션들은 스텁 — 남는 것은 액션 줄·확정 금액 안내·평가 버튼뿐이다.
jest.mock('../DateNavigationHeader', () => ({ DateNavigationHeader: () => null }));
jest.mock('../StaffProfileHeader', () => ({ StaffProfileHeader: () => null }));
jest.mock('../WorkTimeSection', () => ({ WorkTimeSection: () => null }));
jest.mock('../SettlementAmountSection', () => ({ SettlementAmountSection: () => null }));
jest.mock('../TimeModificationHistory', () => ({ TimeModificationHistory: () => null }));
jest.mock('../AmountModificationHistory', () => ({ AmountModificationHistory: () => null }));

const BASE_WORK_LOG = {
  id: 'wl-1',
  staffId: 'staff-1',
  staffName: '김딜러',
  role: 'dealer',
  date: '2026-07-05',
  timeSlot: '19:00 - 23:00',
  checkInTime: '2026-07-05T10:00:00.000Z',
  checkOutTime: '2026-07-05T18:00:00.000Z',
  payrollStatus: 'pending',
  modificationHistory: [],
} as unknown as WorkLog;

const SALARY_INFO = { salaryType: 'hourly', salaryAmount: 12000 } as unknown as SalaryInfo;

function renderModal(
  workLogOverrides: Partial<WorkLog> = {},
  props: Partial<React.ComponentProps<typeof SettlementDetailModal>> = {}
) {
  return render(
    <SettlementDetailModal
      visible
      onClose={jest.fn()}
      workLog={{ ...BASE_WORK_LOG, ...workLogOverrides }}
      salaryInfo={SALARY_INFO}
      onEditTime={jest.fn()}
      onEditAmount={jest.fn()}
      {...props}
    />
  );
}

describe('SettlementDetailModal — 지급 워크플로우 없음', () => {
  it.each(['pending', 'failed', 'completed'])(
    '🔴 payrollStatus=%s 에서도 지급 완료 표시·취소 버튼이 없다',
    (payrollStatus) => {
      renderModal({ payrollStatus } as Partial<WorkLog>);

      expect(screen.queryByText('지급 완료로 표시')).toBeNull();
      expect(screen.queryByText('지급 완료 취소')).toBeNull();
    }
  );
});

describe('SettlementDetailModal — 계산 중인 근무', () => {
  it('근무 수정·금액 수정이 뜬다', () => {
    renderModal({ payrollStatus: 'pending' } as Partial<WorkLog>);

    expect(screen.getByText('근무 수정')).toBeTruthy();
    expect(screen.getByText('금액 수정')).toBeTruthy();
    expect(screen.queryByTestId('settlement-frozen-note')).toBeNull();
  });
});

describe('SettlementDetailModal — 이미 확정된 금액이 있는 근무', () => {
  it('🔴 근무 수정은 뜨고 금액 수정은 없다 — 확정 금액을 그대로 보여준다', () => {
    renderModal({ payrollStatus: 'completed' } as Partial<WorkLog>);

    expect(screen.getByText('근무 수정')).toBeTruthy();
    expect(screen.queryByText('금액 수정')).toBeNull();
  });

  it('확정된 금액이라는 사실을 한 줄로 밝힌다', () => {
    renderModal({ payrollStatus: 'completed' } as Partial<WorkLog>);

    expect(screen.getByTestId('settlement-frozen-note')).toBeTruthy();
  });
});

describe('SettlementDetailModal — 평가 남기기', () => {
  it('🔴 퇴근이 기록된 근무면 지급 상태와 무관하게 뜬다', () => {
    renderModal({ payrollStatus: 'pending' } as Partial<WorkLog>);

    expect(screen.getByText('평가 남기기')).toBeTruthy();
  });

  it('퇴근 전 근무에는 뜨지 않는다 — 평가할 근무가 아직 끝나지 않았다', () => {
    renderModal({ checkOutTime: undefined } as Partial<WorkLog>);

    expect(screen.queryByText('평가 남기기')).toBeNull();
  });
});

describe('SettlementDetailModal — 빈 액션 줄', () => {
  it('그려질 버튼이 하나도 없으면 액션 줄을 렌더하지 않는다', () => {
    renderModal({ payrollStatus: 'completed' } as Partial<WorkLog>, {
      onEditTime: undefined,
      onEditAmount: undefined,
    });

    expect(screen.queryByTestId('settlement-actions')).toBeNull();
  });

  it('대조군 — 버튼이 하나라도 있으면 액션 줄이 산다', () => {
    renderModal({ payrollStatus: 'completed' } as Partial<WorkLog>);

    expect(screen.getByTestId('settlement-actions')).toBeTruthy();
  });
});
