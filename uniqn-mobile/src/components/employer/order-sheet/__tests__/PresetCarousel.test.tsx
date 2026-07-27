/**
 * PresetCarousel — 프리셋 캐러셀(마지막 공고 + 저장 템플릿) 테스트
 *
 * (1) 프리셋 없으면 온보딩 안내 문구(저장 카드도 숨김),
 * (2) 프리셋 카드 탭 → 해당 프리셋으로 onSelect,
 * (3) "저장" 카드 탭 → onSavePress.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { PresetCarousel, type OrderSheetPreset } from '../PresetCarousel';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

const makeValues = (title: string): OrderSheetFormValues => ({
  postingType: 'regular',
  title,
  location: { name: '라운더스 홀덤펍' },
  contactPhone: '010-1234-5678',
  scheduleGroups: [
    {
      dates: [],
      timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 1 }] }],
      grouped: false,
    },
  ],
  salary: { type: 'hourly', amount: 20000 },
});

describe('PresetCarousel', () => {
  it('프리셋이 없으면 온보딩 안내 문구를 보여주고 저장 카드는 숨긴다', () => {
    const { getByText, queryByTestId } = render(
      <PresetCarousel presets={[]} onSelect={jest.fn()} onSavePress={jest.fn()} />
    );
    expect(getByText(/아직 프리셋이 없어요/)).toBeTruthy();
    expect(queryByTestId('order-sheet-preset-save')).toBeNull();
  });

  // W1-12 / ORDER-9: 로딩 중에 '없어요' 를 단정하면 재방문 사장에게 거짓말이 된다 —
  // 잠시 뒤 카드가 나타나면서 안내가 뒤집힌다.
  it('불러오는 중이면 없다고 단정하지 않고 스켈레톤을 보여준다', () => {
    const { queryByText, getByTestId } = render(
      <PresetCarousel presets={[]} onSelect={jest.fn()} onSavePress={jest.fn()} isLoading />
    );
    expect(queryByText(/아직 프리셋이 없어요/)).toBeNull();
    expect(getByTestId('order-sheet-preset-skeleton')).toBeTruthy();
  });

  it('다 불러왔는데 정말 없으면 그때 온보딩 안내를 보여준다', () => {
    const { getByText, queryByTestId } = render(
      <PresetCarousel presets={[]} onSelect={jest.fn()} onSavePress={jest.fn()} isLoading={false} />
    );
    expect(getByText(/아직 프리셋이 없어요/)).toBeTruthy();
    expect(queryByTestId('order-sheet-preset-skeleton')).toBeNull();
  });

  it('프리셋 카드 탭 시 해당 프리셋으로 onSelect 호출', () => {
    const onSelect = jest.fn();
    const preset: OrderSheetPreset = {
      id: 'last',
      title: '마지막 공고',
      subtitle: '주말 딜러',
      values: makeValues('주말 딜러'),
    };
    const { getByTestId } = render(
      <PresetCarousel presets={[preset]} onSelect={onSelect} onSavePress={jest.fn()} />
    );
    fireEvent.press(getByTestId('order-sheet-preset-last'));
    expect(onSelect).toHaveBeenCalledWith(preset);
  });

  it('저장 카드 탭 시 onSavePress 호출', () => {
    const onSavePress = jest.fn();
    const preset: OrderSheetPreset = {
      id: 't1',
      title: '템플릿',
      subtitle: '',
      values: makeValues('템플릿'),
    };
    const { getByTestId } = render(
      <PresetCarousel presets={[preset]} onSelect={jest.fn()} onSavePress={onSavePress} />
    );
    fireEvent.press(getByTestId('order-sheet-preset-save'));
    expect(onSavePress).toHaveBeenCalledTimes(1);
  });
});
