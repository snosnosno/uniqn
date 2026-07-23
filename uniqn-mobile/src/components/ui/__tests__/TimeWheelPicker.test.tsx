/**
 * TimeWheelPicker — embedded 경로 Android 하드웨어 백 회귀 가드
 *
 * 배경: embedded 모드는 자체 Modal이 없어(absoluteFill 오버레이) Android 백을
 * 가로채지 못하면 부모 SheetModal로 전파돼 편집기 전체가 닫히고 입력이 폐기된다.
 * 피커가 열려 있는 동안 백을 소비해 피커만 닫아야 한다.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BackHandler, Keyboard, ScrollView } from 'react-native';
import { TimeWheelPicker } from '../TimeWheelPicker';

jest.mock('../../icons', () => ({
  AlertCircleIcon: () => null,
}));

const value = { hour: 19, minute: 0 };
const ITEM_HEIGHT = 44;

describe('TimeWheelPicker embedded 백 버튼', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('embedded+visible: 하드웨어 백을 소비(true)하고 피커만 닫는다', () => {
    let backCb: (() => boolean | null | undefined) | undefined;
    const addSpy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event: string, cb: () => boolean | null | undefined) => {
        backCb = cb;
        return { remove: jest.fn() } as ReturnType<typeof BackHandler.addEventListener>;
      });
    const dismissSpy = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    const onClose = jest.fn();

    render(
      <TimeWheelPicker visible value={value} embedded onConfirm={jest.fn()} onClose={onClose} />
    );

    expect(addSpy).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));
    expect(dismissSpy).toHaveBeenCalled();

    // 백 핸들러는 onClose를 호출하고 true(이벤트 소비)를 반환해야 함
    expect(backCb?.()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('embedded인데 비표시: 백 핸들러 미등록', () => {
    const addSpy = jest.spyOn(BackHandler, 'addEventListener');

    render(
      <TimeWheelPicker
        visible={false}
        value={value}
        embedded
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(addSpy).not.toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));
  });

  it('standalone(비-embedded): 백 핸들러 미등록 (Modal onRequestClose 사용)', () => {
    const addSpy = jest.spyOn(BackHandler, 'addEventListener');

    render(<TimeWheelPicker visible value={value} onConfirm={jest.fn()} onClose={jest.fn()} />);

    expect(addSpy).not.toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));
  });
});

/**
 * Android 실기기 프리징(2026-07-22 재현·2회차 수정): 휠을 한 번 돌리면 이후 스와이프가 먹통
 * (탭·버튼은 정상). 인과사슬 =
 *   손 뗌 → onScrollEndDrag → scrollTo(animated) → 그 프로그래매틱 스크롤이 momentum 으로
 *   간주되어 onMomentumScrollEnd 재발화 → 오프셋이 정확한 정렬값이 아니면 또 scrollTo → 무한 반복.
 *   루프 도는 동안 ScrollView 가 프로그래매틱 스크롤 상태라 사용자 터치 스크롤이 무시된다.
 * 1회차 수정(±0.5dp 정렬이면 재스크롤 생략)은 Android dp↔px 반올림 오차가 임계를 넘으면
 * 무력화돼 실패했다. 근본 원인은 그 위 — snapToInterval 이 이미 OS 레벨에서 스냅하므로
 * **프로그래매틱 scrollTo 자체가 중복**이다. 스크롤 종료 핸들러는 선택값만 계산한다.
 */
describe('TimeWheelPicker 휠 스크롤 종료 → 선택 갱신', () => {
  /** ScrollView ref 의 scrollTo 를 감시 — 스크롤 종료 경로에서 호출되면 재진입 고리가 살아 있다 */
  const spyScrollTo = () => jest.spyOn(ScrollView.prototype, 'scrollTo');

  it('momentumScrollEnd(정렬 오프셋)로 시간이 갱신된다', () => {
    const { getByTestId, getByLabelText } = render(
      <TimeWheelPicker visible value={value} embedded onConfirm={jest.fn()} onClose={jest.fn()} />
    );

    fireEvent(getByTestId('time-wheel-hours'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { y: 3 * ITEM_HEIGHT } },
    });

    expect(getByLabelText('03시').props.accessibilityState.selected).toBe(true);
  });

  it('momentumScrollEnd(비정렬 오프셋)는 가장 가까운 값으로 스냅해 갱신된다', () => {
    const { getByTestId, getByLabelText } = render(
      <TimeWheelPicker visible value={value} embedded onConfirm={jest.fn()} onClose={jest.fn()} />
    );

    fireEvent(getByTestId('time-wheel-minutes'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { y: 2 * ITEM_HEIGHT + 30 } },
    });

    // minuteInterval 기본 5 → index 3 = 15분
    expect(getByLabelText('15분').props.accessibilityState.selected).toBe(true);
  });

  it('momentumScrollEnd 는 비정렬 오프셋에서도 scrollTo 를 호출하지 않는다 (재진입 고리 차단)', () => {
    const scrollTo = spyScrollTo();
    const { getByTestId } = render(
      <TimeWheelPicker visible value={value} embedded onConfirm={jest.fn()} onClose={jest.fn()} />
    );
    scrollTo.mockClear(); // 마운트 시 초기 위치 이동은 정상 — 스크롤 종료 경로만 본다

    fireEvent(getByTestId('time-wheel-hours'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { y: 3 * ITEM_HEIGHT + 17 } },
    });

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('scrollEndDrag 도 scrollTo 를 호출하지 않는다 (관성과 경합 금지)', () => {
    const scrollTo = spyScrollTo();
    const { getByTestId } = render(
      <TimeWheelPicker visible value={value} embedded onConfirm={jest.fn()} onClose={jest.fn()} />
    );
    scrollTo.mockClear();

    fireEvent(getByTestId('time-wheel-minutes'), 'scrollEndDrag', {
      nativeEvent: { contentOffset: { y: 2 * ITEM_HEIGHT + 30 } },
    });

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('연속 스크롤이 계속 반영된다 (한 번 돌린 뒤 멈추지 않는다)', () => {
    const { getByTestId, getByLabelText } = render(
      <TimeWheelPicker visible value={value} embedded onConfirm={jest.fn()} onClose={jest.fn()} />
    );
    const wheel = getByTestId('time-wheel-hours');

    fireEvent(wheel, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { y: 3 * ITEM_HEIGHT } },
    });
    expect(getByLabelText('03시').props.accessibilityState.selected).toBe(true);

    fireEvent(wheel, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { y: 7 * ITEM_HEIGHT } },
    });
    expect(getByLabelText('07시').props.accessibilityState.selected).toBe(true);

    fireEvent(wheel, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { y: 11 * ITEM_HEIGHT } },
    });
    expect(getByLabelText('11시').props.accessibilityState.selected).toBe(true);
  });
});

describe('TimeWheelPicker 시간 미정', () => {
  it('onConfirmTBA 전달 시 "시간 미정" 버튼이 렌더되고 탭하면 콜백된다', () => {
    const onConfirmTBA = jest.fn();
    const { getByTestId } = render(
      <TimeWheelPicker
        visible
        value={value}
        embedded
        onConfirm={jest.fn()}
        onConfirmTBA={onConfirmTBA}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('time-wheel-tba'));
    expect(onConfirmTBA).toHaveBeenCalledTimes(1);
  });

  it('onConfirmTBA 미전달 시 "시간 미정" 버튼이 없다', () => {
    const { queryByTestId } = render(
      <TimeWheelPicker visible value={value} embedded onConfirm={jest.fn()} onClose={jest.fn()} />
    );

    expect(queryByTestId('time-wheel-tba')).toBeNull();
  });
});
