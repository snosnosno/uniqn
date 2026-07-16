/**
 * OrderSheetScreen — 고정 유형 전환 배선 테스트 (S2 Task 6)
 *
 * 고정 세그먼트는 레거시로 이탈하지 않고 주문서 안에서 postingType='fixed'로 전환된다.
 * 날짜·시간 축 대신 '근무조건' 행(요일·출근시간) + '역할' 행으로 모집을 구성한다.
 * SheetModal 은 children+footer 렌더로 모킹(reanimated 배제) — tournament 테스트와 동일 스캐폴딩.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { OrderSheetScreen } from '../OrderSheetScreen';
import { initialOrderSheetValues } from '@/utils/order-sheet/mappers';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

// Fix 1(S2): 고정 역할 확정 시 급여 프리필 안내 토스트가 dated와 대칭으로 뜨는지 검증하려 addToast를 목킹한다.
const mockAddToast = jest.fn();
jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ addToast: mockAddToast }),
}));

// 참고: tournament/presets 테스트와 동일한 상위 모킹(SheetModal 등)을 재사용한다.
jest.mock('@/components/ui/SheetModal', () => {
  const { View, Text } = require('react-native');
  return {
    SheetModal: ({ visible, title, children, footer }: any) =>
      visible ? (
        <View>
          <Text>{title}</Text>
          {children}
          {footer}
        </View>
      ) : null,
  };
});

// RHF onChange 검증은 press 이후 비동기로 setState 하므로 act 로 flush 한다(경고 없는 pristine 출력).
const flushValidation = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('OrderSheetScreen — 고정 유형(S2)', () => {
  const baseProps = {
    initialValues: initialOrderSheetValues(),
    onSubmit: jest.fn(),
    isSubmitting: false,
    myPhone: '010-0000-0000',
  };

  it('고정 세그먼트 선택 시 레거시로 이탈하지 않는다', async () => {
    const onSwitchToLegacyForm = jest.fn();
    const { getByTestId } = render(
      <OrderSheetScreen {...baseProps} onSwitchToLegacyForm={onSwitchToLegacyForm} />
    );
    fireEvent.press(getByTestId('order-sheet-type-fixed'));
    await flushValidation();
    expect(onSwitchToLegacyForm).not.toHaveBeenCalled();
    expect(getByTestId('order-sheet-type-fixed').props.accessibilityState.selected).toBe(true);
  });

  it('고정 선택 시 근무조건 행이 보이고 날짜 행이 없다', async () => {
    const { getByTestId, queryByTestId } = render(
      <OrderSheetScreen {...baseProps} onSwitchToLegacyForm={jest.fn()} />
    );
    fireEvent.press(getByTestId('order-sheet-type-fixed'));
    await flushValidation();
    expect(getByTestId('order-sheet-row-workConditions')).toBeTruthy();
    expect(queryByTestId('order-sheet-row-dates')).toBeNull();
    // 역할 행은 고정에서도 존재(fixedSchedule.roles 편집 경로)
    expect(getByTestId('order-sheet-row-roles')).toBeTruthy();
  });
});

// Fix 1(S2): 고정 역할 확정 시 by_role 급여 프리필 안내 토스트(dated applyRoleSalarySync 대칭).
// 초기 시드(기존 역할 없음)는 '기본값' 배지가 담당 → 토스트 없음. 후속 추가(기존 엔트리 존재)만 1회 안내.
const fixedBase = (
  roles: { role: 'dealer' | 'floor'; count: number }[],
  roleSalaries: OrderSheetFormValues['roleSalaries'] = []
): OrderSheetFormValues => ({
  ...initialOrderSheetValues(),
  postingType: 'fixed',
  title: '주말 고정 딜러',
  location: { name: '강남 홀덤펍', region: '서울 강남구' },
  contactPhone: '010-1234-5678',
  scheduleGroups: [],
  fixedSchedule: { daysPerWeek: 5, startTime: '19:00', isStartTimeNegotiable: false, roles },
  roleSalaries,
});

describe('OrderSheetScreen — 고정 역할 급여 프리필 안내 토스트(S2 Fix 1)', () => {
  const fixedProps = {
    onSubmit: jest.fn(),
    isSubmitting: false,
    myPhone: '010-0000-0000',
    onSwitchToLegacyForm: jest.fn(),
  };
  beforeEach(() => {
    mockAddToast.mockClear();
  });

  it('기존 역할이 있는 상태에서 고정 역할 추가 시 기본 급여 적용 토스트가 뜬다', async () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen
        {...fixedProps}
        initialValues={fixedBase(
          [{ role: 'dealer', count: 1 }],
          [{ role: 'dealer', salary: { type: 'hourly', amount: 20000 } }]
        )}
      />
    );

    fireEvent.press(getByTestId('order-sheet-row-roles')); // 고정 → RolesSheet(fixedRoles) 직접
    fireEvent.press(getByTestId('order-role-chip-floor'));
    fireEvent.press(getByTestId('order-role-add'));
    fireEvent.press(getByText('확인'));
    await flushValidation();

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        message: expect.stringContaining('플로어 30,000원'),
      })
    );
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('급여 행에서 수정 가능') })
    );
  });

  it('초기 시드(기존 역할 없음)에서는 토스트가 뜨지 않는다', async () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen {...fixedProps} initialValues={fixedBase([], [])} />
    );

    fireEvent.press(getByTestId('order-sheet-row-roles'));
    fireEvent.press(getByTestId('order-role-chip-dealer'));
    fireEvent.press(getByTestId('order-role-add'));
    fireEvent.press(getByText('확인'));
    await flushValidation();

    expect(mockAddToast).not.toHaveBeenCalled();
  });
});

// 전체리뷰 후속(2026-07-16) — 타입 전환 축 데이터 보존(M7 승계). 파기 대신 스태시/복원.
describe('OrderSheetScreen — 타입 전환 축 데이터 보존 (전체리뷰 M7)', () => {
  const props = {
    onSubmit: jest.fn(),
    isSubmitting: false,
    myPhone: '010-0000-0000',
    onSwitchToLegacyForm: jest.fn(),
  };

  it('dated 날짜·시간 입력이 고정 전환 후 복귀 시 복원된다', async () => {
    const withDates: OrderSheetFormValues = {
      ...initialOrderSheetValues(),
      scheduleGroups: [
        {
          dates: ['2026-07-20'],
          timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
          grouped: false,
        },
      ],
    };
    const { getByTestId, getByText, queryByText } = render(
      <OrderSheetScreen {...props} initialValues={withDates} />
    );
    // 날짜 행 value = dates.join(', ') (orderRowMeta getRowState 'dates')
    expect(getByText('2026-07-20')).toBeTruthy();
    fireEvent.press(getByTestId('order-sheet-type-fixed'));
    await flushValidation();
    expect(queryByText('2026-07-20')).toBeNull(); // 고정 레이아웃 — 날짜 행 없음
    fireEvent.press(getByTestId('order-sheet-type-regular'));
    await flushValidation();
    expect(getByText('2026-07-20')).toBeTruthy(); // 복원(M7) — 무경고 소실 금지
    expect(getByText('출근 19:00')).toBeTruthy(); // 시간대·역할까지 통복원
  });

  it('fixed 근무조건이 dated 전환 후 복귀 시 복원된다', async () => {
    const { getByTestId, getByText, queryByText } = render(
      <OrderSheetScreen {...props} initialValues={fixedBase([{ role: 'dealer', count: 1 }])} />
    );
    expect(getByText('주 5일 · 출근 19:00')).toBeTruthy();
    fireEvent.press(getByTestId('order-sheet-type-tournament'));
    await flushValidation();
    expect(queryByText('주 5일 · 출근 19:00')).toBeNull(); // dated 레이아웃 — 근무조건 행 없음
    fireEvent.press(getByTestId('order-sheet-type-fixed'));
    await flushValidation();
    expect(getByText('주 5일 · 출근 19:00')).toBeTruthy(); // 복원(M7)
  });
});
