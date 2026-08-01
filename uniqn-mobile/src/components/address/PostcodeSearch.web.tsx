/**
 * UNIQN Mobile - 우편번호 검색 패널 (웹)
 *
 * @description 다음(카카오) 우편번호 위젯을 **페이지에 끼워넣기**(embed) 로 인라인 렌더한다.
 * 레이어/팝업 모드를 쓰지 않는 이유는 벤더 권고 그대로다 — *"webview 브라우저에서
 * position:fixed, inner-scroll 이용 시 가상키보드 터치 불량… 모바일 환경에서는 가급적
 * '페이지에 끼워넣기' 예제를 추천"*.
 *
 * 스크립트는 `<script>` 태그 동적 주입으로 로드한다(레포 최초 패턴 — 이 벤더는 npm 패키지를
 * 제공하지 않아 정적 import 가 불가능하다). 모듈 레벨 Promise 캐시로 중복 로드를 막는 방식은
 * `QRCodeScanner.web.tsx:41-49` 의 jsQR 동적 로더와 동형이다.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { logger } from '@/utils/logger';
import { parsePostcodeResult } from '@/utils/address/postcodeAddress';
import type { PostcodeSearchProps } from './PostcodeSearch.types';
import {
  POSTCODE_EMBED_OPTIONS,
  POSTCODE_SCRIPT_SRC,
  POSTCODE_WIDGET_OPTIONS,
} from './postcodeWidget';

interface DaumPostcodeInstance {
  embed: (element: HTMLElement, options?: { autoClose?: boolean }) => void;
}
interface DaumPostcodeOptions {
  oncomplete: (data: unknown) => void;
  width?: string;
  height?: string;
  submitMode?: boolean;
}
interface DaumNamespace {
  Postcode: new (options: DaumPostcodeOptions) => DaumPostcodeInstance;
}

/** 모듈 레벨 캐시 — 시트를 여러 번 열어도 스크립트는 한 번만 받는다 */
let scriptLoader: Promise<void> | null = null;

function loadPostcodeScript(): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('브라우저 환경이 아닙니다'));
  }
  if (scriptLoader) return scriptLoader;

  scriptLoader = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = POSTCODE_SCRIPT_SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      // 실패한 Promise 를 캐시에 남기면 재시도가 영원히 막힌다
      scriptLoader = null;
      el.remove();
      reject(new Error('우편번호 스크립트를 불러오지 못했습니다'));
    };
    document.head.appendChild(el);
  });

  return scriptLoader;
}

export function PostcodeSearch({ height, onComplete, onError }: PostcodeSearchProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);

  // onComplete/onError 는 호출부에서 인라인 화살표로 오기 쉬워 매 렌더 새 참조가 된다.
  // effect deps 에 넣으면 위젯이 매 렌더 재임베드되므로 ref 로 최신 값만 들고 간다.
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  useEffect(() => {
    let cancelled = false;

    loadPostcodeScript()
      .then(() => {
        if (cancelled) return;
        const container = containerRef.current;
        const daum = (window as unknown as { daum?: DaumNamespace }).daum;
        if (!container || !daum?.Postcode) {
          onErrorRef.current('우편번호 검색을 준비하지 못했습니다');
          return;
        }

        new daum.Postcode({
          ...POSTCODE_WIDGET_OPTIONS,
          oncomplete: (data: unknown) => {
            const result = parsePostcodeResult(data);
            if (!result) {
              logger.error('우편번호 결과 검증 실패', { component: 'PostcodeSearch.web' });
              onErrorRef.current('주소 정보를 읽지 못했습니다. 다시 시도해주세요');
              return;
            }
            onCompleteRef.current(result);
          },
        }).embed(container, POSTCODE_EMBED_OPTIONS);

        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        logger.error('우편번호 스크립트 로드 실패', error instanceof Error ? error : undefined, {
          component: 'PostcodeSearch.web',
        });
        onErrorRef.current('우편번호 검색을 불러오지 못했습니다. 네트워크를 확인해주세요');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    // 컨테이너 div 는 effect 가 embed 할 대상이라 로딩 중에도 마운트돼 있어야 한다 →
    // 스피너는 자리를 차지하지 않도록 오버레이로 얹는다(쌓으면 height 예산을 넘겨 하단이 잘린다)
    <View style={{ height }} className="overflow-hidden rounded-xl">
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
      {loading ? (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center gap-2">
          <ActivityIndicator />
          <Text className="text-xs text-content-muted font-sans">우편번호 검색을 불러오는 중…</Text>
        </View>
      ) : null}
    </View>
  );
}
