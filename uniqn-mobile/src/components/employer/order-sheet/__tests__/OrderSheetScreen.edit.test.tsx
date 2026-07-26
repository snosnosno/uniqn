/**
 * OrderSheetScreen 편집 모드(S3) — 타입 세그먼트 잠금·수정 라벨·대회 배너 숨김·일정 잠금.
 * SheetModal은 children+footer 렌더로 모킹(reanimated 배제) — tournament 테스트와 동일 스캐폴딩.
 *
 * 실측 보정(브리프 허용): 비일정 행(제목)의 시트 오픈 어서션은 SheetModal 제목 '공고 제목'으로 고정한다.
 * OrderRow가 항상 렌더하는 행 라벨 '제목'과 충돌해 vacuous pass가 되지 않도록 시트 전용 문자열을 쓴다.
 * 잠금 일정 행 어서션은 날짜 시트(DatePickerModal)의 실제 Modal 제목 '날짜 선택'으로 고정한다(마운트 시 미존재 → 오픈 시만 등장).
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { OrderSheetScreen } from '../OrderSheetScreen';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

// 토스트 스토어 mock — scheduleGroups.test.tsx 관례 재사용(새 mock 체계 금지). 잠금 가드가
// addToast(warning)로 안내하는지 검증하려면 실 스토어 대신 스파이 형상이 필요하다.
const mockAddToast = jest.fn();
jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ addToast: mockAddToast }),
}));

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

// 전 행이 채워진 완성 폼 — firstUnsetRow가 null이 되어 submitLabel이 모드 라벨로 해석된다.
const completeValues: OrderSheetFormValues = {
  postingType: 'regular',
  title: '주말 딜러 구합니다',
  location: { name: '라운더스 홀덤펍', address: '서울 강남구', region: 'seoul-gangnam' },
  contactPhone: '010-1234-5678',
  description: '',
  scheduleGroups: [
    {
      dates: ['2026-07-20'],
      timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
      grouped: false,
    },
  ],
  salary: { type: 'hourly', amount: 20000 },
  useSameSalary: true,
  roleSalaries: [],
  allowances: {},
  conditions: {},
  usesPreQuestions: false,
  preQuestions: [],
};

const completeTournamentValues: OrderSheetFormValues = {
  ...completeValues,
  postingType: 'tournament',
  title: 'WSOP 서울 딜러',
};

// 2그룹 완성 폼 — 그룹 삭제 버튼(order-sheet-group-delete-*)은 그룹 2개+에서만 노출(E4).
const twoGroupCompleteValues: OrderSheetFormValues = {
  ...completeValues,
  scheduleGroups: [
    {
      dates: ['2026-07-20'],
      timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
      grouped: false,
    },
    {
      dates: ['2026-07-25'],
      timeSlots: [{ startTime: '21:00', roles: [{ role: 'floor', count: 1 }] }],
      grouped: false,
    },
  ],
};

const baseProps = {
  onSubmit: jest.fn(),
  isSubmitting: false,
  myPhone: '010-0000-0000',
};

describe('OrderSheetScreen — 편집 모드(S3)', () => {
  it('mode=edit면 타입 세그먼트가 잠긴다(탭해도 전환 없음 + disabled 상태)', () => {
    const { getByTestId } = render(
      <OrderSheetScreen {...baseProps} mode="edit" initialValues={completeValues} />
    );
    const fixedTab = getByTestId('order-sheet-type-fixed');
    expect(fixedTab.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(fixedTab);
    expect(getByTestId('order-sheet-type-regular').props.accessibilityState.selected).toBe(true);
  });

  it('mode=edit 완성 폼의 제출 라벨은 "이대로 수정"이다(대회 포함 — 승인상태 보존 ⑥)', () => {
    const { getByText } = render(
      <OrderSheetScreen {...baseProps} mode="edit" initialValues={completeTournamentValues} />
    );
    expect(getByText('이대로 수정')).toBeTruthy();
  });

  it('mode=edit면 대회 생성 배너(승인 1~2 영업일)를 숨긴다', () => {
    const { queryByTestId } = render(
      <OrderSheetScreen {...baseProps} mode="edit" initialValues={completeTournamentValues} />
    );
    expect(queryByTestId('order-sheet-tournament-notice')).toBeNull();
  });

  it('mode=edit 제출 버튼 testID는 레거시 계승(job-posting-edit-submit)', () => {
    const { getByTestId, queryByTestId } = render(
      <OrderSheetScreen {...baseProps} mode="edit" initialValues={completeValues} />
    );
    expect(getByTestId('job-posting-edit-submit')).toBeTruthy();
    expect(queryByTestId('job-posting-create-submit')).toBeNull();
  });

  it('mode 기본값(create)은 기존 계약 무회귀 — 등록 라벨·create testID', () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen {...baseProps} initialValues={completeValues} />
    );
    expect(getByTestId('job-posting-create-submit')).toBeTruthy();
    expect(getByText('이대로 등록')).toBeTruthy();
  });
});

/**
 * 확정 지원자 일정 잠금 폐지 회귀 게이트.
 *
 * 예전에는 확정자가 1명이라도 있으면 `scheduleLocked` 로 일정·역할 행 전체를 잠갔다. 그 보호는
 * 서버에서 "확정자가 배정된 역할의 소멸"만 막는 형태로 좁아졌고(assertConfirmedRolesSurvive),
 * 편집 화면은 잠금 개념 자체를 갖지 않는다. 아래는 잠금이 되살아나면 깨지는 방향으로 고정한다.
 */
describe('OrderSheetScreen — 편집 모드 일정 개방(확정자 잠금 폐지)', () => {
  beforeEach(() => {
    mockAddToast.mockClear();
  });

  it('잠금 배너를 렌더하지 않는다', () => {
    const { queryByTestId } = render(
      <OrderSheetScreen {...baseProps} mode="edit" initialValues={completeValues} />
    );
    expect(queryByTestId('order-sheet-schedule-locked-notice')).toBeNull();
  });

  it('일정 행 탭이 날짜 시트를 연다', () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen {...baseProps} mode="edit" initialValues={completeValues} />
    );
    fireEvent.press(getByTestId('order-sheet-row-dates'));
    expect(getByText('날짜 선택')).toBeTruthy();
    // 경고 토스트가 끼어들지 않는다(옛 잠금 경로의 흔적).
    expect(mockAddToast).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'warning' }));
  });

  it('일정 추가 버튼이 날짜 시트를 연다', () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen {...baseProps} mode="edit" initialValues={completeValues} />
    );
    fireEvent.press(getByTestId('order-sheet-add-schedule'));
    expect(getByText('날짜 선택')).toBeTruthy();
  });

  it('그룹 삭제 버튼이 실제로 그룹을 제거한다', () => {
    const { getByTestId, queryAllByTestId } = render(
      <OrderSheetScreen {...baseProps} mode="edit" initialValues={twoGroupCompleteValues} />
    );
    expect(queryAllByTestId(/order-sheet-group-dates-/)).toHaveLength(2);
    fireEvent.press(getByTestId('order-sheet-group-delete-0'));
    // 그룹이 1개로 줄면 서브그룹 헤더 레이아웃이 해제된다(0개).
    expect(queryAllByTestId(/order-sheet-group-dates-/)).toHaveLength(0);
    expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });
});

describe('OrderSheetScreen — 편집 템플릿 저장 렌더(S3 ghost 이월)', () => {
  it('mode=edit + onSaveTemplate이면 템플릿 저장 버튼을 렌더하고, press 시 현재 폼 값으로 1회 호출한다', () => {
    const onSaveTemplate = jest.fn();
    const { getByTestId } = render(
      <OrderSheetScreen
        {...baseProps}
        mode="edit"
        onSaveTemplate={onSaveTemplate}
        initialValues={completeValues}
      />
    );
    fireEvent.press(getByTestId('order-sheet-edit-save-template'));
    expect(onSaveTemplate).toHaveBeenCalledTimes(1);
    // form.getValues() 스냅샷 전달 — 현재 폼 값(제목·타입)이 그대로 실린다
    expect(onSaveTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ title: '주말 딜러 구합니다', postingType: 'regular' })
    );
  });
});
