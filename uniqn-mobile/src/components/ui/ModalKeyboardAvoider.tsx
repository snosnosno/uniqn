/**
 * UNIQN Mobile - ModalKeyboardAvoider
 *
 * @description RNModal(statusBarTranslucent) 내부 전용 키보드 회피 래퍼.
 *
 * Android에서 statusBarTranslucent 다이얼로그는 풀스크린 윈도우로 배치되어
 * SOFT_INPUT_ADJUST_RESIZE(ReactModalHostView.kt:329)가 무시되고,
 * KeyboardAvoidingView(height)도 keyboardDidShow의 screenY가 activity 가시영역
 * 기준(edge-to-edge에선 화면 바닥)이라 relativeKeyboardHeight=0으로 붕괴해
 * 아무 보정도 하지 않는다(2026-07-22 실기기 재현 — 키보드가 시트 전체를 덮음).
 * 반면 endCoordinates.height는 WindowInsets IME 인셋 직산(ReactRootView.java:920-922)이라
 * 신뢰 가능 — Android는 이 값을 paddingBottom으로 직접 적용한다.
 *
 * iOS는 기존 KeyboardAvoidingView(padding) 경로 유지(정상 동작),
 * 웹은 KAV가 plain View로 렌더되므로 동일 경로로 무해.
 * KAV(Android)와 동일하게 즉시 적용(setState) — keyboardDidShow는 키보드 표시
 * 완료 후 발화라 추가 애니메이션은 지연만 늘린다.
 */
import React, { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, View } from 'react-native';
import type { KeyboardEvent } from 'react-native';

interface ModalKeyboardAvoiderProps {
  children: React.ReactNode;
}

export function AndroidKeyboardInsetView({ children }: ModalKeyboardAvoiderProps) {
  // 키보드가 이미 떠 있는 상태에서 모달이 열리는 경우 초기값 반영
  const [keyboardHeight, setKeyboardHeight] = useState(() =>
    Keyboard.isVisible() ? (Keyboard.metrics()?.height ?? 0) : 0
  );

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (e: KeyboardEvent) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <View
      testID="modal-keyboard-inset"
      className="flex-1"
      style={{ paddingBottom: keyboardHeight }}
    >
      {children}
    </View>
  );
}

export function ModalKeyboardAvoider({ children }: ModalKeyboardAvoiderProps) {
  if (Platform.OS === 'android') {
    return <AndroidKeyboardInsetView>{children}</AndroidKeyboardInsetView>;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1"
    >
      {children}
    </KeyboardAvoidingView>
  );
}
