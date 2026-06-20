/**
 * TimeWheelPicker — embedded 경로 Android 하드웨어 백 회귀 가드
 *
 * 배경: embedded 모드는 자체 Modal이 없어(absoluteFill 오버레이) Android 백을
 * 가로채지 못하면 부모 SheetModal로 전파돼 편집기 전체가 닫히고 입력이 폐기된다.
 * 피커가 열려 있는 동안 백을 소비해 피커만 닫아야 한다.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { BackHandler, Keyboard } from 'react-native';
import { TimeWheelPicker } from '../TimeWheelPicker';

jest.mock('../../icons', () => ({
  AlertCircleIcon: () => null,
}));

const value = { hour: 19, minute: 0 };

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
