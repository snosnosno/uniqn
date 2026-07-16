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

describe('OrderSheetScreen — 일정 잠금(scheduleLocked, 확정 지원자)', () => {
  it('잠금 배너를 노출한다', () => {
    const { getByTestId } = render(
      <OrderSheetScreen {...baseProps} mode="edit" scheduleLocked initialValues={completeValues} />
    );
    expect(getByTestId('order-sheet-schedule-locked-notice')).toBeTruthy();
  });

  it('일정 행 탭 시 시트가 열리지 않는다', () => {
    const { getByTestId, queryByText } = render(
      <OrderSheetScreen {...baseProps} mode="edit" scheduleLocked initialValues={completeValues} />
    );
    fireEvent.press(getByTestId('order-sheet-row-dates'));
    // 날짜 시트(DatePickerModal title '날짜 선택')가 열리지 않음 — 잠금 토스트만
    expect(queryByText('날짜 선택')).toBeNull();
  });

  it('제목 등 비일정 행은 잠기지 않는다', () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen {...baseProps} mode="edit" scheduleLocked initialValues={completeValues} />
    );
    fireEvent.press(getByTestId('order-sheet-row-title'));
    // 제목 시트(SheetModal title '공고 제목')는 정상 오픈 — 행 라벨 '제목'과 구분되는 시트 전용 문자열
    expect(getByText('공고 제목')).toBeTruthy();
  });
});

describe('OrderSheetScreen — 잠금 부가 가드(그룹 삭제·일정 추가·토스트 문구, S3 이월)', () => {
  beforeEach(() => {
    mockAddToast.mockClear();
  });

  it('잠금: 그룹 삭제 버튼이 토스트만 내고 그룹을 제거하지 않는다', () => {
    const { getByTestId, queryAllByTestId } = render(
      <OrderSheetScreen
        {...baseProps}
        mode="edit"
        scheduleLocked
        initialValues={twoGroupCompleteValues}
      />
    );
    // 그룹 2개 → 삭제 버튼 노출(E4). 잠금 상태에서 눌러도 guardScheduleLock이 선차단한다.
    fireEvent.press(getByTestId('order-sheet-group-delete-0'));
    expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning' }));
    // 삭제 성공 토스트(success)로 오분기하지 않음 — 경고만 1회
    expect(mockAddToast).toHaveBeenCalledTimes(1);
    // 그룹 수 불변(서브그룹 헤더 2개 유지) — 삭제가 실행되면 단일 레이아웃으로 붕괴해 0이 된다
    expect(queryAllByTestId(/order-sheet-group-dates-/)).toHaveLength(2);
  });

  it('잠금: 일정 추가 버튼이 날짜 시트를 열지 않는다', () => {
    const { getByTestId, queryByText } = render(
      <OrderSheetScreen {...baseProps} mode="edit" scheduleLocked initialValues={completeValues} />
    );
    fireEvent.press(getByTestId('order-sheet-add-schedule'));
    // 날짜 시트(ScheduleDatesSheet title '날짜 선택')가 열리지 않음 — 잠금 토스트만
    expect(queryByText('날짜 선택')).toBeNull();
    expect(mockAddToast).toHaveBeenCalledTimes(1);
    expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning' }));
  });

  it('잠금 토스트 문구 고정 — 확정 지원자 안내', () => {
    const { getByTestId } = render(
      <OrderSheetScreen {...baseProps} mode="edit" scheduleLocked initialValues={completeValues} />
    );
    fireEvent.press(getByTestId('order-sheet-row-dates'));
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'warning',
        message: '확정된 지원자가 있어 일정과 역할은 수정할 수 없어요.',
      })
    );
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
