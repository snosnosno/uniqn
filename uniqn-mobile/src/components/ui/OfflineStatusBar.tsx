/**
 * OfflineStatusBar — impeccable v2 §25 스펙 준수 상단 상태바
 *
 * 목적:
 * - 네트워크 끊김 진입 시 상단에서 슬라이드-인, warning 틴트로 "오프라인 상태입니다"
 * - 복구 순간 "온라인으로 돌아왔어요"(success 톤) 2초 표시 후 자동 dismiss
 * - 사용자 액션 없음(dismiss 버튼·retry 없음). 수동 재시도가 필요한 시나리오는
 *   기존 `<OfflineBanner variant="banner" | "toast" | "fullscreen" />` 를 사용.
 *
 * 디자인 spec:
 * - height 40px, safe-area-top 아래
 * - 배경 dark `rgba(212,160,23,0.15)` / light `rgba(161,98,7,0.15)`
 * - 좌측 `WifiOff` 16px, 14px/500 텍스트, gap-2
 * - entrance 300ms ease-out / exit 225ms ease-in(75% 규칙)
 * - reduce motion 시 opacity fade 만, translate 생략
 *
 * 접근성: `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"` —
 * VoiceOver/TalkBack 이 등장 시 자동으로 읽음. 2초 dismiss 전 읽기 완료 보장.
 */

import { useColorScheme } from 'nativewind';
import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WifiOff } from '@/components/icons';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import {
  getNetworkState,
  subscribeToNetworkState,
  type NetworkState,
} from '@/services/offline/networkState';

type BannerPhase = 'hidden' | 'offline' | 'reconnected';

const BANNER_HEIGHT = 40;
const RECONNECT_DISMISS_MS = 2000;
const ENTRANCE_MS = 300;
const EXIT_MS = 225; // 75% of entrance (impeccable v1 §8)

const TOKENS = {
  dark: {
    bg: 'rgba(212,160,23,0.15)', // warning subtle dark
    icon: '#D4A017',
    text: '#F0F0F2', // content-primary dark
  },
  light: {
    bg: 'rgba(161,98,7,0.15)', // warning subtle light
    icon: '#A16207',
    text: '#09090B', // content-primary light
  },
} as const;

export function OfflineStatusBar(): React.ReactElement | null {
  const [, setNetworkState] = useState<NetworkState>(() => getNetworkState());
  const [phase, setPhase] = useState<BannerPhase>(() =>
    getNetworkState().isOffline ? 'offline' : 'hidden'
  );
  const prevOnlineRef = useRef<boolean>(getNetworkState().isOnline);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const tokens = colorScheme === 'dark' ? TOKENS.dark : TOKENS.light;

  // 실제 transform + opacity
  const translateY = useSharedValue(-BANNER_HEIGHT);
  const opacity = useSharedValue(0);

  // 네트워크 상태 구독
  useEffect(() => {
    const apply = () => {
      const next = getNetworkState();
      setNetworkState(next);

      const wasOnline = prevOnlineRef.current;
      prevOnlineRef.current = next.isOnline;

      if (!next.isOnline) {
        if (dismissTimerRef.current) {
          clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = null;
        }
        setPhase('offline');
        return;
      }

      // 온라인 상태 — 방금 복구된 경우 2초 배너
      if (!wasOnline) {
        setPhase('reconnected');
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = setTimeout(() => {
          setPhase('hidden');
          dismissTimerRef.current = null;
        }, RECONNECT_DISMISS_MS);
      }
    };

    // 첫 마운트 시 현재 상태 반영
    apply();
    const unsub = subscribeToNetworkState(apply);
    return () => {
      unsub();
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  // 애니메이션
  useEffect(() => {
    const show = phase !== 'hidden';
    const duration = show ? ENTRANCE_MS : EXIT_MS;
    const easing = show ? Easing.out(Easing.quad) : Easing.in(Easing.quad);

    if (reduceMotion) {
      translateY.value = 0;
      opacity.value = show ? 1 : 0;
      return;
    }

    translateY.value = withTiming(show ? 0 : -BANNER_HEIGHT, {
      duration,
      easing,
    });
    opacity.value = withTiming(show ? 1 : 0, { duration, easing });
  }, [phase, reduceMotion, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: reduceMotion ? [] : [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (phase === 'hidden') return null;

  const label = phase === 'offline' ? '오프라인 상태입니다' : '온라인으로 돌아왔어요';

  return (
    <Animated.View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={label}
      pointerEvents="none"
      testID="offline-status-bar"
      style={[
        {
          position: 'absolute',
          top: insets.top,
          left: 0,
          right: 0,
          height: BANNER_HEIGHT,
          backgroundColor: tokens.bg,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          zIndex: 1000,
        },
        animatedStyle,
      ]}
    >
      <WifiOff size={16} color={tokens.icon} />
      <Text
        numberOfLines={1}
        style={{
          color: tokens.text,
          fontSize: 14,
          fontWeight: '500',
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}
