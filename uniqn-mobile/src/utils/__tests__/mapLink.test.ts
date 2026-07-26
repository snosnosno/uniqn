import { buildMapSearchUrls } from '@/utils/mapLink';

describe('buildMapSearchUrls', () => {
  it('빈 주소면 후보가 없다', () => {
    expect(buildMapSearchUrls('   ', 'ios')).toEqual([]);
  });

  it('iOS는 네이버 지도를 먼저, Apple 지도를 폴백으로 둔다', () => {
    const [first, fallback] = buildMapSearchUrls('강남구 역삼동', 'ios');

    expect(first).toContain('nmap://search?query=');
    // 마지막 후보는 항상 열리는 웹 링크여야 길찾기가 무반응으로 끝나지 않는다.
    expect(fallback).toContain('https://maps.apple.com/?q=');
  });

  it('Android는 지도 앱 선택 다이얼로그를 먼저 띄운다', () => {
    const [first, fallback] = buildMapSearchUrls('강남구 역삼동', 'android');

    expect(first).toContain('geo:0,0?q=');
    expect(fallback).toContain('https://map.kakao.com/link/search/');
  });

  it('웹은 지도 검색 링크 하나만 쓴다', () => {
    expect(buildMapSearchUrls('강남구 역삼동', 'web')).toHaveLength(1);
  });

  it('한글·공백을 URL 인코딩한다', () => {
    const [first] = buildMapSearchUrls('서울 강남구', 'ios');

    expect(first).not.toContain(' ');
    expect(first).toContain(encodeURIComponent('서울 강남구'));
  });

  it('앞뒤 공백은 잘라내고 인코딩한다', () => {
    const [first] = buildMapSearchUrls('  역삼동  ', 'android');

    expect(first).toBe(`geo:0,0?q=${encodeURIComponent('역삼동')}`);
  });
});
