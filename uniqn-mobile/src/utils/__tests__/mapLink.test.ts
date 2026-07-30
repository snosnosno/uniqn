import { buildMapSearchUrls, resolveMapQuery } from '@/utils/mapLink';

describe('resolveMapQuery', () => {
  it('상세주소가 있으면 그것을 검색어로 쓴다 — 정확도가 가장 높다', () => {
    expect(
      resolveMapQuery({ placeName: '라운더스', detailedAddress: '서울 강남구 테헤란로 123' })
    ).toBe('서울 강남구 테헤란로 123');
  });

  it('상세주소가 없으면 공고에 입력된 주소를 쓴다', () => {
    expect(resolveMapQuery({ placeName: '라운더스', address: '서울 강남구 역삼동 123-4' })).toBe(
      '서울 강남구 역삼동 123-4'
    );
  });

  it('주소가 전혀 없고 장소명이 주소 꼴이 아니면 검색하지 않는다', () => {
    // '홈' 을 지도에 던지면 전혀 다른 곳으로 안내한다(실사고) — 아무 데도 안내하지 않는 게 낫다.
    expect(resolveMapQuery({ placeName: '홈' })).toBeNull();
    expect(resolveMapQuery({ placeName: '홈게임' })).toBeNull();
    expect(resolveMapQuery({})).toBeNull();
  });

  it('장소명 자체가 주소 꼴이면 그것으로 검색한다', () => {
    expect(resolveMapQuery({ placeName: '서울 강남구 테헤란로 1' })).toBe('서울 강남구 테헤란로 1');
    expect(resolveMapQuery({ placeName: '강남구' })).toBe('강남구');
  });

  it('공백뿐인 값은 없는 것으로 본다', () => {
    expect(resolveMapQuery({ placeName: '홈', detailedAddress: '   ', address: '  ' })).toBeNull();
  });
});

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
