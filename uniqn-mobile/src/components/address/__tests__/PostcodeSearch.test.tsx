/**
 * PostcodeSearch(네이티브) — WebView 문서 origin 회귀 테스트
 *
 * 이 스위트가 지키는 것은 렌더가 아니라 **벤더 계약**이다. 다음 우편번호 위젯은
 * iframe 을 `…/search?origin=` + `location.protocol + '//' + location.host` 로 열고,
 * 선택 결과를 그 값을 targetOrigin 으로 되돌린다. `source.baseUrl` 이 없으면 문서가
 * `about:blank` 로 로드돼 origin 이 `about://` 가 되고, iframe 의 postMessage 가
 * `Invalid target origin` 으로 터져 **결과 탭이 조용히 무반응**이 된다(2026-08-06 실사고).
 *
 * 실기기 없이는 재현이 불가능한 결함이라, 재발 시 최소한 여기서 걸리게 한다.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { PostcodeSearch } from '../PostcodeSearch';

describe('PostcodeSearch (네이티브 WebView)', () => {
  const renderWebView = () =>
    render(<PostcodeSearch height={400} onComplete={jest.fn()} onError={jest.fn()} />).getByTestId(
      'postcode-search-webview'
    );

  it('문서에 실제 https origin 을 부여한다 — baseUrl 없으면 결과 선택이 죽는다', () => {
    const source = renderWebView().props.source as { html: string; baseUrl?: string };

    expect(source.baseUrl).toBeDefined();
    expect(source.baseUrl).toMatch(/^https:\/\/[^/]+$/);
    // about: 스킴이면 origin 파라미터가 `about://` 로 조립돼 벤더 postMessage 가 터진다
    expect(source.baseUrl).not.toMatch(/^about:/);
  });

  it('baseUrl origin 은 벤더 iframe 출처와 달라야 한다 — 같으면 브릿지가 iframe 에 노출된다', () => {
    const source = renderWebView().props.source as { baseUrl?: string };

    expect(source.baseUrl).not.toBe('https://postcode.map.kakao.com');
  });

  it('originWhitelist 가 baseUrl origin 을 포함한다 — 빠지면 초기 로드가 외부 브라우저로 샌다', () => {
    const props = renderWebView().props as {
      source: { baseUrl?: string };
      originWhitelist: string[];
    };

    expect(props.originWhitelist).toContain(props.source.baseUrl);
  });
});
