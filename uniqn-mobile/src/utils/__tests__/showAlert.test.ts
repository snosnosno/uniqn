/**
 * showAlert / confirmAction 웹 분기 검증.
 *
 * rn-web 의 Alert.alert 는 no-op(static alert() {}) — 웹에서 다이얼로그가 조용히
 * 증발하는 회귀를 막기 위해 web=window.alert/confirm, native=Alert.alert 분기를 고정한다.
 */
import { Alert, Platform } from 'react-native';
import { showAlert } from '../showAlert';
import { confirmAction } from '../confirmAction';

const originalOSDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

function setPlatformOS(os: 'ios' | 'web') {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => os,
  });
}

describe('showAlert', () => {
  let alertSpy: jest.SpyInstance;
  let windowAlert: jest.Mock;

  beforeEach(() => {
    // restoreMocks: true 환경 — spy 는 매 테스트 재설치
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    windowAlert = jest.fn();
    (globalThis as { window?: unknown }).window = { alert: windowAlert };
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  afterAll(() => {
    if (originalOSDescriptor) {
      Object.defineProperty(Platform, 'OS', originalOSDescriptor);
    }
  });

  it('웹에서는 window.alert 로 안내하고 Alert.alert 를 호출하지 않는다', () => {
    setPlatformOS('web');

    showAlert('지원 실패', '오류가 발생했습니다');

    expect(windowAlert).toHaveBeenCalledWith('지원 실패\n\n오류가 발생했습니다');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('네이티브에서는 Alert.alert 로 안내한다', () => {
    setPlatformOS('ios');

    showAlert('우승 확정', '1위 · 상금 100,000');

    expect(alertSpy).toHaveBeenCalledWith('우승 확정', '1위 · 상금 100,000');
    expect(windowAlert).not.toHaveBeenCalled();
  });
});

describe('confirmAction (웹 분기)', () => {
  let alertSpy: jest.SpyInstance;
  let windowConfirm: jest.Mock;

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    windowConfirm = jest.fn();
    (globalThis as { window?: unknown }).window = { confirm: windowConfirm };
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  afterAll(() => {
    if (originalOSDescriptor) {
      Object.defineProperty(Platform, 'OS', originalOSDescriptor);
    }
  });

  it('웹에서 확인을 누르면 onConfirm 이 실행된다', () => {
    setPlatformOS('web');
    windowConfirm.mockReturnValue(true);
    const onConfirm = jest.fn();

    confirmAction({
      title: '탈락 처리',
      message: '홍길동 님을 탈락 처리할까요?',
      confirmText: '탈락 처리',
      destructive: true,
      onConfirm,
    });

    expect(windowConfirm).toHaveBeenCalledWith('탈락 처리\n\n홍길동 님을 탈락 처리할까요?');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('웹에서 취소를 누르면 onConfirm 이 실행되지 않는다', () => {
    setPlatformOS('web');
    windowConfirm.mockReturnValue(false);
    const onConfirm = jest.fn();

    confirmAction({
      title: '상금 회수',
      message: '회수할까요?',
      confirmText: '회수',
      onConfirm,
    });

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('네이티브에서는 Alert.alert 버튼 배열로 위임한다', () => {
    setPlatformOS('ios');
    const onConfirm = jest.fn();

    confirmAction({
      title: 'PIN 재발급',
      message: '진행할까요?',
      confirmText: '재발급',
      destructive: true,
      onConfirm,
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'PIN 재발급',
      '진행할까요?',
      [
        // 취소도 onPress 를 갖는다 — onCancel 콜백(confirmActionAsync 의 false 해소)을 받아야 한다
        { text: '취소', style: 'cancel', onPress: expect.any(Function) },
        { text: '재발급', style: 'destructive', onPress: expect.any(Function) },
      ],
      // 안드로이드 뒤로가기 dismiss 도 취소로 수렴
      { onDismiss: expect.any(Function) }
    );
    expect(windowConfirm).not.toHaveBeenCalled();
  });
});
