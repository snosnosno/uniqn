/**
 * OfflineStatusBar — impeccable v2 §25 스펙 준수 상단 상태바
 *
 * 목적:
 * - 네트워크 끊김 진입 시 상단에서 슬라이드-인, warning 틴트로 "오프라인 상태입니다"
 * - 복구 순간 "온라인으로 돌아왔어요"(success 톤 + Wifi 아이콘) 2초 표시 후 자동 dismiss
 * - 사용자 액션 없음(dismiss 버튼·retry 없음). 네트워크 복구는 NetInfo 자동 감지 +
 *   재연결 시 쿼리 자동 refetch(AuthenticatedRuntime)가 담당.
 *
 * 디자인 spec:
 * - height 40px, safe-area-top 아래
 * - offline: warning subtle / reconnected: success subtle (각 0.15 알파)
 * - 좌측 아이콘 16px(offline=WifiOff / reconnected=Wifi), 14px/500 텍스트, gap-2
 * - entrance 300ms ease-out / exit 225ms ease-in(75% 규칙) — 언마운트는 exit 완료 후
 * - reduce motion 시 opacity fade 만, translate 생략
 *
 * 접근성: `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"` —
 * VoiceOver/TalkBack 이 등장 시 자동으로 읽음. 2초 dismiss 전 읽기 완료 보장.
 */

import { useColorScheme } from 'nativewind';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WifiIcon, WifiOff } from '@/components/icons';
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
    offline: { bg: 'rgba(212,160,23,0.15)', icon: '#D4A017' }, // warning subtle
    reconnected: { bg: 'rgba(34,197,94,0.15)', icon: '#22C55E' }, // success subtle
    text: '#F0F0F2', // content-primary dark
  },
  light: {
    offline: { bg: 'rgba(161,98,7,0.15)', icon: '#A16207' },
    reconnected: { bg: 'rgba(22,163,74,0.15)', icon: '#16A34A' },
    text: '#09090B', // content-primary light
  },
} as const;

function useReduceMotion(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setEnabled(v);
    });

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => {
      if (mounted) setEnabled(v);
    });

    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return enabled;
}

export function OfflineStatusBar(): React.ReactElement | null {
  const [, setNetworkState] = useState<NetworkState>(() => getNetworkState());
  const [phase, setPhase] = useState<BannerPhase>(() =>
    getNetworkState().isOffline ? 'offline' : 'hidden'
  );
  // exit 애니메이션 동안 렌더를 유지하기 위한 지연 언마운트 플래그
  const [rendered, setRendered] = useState<boolean>(() => getNetworkState().isOffline);
  const prevOnlineRef = useRef<boolean>(getNetworkState().isOnline);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const palette = colorScheme === 'dark' ? TOKENS.dark : TOKENS.light;

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

  // 애니메이션 + 지연 언마운트 (exit 225ms 완료 후 실제 제거)
  useEffect(() => {
    const show = phase !== 'hidden';
    const duration = show ? ENTRANCE_MS : EXIT_MS;
    const easing = show ? Easing.out(Easing.quad) : Easing.in(Easing.quad);

    if (reduceMotion) {
      translateY.value = 0;
      opacity.value = show ? 1 : 0;
    } else {
      translateY.value = withTiming(show ? 0 : -BANNER_HEIGHT, { duration, easing });
      opacity.value = withTiming(show ? 1 : 0, { duration, easing });
    }

    if (show) {
      setRendered(true);
      return;
    }
    const unmountTimer = setTimeout(() => setRendered(false), EXIT_MS);
    return () => clearTimeout(unmountTimer);
  }, [phase, reduceMotion, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: reduceMotion ? [] : [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!rendered) return null;

  // 'hidden'(exit 구간)은 reconnected 다음에만 오므로 reconnected 표기 유지
  const isOfflinePhase = phase === 'offline';
  const phaseTokens = isOfflinePhase ? palette.offline : palette.reconnected;
  const label = isOfflinePhase ? '오프라인 상태입니다' : '온라인으로 돌아왔어요';
  const PhaseIcon = isOfflinePhase ? WifiOff : WifiIcon;

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
          backgroundColor: phaseTokens.bg,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          zIndex: 1000,
        },
        animatedStyle,
      ]}
    >
      <PhaseIcon size={16} color={phaseTokens.icon} />
      <Text
        numberOfLines={1}
        style={{
          color: palette.text,
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
