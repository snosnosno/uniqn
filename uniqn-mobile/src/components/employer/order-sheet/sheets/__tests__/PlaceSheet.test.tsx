/**
 * PlaceSheet — 장소 선택 시트 테스트 (인라인 3단 모드: list → new → region)
 *
 * SheetModal 은 children+footer 만 렌더로 모킹. 검증:
 * (1) 최근 장소 리스트 탭 → onConfirm+onClose, (2) 새 장소 입력 후 확인 → trim 된 이름으로 onConfirm,
 * (3) 빈 이름은 확인 비활성, (4) 지역 인라인 3단 — 칩은 label 표기·slug 저장(중첩 Modal 미사용),
 * (5) XSS 검증 경로 — 시트가 값을 흘려보내는 orderSheetValuesSchema 경계가 위험 문자열을 거부.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { PlaceSheet } from '../PlaceSheet';
import { orderSheetValuesSchema } from '@/schemas/orderSheet.schema';

jest.mock('@/components/ui/SheetModal', () => {
  const { View } = require('react-native');
  return {
    SheetModal: ({ visible, children, footer }: any) =>
      visible ? (
        <View>
          {children}
          {footer}
        </View>
      ) : null,
  };
});

describe('PlaceSheet', () => {
  it('최근 장소가 있으면 리스트 모드 — 항목 탭 시 onConfirm + onClose', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const recent = [{ name: '라운더스 홀덤펍', address: '서울 강남구 역삼동' }];
    const { getByText } = render(
      <PlaceSheet
        visible
        value={null}
        recentLocations={recent}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    fireEvent.press(getByText('라운더스 홀덤펍'));
    expect(onConfirm).toHaveBeenCalledWith(recent[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('최근 장소가 없으면 새 입력 모드 — 이름 입력 후 확인 시 trim 된 이름으로 onConfirm', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const { getByTestId, getByText } = render(
      <PlaceSheet
        visible
        value={null}
        recentLocations={[]}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    fireEvent.changeText(getByTestId('order-sheet-place-name'), '  강남 홀덤펍  ');
    fireEvent.press(getByText('확인'));

    expect(onConfirm).toHaveBeenCalledWith({ name: '강남 홀덤펍' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('빈 이름이면 확인 버튼 비활성 (onConfirm 미호출)', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <PlaceSheet
        visible
        value={null}
        recentLocations={[]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByText('확인'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('지역 인라인 3단 — 칩은 label(강남구)로 표기하고 slug(서울 강남구)를 저장한다', () => {
    const { getByText } = render(
      <PlaceSheet
        visible
        value={null}
        recentLocations={[]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );

    // new 모드에서 지역 선택 진입
    fireEvent.press(getByText('지역 선택 (선택)'));
    // region 모드: 라벨(강남구) 노출 — slug('서울 강남구')가 아님
    expect(getByText('강남구')).toBeTruthy();

    fireEvent.press(getByText('강남구'));
    // new 모드 복귀 + 버튼에 저장된 slug 표기
    expect(getByText('지역: 서울 강남구')).toBeTruthy();
  });

  it('XSS 검증 경로 — 위험 문자열 장소명은 스키마 경계에서 거부된다', () => {
    // PlaceSheet 는 onConfirm 으로 값을 흘려보내고, 부모가 setValue(shouldValidate) 로 이 스키마를 태운다.
    const result = orderSheetValuesSchema.safeParse({
      postingType: 'regular',
      title: '정상 제목',
      location: { name: '<script>alert(1)</script>' },
      contactPhone: '010-1234-5678',
      dates: ['2026-07-14'],
      timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 1 }] }],
      salary: { type: 'hourly', amount: 20000 },
    });
    expect(result.success).toBe(false);
  });
});
