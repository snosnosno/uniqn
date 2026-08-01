/**
 * UNIQN Mobile - 우편번호 검색 패널 (네이티브)
 *
 * @description 다음(카카오) 우편번호 위젯을 로컬 HTML 로 감싼 WebView. 결과는
 * `window.ReactNativeWebView.postMessage` 브릿지로 회수한다.
 *
 * 🔴 이 파일이 레포에서 `react-native-webview` 를 **직접 쓰는 첫 지점**이다. 지금까지는
 * PortOne RN SDK 가 내부적으로(transitive) 쓸 뿐이었다 — 설계 문서 §2-H 의 "이미 검증된 조합"
 * 서술은 사실이 아니었다(2026-08-01 실측: `src/` 내 직접 import 0건).
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
import { POSTCODE_SCRIPT_SRC } from './postcodeWidget';

/**
 * 위젯을 임베드하고 결과를 브릿지로 넘기는 로컬 문서.
 *
 * - 벤더 스크립트가 404/차단돼도 다음 인라인 스크립트는 실행된다(순서 실행) → `error` 봉투 발신
 * - `autoClose: false` — 선택 직후 위젯이 컨테이너를 걷어내면 언마운트 순서가 꼬인다
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
    new window.daum.Postcode({
      width: '100%',
      height: '100%',
      submitMode: false,
      oncomplete: function (data) {
        send({ type: 'complete', data: data });
      }
    }).embed(document.getElementById('postcode-wrap'), { autoClose: false });
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
        originWhitelist={['*']}
        javaScriptEnabled
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
        <View className="absolute inset-0 items-center justify-center gap-2">
          <ActivityIndicator />
          <Text className="text-xs text-content-muted font-sans">우편번호 검색을 불러오는 중…</Text>
        </View>
      ) : null}
    </View>
  );
}
