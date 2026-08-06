/**
 * SettlementDetailModal — 액션 줄 렌더 규칙 (D4 진입점 통일)
 *
 * 이 스위트가 고정하는 계약 셋:
 *  1. 🔴 **`payrollStatus` 는 3값이다**(`pending | completed | failed`). 액션 줄을
 *     `=== PENDING` 으로 열면 **failed 가 통째로 액션을 잃는다** — 정산이 실패한 건이야말로
 *     시간·금액을 고쳐 다시 정산해야 하는 건인데 손댈 입구가 사라진다.
 *  2. 🔴 **정산 완료 건도 시트에 들어간다**(D4·D2). 거절은 버튼을 숨겨서가 아니라
 *     시트의 읽기 전용 모드가 말한다 — 세 진입점(근무표·스태프관리·정산)이 같은 답을 준다.
 *  3. 🔴 정산 완료 건에서 **금액 수정·지급 완료는 여전히 없다**. 연 것은 열람뿐이다.
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

// 표시 섹션들은 스텁 — 남는 것은 SettlementActionButtons 와 정산 완료 블록뿐이다.
jest.mock('../DateNavigationHeader', () => ({ DateNavigationHeader: () => null }));
jest.mock('../StaffProfileHeader', () => ({ StaffProfileHeader: () => null }));
jest.mock('../WorkTimeSection', () => ({ WorkTimeSection: () => null }));
jest.mock('../SettlementAmountSection', () => ({ SettlementAmountSection: () => null }));
jest.mock('../TimeModificationHistory', () => ({ TimeModificationHistory: () => null }));
jest.mock('../AmountModificationHistory', () => ({ AmountModificationHistory: () => null }));
jest.mock('../SettlementCompletedBanner', () => ({ SettlementCompletedBanner: () => null }));

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
      onSettle={jest.fn()}
      {...props}
    />
  );
}

describe('SettlementDetailModal — 미정산(pending)', () => {
  it('세 버튼이 모두 뜬다', () => {
    renderModal({ payrollStatus: 'pending' });

    expect(screen.getByText('시간 수정')).toBeTruthy();
    expect(screen.getByText('금액 수정')).toBeTruthy();
    expect(screen.getByText('지급 완료로 표시')).toBeTruthy();
  });
});

describe('SettlementDetailModal — 정산 실패(failed)', () => {
  it('🔴 failed 도 미정산과 똑같이 세 버튼이 뜬다', () => {
    // `=== PENDING` 게이트에서는 액션 줄 자체가 사라져 재정산 경로가 0이 됐다.
    renderModal({ payrollStatus: 'failed' });

    expect(screen.getByText('시간 수정')).toBeTruthy();
    expect(screen.getByText('금액 수정')).toBeTruthy();
    expect(screen.getByText('지급 완료로 표시')).toBeTruthy();
  });
});

describe('SettlementDetailModal — 정산 완료(completed)', () => {
  it('🔴 시간 수정은 뜬다 — 읽기 전용 시트로 들어가는 입구다', () => {
    renderModal({ payrollStatus: 'completed' });

    expect(screen.getByText('시간 수정')).toBeTruthy();
  });

  it('🔴 금액 수정·지급 완료는 뜨지 않는다 — 연 것은 열람뿐이다', () => {
    renderModal({ payrollStatus: 'completed' });

    expect(screen.queryByText('금액 수정')).toBeNull();
    expect(screen.queryByText('지급 완료로 표시')).toBeNull();
  });

  it('지급 완료 취소는 그대로 남는다 — 오지급 정정의 유일한 경로', () => {
    renderModal({ payrollStatus: 'completed' }, { onRevertSettlement: jest.fn() });

    expect(screen.getByText('지급 완료 취소')).toBeTruthy();
  });
});

describe('SettlementDetailModal — 빈 액션 줄', () => {
  it('그려질 버튼이 하나도 없으면 액션 줄을 렌더하지 않는다', () => {
    // 정산 완료인데 onEditTime 배선이 없는 호출부 — 예전 구조라면 빈 여백만 남았다.
    renderModal(
      { payrollStatus: 'completed' },
      { onEditTime: undefined, onEditAmount: undefined, onSettle: undefined }
    );

    expect(screen.queryByTestId('settlement-actions')).toBeNull();
  });

  it('대조군 — 버튼이 하나라도 있으면 액션 줄이 산다', () => {
    renderModal({ payrollStatus: 'completed' });

    expect(screen.getByTestId('settlement-actions')).toBeTruthy();
  });
});
