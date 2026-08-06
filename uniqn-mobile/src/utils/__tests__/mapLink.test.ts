import { buildMapSearchUrls, resolveMapQuery } from '@/utils/mapLink';

describe('resolveMapQuery', () => {
  it('주소가 없으면 상세주소만으로 검색한다(레거시 자유입력 공고)', () => {
    expect(
      resolveMapQuery({ placeName: '라운더스', detailedAddress: '서울 강남구 테헤란로 123' })
    ).toBe('서울 강남구 테헤란로 123');
  });

  // 주소 검색 도입(B1) 이후 detailedAddress 의 의미가 "층/호"로 바뀐다. 이전 우선순위
  // (상세주소 단독 최우선)를 그대로 두면 '3층 301호' 가 지도 검색어가 되어, mapLink.ts 주석에
  // 적힌 "장소 별칭을 지도에 던져 엉뚱한 곳으로 안내한 실사고"가 그대로 재발한다.
  it('상세주소가 층·호 조각이어도 도로명주소를 잃지 않는다', () => {
    expect(
      resolveMapQuery({
        placeName: '라운더스 홀덤펍',
        address: '서울 강남구 테헤란로 152',
        detailedAddress: '3층 301호',
      })
    ).toBe('서울 강남구 테헤란로 152 3층 301호');
  });

  it('레거시 조합(구 단위 주소 + 상세주소)도 합쳐서 정확도를 올린다', () => {
    // 예전 데이터는 address 에 '강남구', detailedAddress 에 실제 번지가 들어 있다.
    // 어느 한쪽만 던지면 각각 너무 넓거나(구) 너무 좁다(번지) — 합치는 쪽이 항상 낫다.
    expect(
      resolveMapQuery({ placeName: '라운더스', address: '강남구', detailedAddress: '테스트로 123' })
    ).toBe('강남구 테스트로 123');
  });

  it('상세주소가 이미 주소를 품고 있으면 덧붙이지 않는다 — 중복 토큰이 검색을 망친다', () => {
    expect(
      resolveMapQuery({
        placeName: '라운더스',
        address: '강남구',
        detailedAddress: '서울 강남구 테헤란로 1, 3층',
      })
    ).toBe('서울 강남구 테헤란로 1, 3층');
  });

  it('부분 문자열 우연일치를 포함으로 보지 않는다 — 시·구가 조용히 사라지면 안 된다', () => {
    // '강남구청길' 은 '강남구' 를 문자열로는 품지만 의미로는 아니다.
    // 완전 토큰 검사가 아니면 '강남구' 가 검색어에서 증발한다(전국에 '구청길' 다수).
    expect(resolveMapQuery({ address: '강남구', detailedAddress: '강남구청길 5' })).toBe(
      '강남구 강남구청길 5'
    );
  });

  it('주소가 상세주소를 품는 역방향 중복도 걷어낸다', () => {
    expect(resolveMapQuery({ address: '서울 강남구 테헤란로 152', detailedAddress: '152' })).toBe(
      '서울 강남구 테헤란로 152'
    );
  });

  it('주소 칸에 장소 별칭이 들어 있으면 앞에 붙이지 않는다 — 별칭은 엉뚱한 곳을 가리킨다', () => {
    // 레거시 주소 칸은 자유 텍스트라 '라운더스빌딩' 같은 별칭이 들어 있을 수 있다.
    // 이걸 도로명주소 앞에 붙이면 mapLink 주석의 그 실사고와 같은 클래스가 된다.
    expect(
      resolveMapQuery({
        placeName: '라운더스',
        address: '라운더스빌딩',
        detailedAddress: '서울 강남구 테헤란로 152',
      })
    ).toBe('서울 강남구 테헤란로 152');
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

  // 🔴 예전에는 `nmap://search` 가 첫 후보라고 단언했다. 그런데 그 후보는 런타임에서 **한 번도
  //    열린 적이 없다** — iOS 는 `LSApplicationQueriesSchemes` 미선언 스킴에 대해 canOpenURL 이
  //    설치 여부와 무관하게 false 를 돌려주는데, `app.config.ts` 에 그 선언이 없다. 즉 코드만
  //    보면 통과하고 기기에서는 틀린 **빈 통과** 단언이었다. 기본 경로는 이제 기기 기본 지도로만
  //    가고, 네이버·카카오는 사용자가 고르는 경로(`buildMapUrlsForApp`)가 담당한다.
  it('iOS 기본 경로는 항상 열리는 Apple 지도만 쓴다 (canOpenURL 게이트에 걸리는 후보를 두지 않는다)', () => {
    const urls = buildMapSearchUrls('강남구 역삼동', 'ios');

    expect(urls.some((u) => u.startsWith('nmap://'))).toBe(false);
    expect(urls[0]).toContain('https://maps.apple.com/?q=');
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
