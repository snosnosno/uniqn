/**
 * OrderSheetScreen — 프리셋 캐러셀 배선 테스트 (Task 9)
 *
 * (1) presets 전달 시 캐러셀 렌더, (2) 프리셋 카드 탭 → form.reset 으로 값 교체(저장 콜백에 새 값 반영),
 * (3) "＋ 저장" 카드 탭 → onSaveTemplate(현재 폼 값), (4) presets 의 title 이 제목 시트 최근 칩으로 노출.
 * SheetModal 은 children+footer 렌더로 모킹(reanimated 배제).
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { OrderSheetScreen } from '../OrderSheetScreen';
import type { OrderSheetPreset } from '../PresetCarousel';
import { initialOrderSheetValues } from '@/utils/order-sheet/mappers';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

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

const baseProps = {
  onSubmit: jest.fn(),
  isSubmitting: false,
};

const presetValues: OrderSheetFormValues = {
  ...initialOrderSheetValues(),
  title: '프리셋 딜러',
  location: { name: '라운더스 홀덤펍', address: '서울 강남구' },
  contactPhone: '010-1234-5678',
  scheduleGroups: [
    {
      dates: [],
      timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
      grouped: false,
    },
  ],
};

const lastPreset: OrderSheetPreset = {
  id: 'last',
  title: '⚡ 마지막 공고',
  subtitle: '지난 공고 요약',
  values: presetValues,
};

describe('OrderSheetScreen — 프리셋 캐러셀 배선', () => {
  it('presets 전달 시 캐러셀 카드를 렌더한다', () => {
    const { getByTestId } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={initialOrderSheetValues()}
        presets={[lastPreset]}
      />
    );
    expect(getByTestId('order-sheet-preset-last')).toBeTruthy();
    expect(getByTestId('order-sheet-preset-save')).toBeTruthy();
  });

  it('프리셋 카드 탭 → form.reset 로 값 교체 → 저장 콜백에 새 title 반영', () => {
    const onSaveTemplate = jest.fn();
    const { getByTestId } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={initialOrderSheetValues()} // title=''
        presets={[lastPreset]}
        onSaveTemplate={onSaveTemplate}
      />
    );
    fireEvent.press(getByTestId('order-sheet-preset-last')); // form.reset(preset.values)
    fireEvent.press(getByTestId('order-sheet-preset-save')); // onSaveTemplate(form.getValues())
    expect(onSaveTemplate).toHaveBeenCalledTimes(1);
    expect(onSaveTemplate).toHaveBeenCalledWith(expect.objectContaining({ title: '프리셋 딜러' }));
  });

  it('presets 의 values.title 이 제목 시트 최근 칩으로 노출된다', () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={initialOrderSheetValues()}
        presets={[lastPreset]}
      />
    );
    fireEvent.press(getByTestId('order-sheet-row-title')); // TitleSheet 오픈
    // 캐러셀 카드는 '⚡ 마지막 공고'/'지난 공고 요약'만 노출 → '프리셋 딜러'는 최근 칩만 매칭
    expect(getByText('프리셋 딜러')).toBeTruthy();
  });
});
