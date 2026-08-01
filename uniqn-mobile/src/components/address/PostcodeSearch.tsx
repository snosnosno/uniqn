/**
 * UNIQN Mobile - 우편번호 검색 패널 (네이티브)
 *
 * @description 다음(카카오) 우편번호 위젯을 로컬 HTML 로 감싼 WebView. 결과는
 * `window.ReactNativeWebView.postMessage` 브릿지로 회수한다.
 *
 * 🔴 이 파일이 레포에서 `react-native-webview` 를 **직접 쓰는 첫 지점**이다. 패키지 자체는
 * `package.json` 에 직접 의존성으로 선언돼 있었지만 소비자는 `@portone/react-native-sdk` 뿐이었고
 * `src/` 안의 직접 import 는 0건이었다(2026-08-01 실측) — 설계 문서 §2-H 의 "RN Modal 안 WebView
 * 조합은 이미 검증됐다"는 서술은 그래서 사실이 아니다. 이 경로는 **이 앱에서 실행된 적이 없다.**
 *
 * ⚠️ 여기서도 RN Modal 을 새로 열지 않는다. 호출부(PlaceSheet)가 이미 SheetModal 안이고,
 * 중첩 RN Modal 은 iOS 터치먹통 이력이 있다(#186/#243).
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { logger } from '@/utils/logger';
import { parsePostcodeBridgeMessage } from '@/utils/address/postcodeAddress';
import type { PostcodeSearchProps } from './PostcodeSearch.types';
import {
  POSTCODE_EMBED_OPTIONS,
  POSTCODE_SCRIPT_SRC,
  POSTCODE_WIDGET_OPTIONS,
} from './postcodeWidget';

/**
 * 위젯을 임베드하고 결과를 브릿지로 넘기는 로컬 문서.
 *
 * - 벤더 스크립트가 404/차단돼도 다음 인라인 스크립트는 실행된다(순서 실행) → `error` 봉투 발신
 * - 위젯 옵션은 `postcodeWidget.ts` 에서 보간한다 — 리터럴로 재선언하면 웹과 조용히 어긋난다
 * - 확대 방지 viewport — 검색 입력 포커스 시 iOS 가 화면을 확대하는 것을 막는다
 */
const POSTCODE_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>html,body,#postcode-wrap{margin:0;padding:0;height:100%;width:100%;overflow:hidden;}</style>
</head>
<body>
<div id="postcode-wrap"></div>
<script src="${POSTCODE_SCRIPT_SRC}"></script>
<script>
(function () {
  function send(payload) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }
  try {
    if (!window.daum || !window.daum.Postcode) {
      send({ type: 'error', message: '우편번호 검색을 불러오지 못했습니다' });
      return;
    }
    new window.daum.Postcode(Object.assign(${JSON.stringify(POSTCODE_WIDGET_OPTIONS)}, {
      oncomplete: function (data) {
        send({ type: 'complete', data: data });
      }
    })).embed(document.getElementById('postcode-wrap'), ${JSON.stringify(POSTCODE_EMBED_OPTIONS)});
  } catch (e) {
    send({ type: 'error', message: '우편번호 검색을 여는 중 오류가 발생했습니다' });
  }
})();
</script>
</body>
</html>`;

export function PostcodeSearch({ height, onComplete, onError }: PostcodeSearchProps) {
  const [loading, setLoading] = useState(true);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      // WebView 안 임의 스크립트가 보낼 수 있는 신뢰 불가 입력 — 반드시 검증 후 사용
      const message = parsePostcodeBridgeMessage(event.nativeEvent.data);
      if (!message) {
        logger.warn('우편번호 브릿지 메시지 파싱 실패', { component: 'PostcodeSearch' });
        // 삼키면 "주소를 탭했는데 아무 일도 안 일어난다"가 된다. 벤더가 필드명을 바꾸는
        // 바로 그 순간 필요한 신호이므로 웹(`PostcodeSearch.web.tsx`)과 동일하게 알린다.
        onError('주소 정보를 읽지 못했습니다. 다시 시도해주세요');
        return;
      }
      if (message.type === 'error') {
        logger.error(`우편번호 위젯 오류: ${message.message}`, { component: 'PostcodeSearch' });
        onError(message.message);
        return;
      }
      onComplete(message.result);
    },
    [onComplete, onError]
  );

  return (
    <View style={{ height }} className="overflow-hidden rounded-xl">
      <WebView
        source={{ html: POSTCODE_HTML }}
        // 인라인 HTML(about:blank) + 벤더 iframe 만 허용. `['*']` 이면 위젯 안에서 발생한
        // top-level 이동까지 이 WebView 에 로드되고, 그 페이지가 `ReactNativeWebView` 브릿지를
        // 그대로 구동할 수 있다(주소 스푸핑 경로 — zod 검증이 2차 방어지만 입구를 좁히는 게 정공법)
        originWhitelist={['about:*', 'https://t1.daumcdn.net', 'https://postcode.map.kakao.com']}
        javaScriptEnabled
        // 위젯은 최근 검색어 등을 localStorage 에 쓴다 — Android 기본값이 false 라 명시하지 않으면
        // 벤더 스크립트가 조용히 예외를 던질 수 있다
        domStorageEnabled
        // 🔴 호출부(PlaceSheet)가 SheetModal 의 ScrollView 안이다(SheetModal.tsx:450).
        // Android WebView 의 `nestedScrollEnabled` 기본값이 false 라(RNCWebView.java:79)
        // 부모에게 "가로채지 마"를 알리지 않는다 → 검색 결과 목록을 드래그하면 시트가 스크롤되고
        // 첫 화면 밖 후보에 도달할 수 없다.
        nestedScrollEnabled
        onMessage={handleMessage}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          onError('우편번호 검색을 불러오지 못했습니다. 네트워크를 확인해주세요');
        }}
        // 키보드가 올라올 때 위젯 내부가 스스로 스크롤하도록 둔다(벤더 권고)
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView
        style={{ flex: 1, backgroundColor: 'transparent' }}
      />
      {loading ? (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center gap-2">
          <ActivityIndicator />
          <Text className="text-xs text-content-muted font-sans">우편번호 검색을 불러오는 중…</Text>
        </View>
      ) : null}
    </View>
  );
}
