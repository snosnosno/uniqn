/**
 * TimeWheelPicker — embedded 경로 Android 하드웨어 백 회귀 가드
 *
 * 배경: embedded 모드는 자체 Modal이 없어(absoluteFill 오버레이) Android 백을
 * 가로채지 못하면 부모 SheetModal로 전파돼 편집기 전체가 닫히고 입력이 폐기된다.
 * 피커가 열려 있는 동안 백을 소비해 피커만 닫아야 한다.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BackHandler, Keyboard } from 'react-native';
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
 * Android 실기기 프리징(2026-07-22): 휠을 한 번 돌리면 이후 터치가 먹통 — 확인 후 재진입해야
 * 다시 선택 가능. 유력 기전 = 스크롤 종료 핸들러의 programmatic scrollTo(animated)가
 * onMomentumScrollEnd를 재발화 → 같은 위치로 재-scrollTo 무한 재진입. 정렬된 오프셋에서는
 * 재스크롤 없이 선택만 갱신해야 한다(resolveSnap 가드). 여기서는 핸들러 배선(momentumScrollEnd
 * → 선택 갱신)을 고정하고, 재스크롤 판정 자체는 timePickerUtils.test가 고정한다.
 */
describe('TimeWheelPicker 휠 스크롤 종료 → 선택 갱신', () => {
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
