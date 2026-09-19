/**
 * DirectionsButton — 지도 앱 선택 UI 가 RN Modal 을 새로 열지 않는다는 것을 고정한다.
 *
 * 이 버튼은 InfoTab → ScheduleDetailModal 경로로만 그려지고, ScheduleDetailModal 은 그 자체가
 * `<Modal>` 이다. 즉 이 컴포넌트가 시트를 열면 **항상** 중첩 Modal 이 된다 —
 * 이 레포가 이슈 #186/#243/#244 로 반복해서 맞은 iOS 터치 먹통 패턴이고,
 * PreQuestionsSheet 는 같은 이유로 같은 ActionSheet 를 이미 걷어냈다.
 *
 * 목만 보면 빈 통과가 된다(ActionSheet 를 목으로 갈아끼우면 Modal 이 사라진 것처럼 보인다).
 * 그래서 여기서는 **실제 렌더 트리에 RN Modal 노드가 있는지**를 직접 센다.
 */
import React from 'react';
import { Modal as RNModal } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { DirectionsButton } from '../DirectionsButton';

const mockOpenMapDestination = jest.fn().mockResolvedValue(true);

jest.mock('@/utils/mapLink', () => ({
  ...jest.requireActual<typeof import('@/utils/mapLink')>('@/utils/mapLink'),
  openMapDestination: (...args: unknown[]) => mockOpenMapDestination(...args),
}));

// 지도 앱 취향은 MMKV 에 남아 테스트끼리 샌다 — 모듈째 갈아끼워 테스트마다 초기화한다.
let mockStoredMapApp: string | null = null;

jest.mock('@/utils/mapAppPreference', () => ({
  getMapAppPreference: () => mockStoredMapApp,
  setMapAppPreference: (app: string) => {
    mockStoredMapApp = app;
  },
}));

jest.mock('@/stores/toastStore', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn() }),
}));

const DESTINATION = {
  query: '서울 강남구 테헤란로 152',
  coordinates: { lat: 37.5000242, lng: 127.0365086 },
  label: '라운더스 홀덤펍',
};

/**
 * 렌더 트리에 실제로 매달린 RN Modal 개수.
 * 배열 자체를 단언하면 실패 시 파이버 덤프가 수백 줄 쏟아져 무엇이 틀렸는지 안 읽힌다.
 */
const countNativeModals = (
  queryAllByType: ReturnType<typeof render>['UNSAFE_queryAllByType']
): number => queryAllByType(RNModal).length;

describe('DirectionsButton — 지도 앱 선택은 중첩 Modal 을 만들지 않는다', () => {
  beforeEach(() => {
    mockOpenMapDestination.mockClear();
    mockStoredMapApp = null;
  });

  it('🔴 앱을 고르는 UI 를 띄워도 렌더 트리에 RN Modal 이 생기지 않는다', () => {
    const { getByText, UNSAFE_queryAllByType } = render(<DirectionsButton {...DESTINATION} />);

    // 닫혀 있을 때도 Modal 이 자식으로 매달려 있으면 안 된다 — 부모 시트 안에 사는 컴포넌트다.
    expect(countNativeModals(UNSAFE_queryAllByType)).toBe(0);

    fireEvent.press(getByText('지도에서 보기'));

    // 피커는 떠야 한다(기능은 살아있다).
    expect(getByText('어떤 지도로 열까요?')).toBeTruthy();
    // 그러나 그것이 새 Modal 이어서는 안 된다.
    expect(countNativeModals(UNSAFE_queryAllByType)).toBe(0);
  });

  it('🔴 취향이 저장돼 있어 곧장 열리는 경로에도 Modal 잔재가 없다', () => {
    mockStoredMapApp = 'kakao';
    const { getByText, queryByText, UNSAFE_queryAllByType } = render(
      <DirectionsButton {...DESTINATION} />
    );

    fireEvent.press(getByText('지도에서 보기'));

    expect(mockOpenMapDestination).toHaveBeenCalledWith(
      { query: DESTINATION.query, coordinates: DESTINATION.coordinates, label: DESTINATION.label },
      'kakao'
    );
    // 피커를 거치지 않는다.
    expect(queryByText('어떤 지도로 열까요?')).toBeNull();
    expect(countNativeModals(UNSAFE_queryAllByType)).toBe(0);
  });

  it('고른 앱 id 그대로 지도를 열고 그 선택을 기억한다', () => {
    const { getByText, queryByText } = render(<DirectionsButton {...DESTINATION} />);

    fireEvent.press(getByText('지도에서 보기'));
    fireEvent.press(getByText('네이버지도'));

    expect(mockOpenMapDestination).toHaveBeenCalledWith(
      { query: DESTINATION.query, coordinates: DESTINATION.coordinates, label: DESTINATION.label },
      'naver'
    );
    expect(mockStoredMapApp).toBe('naver');
    // 고르고 나면 피커는 접힌다 — 남아 있으면 같은 자리에서 또 고르라는 뜻이 된다.
    expect(queryByText('어떤 지도로 열까요?')).toBeNull();
  });

  it('고른 앱을 현재 값과 함께 보여주고 변경 버튼으로 다시 고를 수 있다', () => {
    mockStoredMapApp = 'kakao';
    const { getByText, getByRole } = render(<DirectionsButton {...DESTINATION} />);

    expect(getByText('카카오맵 · 변경')).toBeTruthy();

    fireEvent.press(getByRole('button', { name: '위치를 열 지도 앱 변경 (현재 카카오맵)' }));

    expect(getByText('어떤 지도로 열까요?')).toBeTruthy();
    expect(mockOpenMapDestination).not.toHaveBeenCalled();
  });

  it('고르지 않고 닫을 수 있다 — 실수로 연 피커가 길을 막지 않는다', () => {
    const { getByText, queryByText, getByRole } = render(<DirectionsButton {...DESTINATION} />);

    fireEvent.press(getByText('지도에서 보기'));
    fireEvent.press(getByRole('button', { name: '지도 앱 선택 닫기' }));

    expect(queryByText('어떤 지도로 열까요?')).toBeNull();
    expect(mockOpenMapDestination).not.toHaveBeenCalled();
  });
});
