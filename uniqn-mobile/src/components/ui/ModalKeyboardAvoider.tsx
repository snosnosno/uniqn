/**
 * UNIQN Mobile - ModalKeyboardAvoider
 *
 * @description RNModal(statusBarTranslucent) 내부 전용 키보드 회피 래퍼.
 *
 * Android에서 statusBarTranslucent 다이얼로그는 풀스크린 윈도우로 배치되어
 * SOFT_INPUT_ADJUST_RESIZE(ReactModalHostView.kt:329)가 무시되고,
 * RN 기본 KeyboardAvoidingView(height)도 keyboardDidShow의 screenY가 activity
 * 가시영역 기준(edge-to-edge에선 화면 바닥)이라 relativeKeyboardHeight=0으로
 * 붕괴해 아무 보정도 하지 않는다(2026-07-22 실기기 재현 — 키보드가 시트 전체를 덮음).
 *
 * #302에서는 endCoordinates.height(IME 인셋 직산)를 paddingBottom으로 직접
 * 적용해 30/32 표면을 해소했으나 두 가지 한계가 남았다.
 *   1. keyboardDidShow는 키보드 표시 "완료" 후 발화 → 패딩이 끝에서 한 번에 점프
 *   2. position='center' 카드는 IME−navigationBar 상쇄가 성립하지 않아
 *      3버튼 내비 기기에서 과소 보정(리뷰 MEDIUM)
 *
 * react-native-keyboard-controller는 ModalAttachedWatcher가 RNModal의
 * dialog.window decorView에 WindowInsetsAnimationCallback을 직접 부착해
 * 두 한계를 함께 없앤다 — 프레임 단위 추적 + IME 인셋 직산.
 *
 * 웹은 라이브러리의 non-native 엔트리(lib/commonjs/bindings.js)가 완전한 NOOP
 * 스텁이라 별도 플랫폼 분기 없이 무해하다.
 *
 * @see app/_layout.tsx — KeyboardProvider 배선 및 인셋 소유권 주석
 */
import React from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

interface ModalKeyboardAvoiderProps {
  children: React.ReactNode;
}

export function ModalKeyboardAvoider({ children }: ModalKeyboardAvoiderProps) {
  return (
    <KeyboardAvoidingView testID="modal-keyboard-inset" behavior="padding" className="flex-1">
      {children}
    </KeyboardAvoidingView>
  );
}
