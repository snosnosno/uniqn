/**
 * PlaceSheet — 장소 선택 시트 테스트 (인라인 3단 모드: list → new → region)
 *
 * SheetModal 은 children+footer 만 렌더로 모킹. 검증:
 * (1) 지역 보유 최근 장소 탭 → onConfirm+onClose, (2) 지역 없는 최근 장소 탭 → 확정 대신 지역 선택 유도(하위호환),
 * (3) 빈 이름은 확인 비활성, (4) 새 장소는 이름만으로 확인 비활성 — 2패널 택소노미 단일선택으로 지역 선택 후에만 확정,
 * (5) 구 보유 시(부산) 아코디언 — "부산 전체"(시 slug) 선택, (6) rising-edge 동기화 레이스,
 * (7) XSS — 시트가 흘려보내는 값을 orderSheetValuesSchema 경계가 거부.
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
  it('최근 장소(지역 있음) 탭 시 onConfirm + onClose', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const recent = [
      { name: '라운더스 홀덤펍', address: '서울 강남구 역삼동', region: '서울 강남구' },
    ];
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

  it('지역 없는 최근 장소 탭 시 확정하지 않고 지역 선택으로 유도한다 (하위호환 게이트)', () => {
    const onConfirm = jest.fn();
    const recent = [{ name: '옛 홀덤펍', address: '서울 어딘가' }];
    const { getByText, getByTestId } = render(
      <PlaceSheet
        visible
        value={null}
        recentLocations={recent}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByText('옛 홀덤펍'));
    expect(onConfirm).not.toHaveBeenCalled();
    // region 모드 진입 — 택소노미 브라우저 검색박스 노출
    expect(getByTestId('order-sheet-region-search')).toBeTruthy();
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

  it('새 장소 — 이름만으로는 확인 비활성, 지역 선택 후 slug 포함 확정 (필수 게이트)', () => {
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
    expect(onConfirm).not.toHaveBeenCalled(); // 지역 미선택 — 비활성

    fireEvent.press(getByText('지역 선택'));
    // 브라우저: 기본 서울 그룹 — 구 칩은 label(강남구), 저장은 slug(서울 강남구)
    fireEvent.press(getByText('강남구'));
    expect(getByText('지역: 강남구')).toBeTruthy(); // new 모드 복귀 + label 요약

    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({ name: '강남 홀덤펍', region: '서울 강남구' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('구 보유 시(부산)는 아코디언 — "부산 전체"(시 slug)도 선택 가능하다', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <PlaceSheet
        visible
        value={null}
        recentLocations={[]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.changeText(getByTestId('order-sheet-place-name'), '부산 홀덤펍');
    fireEvent.press(getByText('지역 선택'));
    fireEvent.press(getByText('경상'));
    fireEvent.press(getByText('부산')); // 펼침(픽 아님)
    fireEvent.press(getByText('부산 전체'));
    expect(getByText('지역: 부산')).toBeTruthy();

    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ region: '부산' }));
  });

  it('시트 열림 상태에서 recentLocations 가 0→N 늘어도 편집 중 draft·mode 를 리셋하지 않는다 (쿼리 해소 레이스)', () => {
    // Task 9 실데이터 배선이 처음 도달 가능케 한 편집 텍스트 유실 레이스 방지 —
    // 동기화는 visible 상승 에지에서만 수행, 시트가 열린 동안 recentLocations 변경은 무시한다.
    const { getByTestId, rerender } = render(
      <PlaceSheet
        visible
        value={null}
        recentLocations={[]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );

    // 새 입력 모드에서 장소명 타이핑 중
    fireEvent.changeText(getByTestId('order-sheet-place-name'), '라운더스');

    // 쿼리 해소로 최근 장소 0→N 전이 (시트는 계속 열림)
    rerender(
      <PlaceSheet
        visible
        value={null}
        recentLocations={[{ name: '이전 홀덤펍' }]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );

    // 입력 필드가 여전히 존재(list 모드로 flip 안 됨) + 텍스트 유지 —
    // getByTestId 가 던지지 않고 value 가 유지되면 mode·draft 둘 다 보존된 것.
    expect(getByTestId('order-sheet-place-name').props.value).toBe('라운더스');
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
