/**
 * OfflineStatusBar — impeccable v2 §25 스펙 준수 상단 상태바
 *
 * 목적:
 * - 네트워크 끊김 진입 시 상단에서 슬라이드-인, warning 틴트로 "오프라인 상태입니다"
 * - 복구 순간 "온라인으로 돌아왔어요"(success 톤 + Wifi 아이콘) 2초 표시 후 자동 dismiss
 * - 사용자 액션 없음(dismiss 버튼·retry 없음). 네트워크 복구는 NetInfo 자동 감지가
 *   맡는다. 재연결 시 쿼리 자동 refetch 는 queryClient 의 onlineManager +
 *   refetchOnReconnect(전역·인증 무관)가 담당하고, AuthenticatedRuntime 은 인증
 *   세션의 재연결 동기화(Realtime 재구독·토큰 갱신)를 담당한다.
 *
 * 디자인 spec:
 * - height 40px, safe-area-top 아래
 * - offline: warning subtle / reconnected: success subtle (각 0.15 알파)
 * - 좌측 아이콘 16px(offline=WifiOff / reconnected=Wifi), 14px/500 텍스트, gap-2
 * - entrance 300ms ease-out / exit 225ms ease-in(75% 규칙) — 언마운트는 exit 완료 후
 * - reduce motion 시 opacity fade 만, translate 생략
 *
 * 접근성: `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"`.
 * Android 는 liveRegion 이 배너 등장 시 자동 낭독하지만, iOS VoiceOver 는 RN 의
 * liveRegion 을 지원하지 않으므로 phase 전이(offline·reconnected) 시
 * `AccessibilityInfo.announceForAccessibility(label)` 를 iOS 한정으로 명시 호출한다
 * (Android 이중 낭독 방지). 2초 dismiss 전 읽기 완료를 보장한다.
 */

import { useColorScheme } from 'nativewind';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WifiIcon, WifiOff } from '@/components/icons';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { getNetworkState, subscribeToNetworkState } from '@/services/offline/networkState';

type BannerPhase = 'hidden' | 'offline' | 'reconnected';

const BANNER_HEIGHT = 40;
const RECONNECT_DISMISS_MS = 2000;
const ENTRANCE_MS = 300;
const EXIT_MS = 225; // 75% of entrance (impeccable v1 §8)
// 플랩 가드: 이보다 짧은 오프라인(wifi↔셀룰러 핸드오프 등 순간 끊김)은
// 복구 배너를 생략해, 초록 배너가 반복 깜빡이는 것을 방지한다.
const MIN_OFFLINE_FOR_RECONNECT_MS = 1000;

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

export function OfflineStatusBar(): React.ReactElement | null {
  const [phase, setPhase] = useState<BannerPhase>(() =>
    getNetworkState().isOffline ? 'offline' : 'hidden'
  );
  // exit 애니메이션 동안 렌더를 유지하기 위한 지연 언마운트 플래그
  const [rendered, setRendered] = useState<boolean>(() => getNetworkState().isOffline);
  const prevOnlineRef = useRef<boolean>(getNetworkState().isOnline);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 오프라인 진입 시각(플랩 가드 계산용) — 온라인 복귀 시 null 로 리셋
  const offlineSinceRef = useRef<number | null>(null);
  // exit('hidden') 구간에 표기할 직전 가시 phase — 초록/노랑 배너를 올바로 유지
  const lastVisiblePhaseRef = useRef<'offline' | 'reconnected'>('offline');

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

      const wasOnline = prevOnlineRef.current;
      prevOnlineRef.current = next.isOnline;

      if (!next.isOnline) {
        if (dismissTimerRef.current) {
          clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = null;
        }
        // 오프라인 전이 순간에만 진입 시각 기록 + iOS 낭독(반복 콜백 중복 낭독 방지)
        const wasAlreadyOffline = offlineSinceRef.current !== null;
        if (!wasAlreadyOffline) {
          offlineSinceRef.current = Date.now();
          if (Platform.OS === 'ios') {
            AccessibilityInfo.announceForAccessibility('오프라인 상태입니다');
          }
        }
        lastVisiblePhaseRef.current = 'offline';
        setPhase('offline');
        return;
      }

      // 온라인 상태 — 방금 복구된 경우
      if (!wasOnline) {
        const offlineSince = offlineSinceRef.current;
        offlineSinceRef.current = null;
        const offlineDuration =
          offlineSince === null ? Number.POSITIVE_INFINITY : Date.now() - offlineSince;

        // 플랩 가드: 오프라인이 아주 짧았으면(핸드오프) 복구 배너를 생략한다.
        // lastVisiblePhaseRef 는 'offline' 이므로 초록 배너 없이 노란 배너가
        // exit 애니메이션으로 조용히 사라진다.
        if (offlineDuration < MIN_OFFLINE_FOR_RECONNECT_MS) {
          setPhase('hidden');
          return;
        }

        lastVisiblePhaseRef.current = 'reconnected';
        setPhase('reconnected');
        if (Platform.OS === 'ios') {
          AccessibilityInfo.announceForAccessibility('온라인으로 돌아왔어요');
        }
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
      opacity.value = withTiming(show ? 1 : 0, { duration, easing });
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

  // exit 구간('hidden')에는 직전 가시 phase 의 표기를 유지한다.
  // reconnected→hidden = 초록 유지, 플랩(offline→hidden) = 노랑 유지(초록 배너 생략).
  const visualPhase = phase === 'hidden' ? lastVisiblePhaseRef.current : phase;
  const isOfflinePhase = visualPhase === 'offline';
  const phaseTokens = isOfflinePhase ? palette.offline : palette.reconnected;
  const label = isOfflinePhase ? '오프라인 상태입니다' : '온라인으로 돌아왔어요';
  const PhaseIcon = isOfflinePhase ? WifiOff : WifiIcon;

  return (
    <Animated.View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={label}
      testID="offline-status-bar"
      style={[
        {
          // RN 0.83에서 pointerEvents prop은 deprecated — style로 지정
          pointerEvents: 'none',
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
