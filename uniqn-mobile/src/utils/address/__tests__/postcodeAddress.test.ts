/**
 * 우편번호 결과 경계 처리 테스트
 *
 * 핵심 계약:
 * - `sido + sigungu` 조합이 곧 region slug 다(①). 조합이 실패해도 상위 시 레벨(②) 또는
 *   기존 퍼지 매칭(③)이 받아내고, 전부 실패해야만 undefined 다.
 * - undefined 는 "지역 없음"이 아니라 **수동 선택으로 보내라**는 신호다 — region 은 제출 필수 게이트.
 */
import {
  parsePostcodeBridgeMessage,
  parsePostcodeResult,
  pickPrimaryAddress,
  resolveRegionSlug,
  type PostcodeResult,
} from '@/utils/address/postcodeAddress';
import { isRegionSlug } from '@/constants/regions';

function makeResult(overrides: Partial<PostcodeResult> = {}): PostcodeResult {
  return {
    roadAddress: '서울 강남구 테헤란로 152',
    jibunAddress: '서울 강남구 역삼동 737',
    zonecode: '06236',
    sido: '서울',
    sigungu: '강남구',
    ...overrides,
  };
}

describe('resolveRegionSlug — ① sido+sigungu 정확일치', () => {
  it('서울 구를 조합한다', () => {
    expect(resolveRegionSlug(makeResult({ sido: '서울', sigungu: '강남구' }))).toBe('서울 강남구');
    expect(resolveRegionSlug(makeResult({ sido: '서울', sigungu: '마포구' }))).toBe('서울 마포구');
  });

  it('sigungu 가 2단계 한 문자열인 일반구를 조합한다', () => {
    expect(
      resolveRegionSlug(
        makeResult({
          sido: '경기',
          sigungu: '성남시 분당구',
          roadAddress: '경기 성남시 분당구 판교역로 235',
        })
      )
    ).toBe('경기 성남시 분당구');
    expect(
      resolveRegionSlug(
        makeResult({
          sido: '충북',
          sigungu: '청주시 상당구',
          roadAddress: '충북 청주시 상당구 상당로 155',
        })
      )
    ).toBe('충북 청주시 상당구');
  });

  it('광역시 구·군을 조합한다', () => {
    expect(
      resolveRegionSlug(
        makeResult({
          sido: '부산',
          sigungu: '해운대구',
          roadAddress: '부산 해운대구 센텀중앙로 90',
        })
      )
    ).toBe('부산 해운대구');
    expect(
      resolveRegionSlug(
        makeResult({ sido: '인천', sigungu: '미추홀구', roadAddress: '인천 미추홀구 인하로 100' })
      )
    ).toBe('인천 미추홀구');
  });

  it('도 시·군(구 없음)을 조합한다', () => {
    expect(
      resolveRegionSlug(
        makeResult({ sido: '강원', sigungu: '춘천시', roadAddress: '강원 춘천시 중앙로 1' })
      )
    ).toBe('강원 춘천시');
    expect(
      resolveRegionSlug(
        makeResult({ sido: '제주', sigungu: '서귀포시', roadAddress: '제주 서귀포시 중앙로 105' })
      )
    ).toBe('제주 서귀포시');
  });

  it('sigungu 가 빈 문자열인 세종을 조합한다(공백만 남지 않아야 한다)', () => {
    expect(
      resolveRegionSlug(
        makeResult({ sido: '세종', sigungu: '', roadAddress: '세종 한누리대로 2130' })
      )
    ).toBe('세종');
  });

  it('중복 공백이 섞여도 조합이 깨지지 않는다', () => {
    expect(resolveRegionSlug(makeResult({ sido: '경기', sigungu: '성남시  분당구' }))).toBe(
      '경기 성남시 분당구'
    );
  });
});

describe('resolveRegionSlug — ② 택소노미에 없는 구는 상위 시 레벨로 낙하', () => {
  // 택소노미는 2026-07 개편 **신규 명칭만** 담는다(regions.ts:216 주석). 우편번호 위젯이
  // 아직 개편 전 구명을 돌려주면 ①이 실패한다 — 이때 조용히 undefined 를 내면 수도권
  // 사용자가 매번 수동 선택으로 떨어진다. ②가 시 레벨로 받아낸다.
  it('개편 전 인천 구명(중구)은 인천으로 낙하한다', () => {
    expect(isRegionSlug('인천 중구')).toBe(false); // 전제: 택소노미는 신규 명칭만 담는다
    expect(
      resolveRegionSlug(
        makeResult({ sido: '인천', sigungu: '중구', roadAddress: '인천 중구 신포로 1' })
      )
    ).toBe('인천');
  });

  it('택소노미에 없는 일반구는 상위 시로 낙하한다', () => {
    expect(isRegionSlug('경기 화성시 남양구')).toBe(false); // 전제
    expect(
      resolveRegionSlug(
        makeResult({
          sido: '경기',
          sigungu: '화성시 남양구',
          roadAddress: '경기 화성시 남양구 남양로 1',
        })
      )
    ).toBe('경기 화성시');
  });

  // 설계 문서 §8 "행정구역 개편 반영 여부 미확인"의 답 — 택소노미 쪽은 이미 반영돼 있다.
  it('2026-07 개편 신설 구는 ①에서 바로 잡힌다(②까지 가지 않는다)', () => {
    expect(isRegionSlug('인천 제물포구')).toBe(true);
    expect(isRegionSlug('경기 화성시 병점구')).toBe(true);
    expect(
      resolveRegionSlug(
        makeResult({ sido: '인천', sigungu: '제물포구', roadAddress: '인천 제물포구 축항대로 1' })
      )
    ).toBe('인천 제물포구');
  });
});

describe('resolveRegionSlug — ③ 축약되지 않은 시도명은 기존 퍼지 매칭이 흡수', () => {
  it('강원특별자치도 표기를 도로명주소로 매칭한다', () => {
    expect(
      resolveRegionSlug(
        makeResult({
          sido: '강원특별자치도',
          sigungu: '춘천시',
          roadAddress: '강원특별자치도 춘천시 중앙로 1',
        })
      )
    ).toBe('강원 춘천시');
  });

  it('전북특별자치도 표기를 도로명주소로 매칭한다', () => {
    expect(
      resolveRegionSlug(
        makeResult({
          sido: '전북특별자치도',
          sigungu: '전주시 완산구',
          roadAddress: '전북특별자치도 전주시 완산구 효자로 225',
        })
      )
    ).toBe('전북 전주시 완산구');
  });

  it('도로명주소가 비면 지번주소로 폴백해 매칭한다', () => {
    expect(
      resolveRegionSlug(
        makeResult({
          sido: '알수없음',
          sigungu: '',
          roadAddress: '',
          jibunAddress: '서울 마포구 합정동 1-1',
        })
      )
    ).toBe('서울 마포구');
  });
});

describe('resolveRegionSlug — ④ 전부 실패하면 undefined', () => {
  it('어떤 단계도 매칭하지 못하면 undefined 를 낸다', () => {
    expect(
      resolveRegionSlug(
        makeResult({
          sido: '알수없음',
          sigungu: '어딘가',
          roadAddress: '알 수 없는 행성 어딘가',
          jibunAddress: '',
        })
      )
    ).toBeUndefined();
  });

  it('②가 상위로만 일반화하므로 다른 시·도로 새지 않는다', () => {
    // '없는시도 강남구' → ② '없는시도'(비-slug) → ③ 도로명주소 퍼지. 도로명이 무의미하면 undefined
    expect(
      resolveRegionSlug(
        makeResult({
          sido: '없는시도',
          sigungu: '없는구',
          roadAddress: '없는시도 없는구 없는로 1',
          jibunAddress: '',
        })
      )
    ).toBeUndefined();
  });
});

describe('parsePostcodeResult — 외부 경계 검증', () => {
  it('정상 객체를 통과시킨다', () => {
    expect(parsePostcodeResult(makeResult())?.roadAddress).toBe('서울 강남구 테헤란로 152');
  });

  it('JSON 문자열(네이티브 WebView 브릿지)도 받는다', () => {
    const parsed = parsePostcodeResult(JSON.stringify(makeResult()));
    expect(parsed?.sigungu).toBe('강남구');
  });

  it('깨진 JSON 은 null 을 낸다', () => {
    expect(parsePostcodeResult('{not json')).toBeNull();
  });

  it('필수 필드가 빠지면 null 을 낸다 — undefined 로 조용히 흘리지 않는다', () => {
    const { sigungu: _omitted, ...withoutSigungu } = makeResult();
    expect(parsePostcodeResult(withoutSigungu)).toBeNull();
  });

  it('XSS 문자열이 섞이면 null 을 낸다', () => {
    expect(
      parsePostcodeResult(makeResult({ roadAddress: '<script>alert(1)</script>' }))
    ).toBeNull();
  });

  it('객체가 아닌 값은 null 을 낸다', () => {
    expect(parsePostcodeResult(null)).toBeNull();
    expect(parsePostcodeResult(42)).toBeNull();
  });
});

describe('실제 위젯 응답 (2026-08-01 브라우저 실측 캡처)', () => {
  // 위젯이 실제로 돌려준 39개 키 원문. 문서가 아니라 관찰에서 온 값이라
  // "sido 는 축약형" · "sigungu 는 2단계 한 문자열" 전제를 여기서 못 박는다.
  const REAL_PAYLOAD = {
    postcode: '',
    postcode1: '',
    postcode2: '',
    postcodeSeq: '',
    zonecode: '13494',
    address: '경기 성남시 분당구 판교역로 235',
    addressEnglish: '235 Pangyoyeok-ro, Bundang-gu, Seongnam-si, Gyeonggi-do, Republic of Korea',
    addressType: 'R',
    bcode: '4113510900',
    bname: '삼평동',
    sido: '경기',
    sidoEnglish: 'Gyeonggi-do',
    sigungu: '성남시 분당구',
    sigunguCode: '41135',
    query: '판교역로 235',
    buildingName: '에이치스퀘어 엔동',
    apartment: 'N',
    jibunAddress: '경기 성남시 분당구 삼평동 681',
    roadAddress: '경기 성남시 분당구 판교역로 235',
    userSelectedType: 'R',
    roadname: '판교역로',
  };

  it('선언하지 않은 키가 34개 더 있어도 파스가 깨지지 않는다(.strict() 아님)', () => {
    const parsed = parsePostcodeResult(REAL_PAYLOAD);
    expect(parsed).not.toBeNull();
    expect(parsed?.roadAddress).toBe('경기 성남시 분당구 판교역로 235');
    expect(parsed?.zonecode).toBe('13494');
  });

  it('실측 sido/sigungu 조합이 그대로 slug 가 된다', () => {
    const parsed = parsePostcodeResult(REAL_PAYLOAD);
    expect(parsed && resolveRegionSlug(parsed)).toBe('경기 성남시 분당구');
  });
});

describe('parsePostcodeBridgeMessage — 네이티브 WebView 브릿지 경계', () => {
  // 실기기 QA 가 제외된 상태라 네이티브 경로에서 기계 검증이 가능한 지점은 여기뿐이다.
  it('complete 봉투에서 검증된 결과를 꺼낸다', () => {
    const message = parsePostcodeBridgeMessage(
      JSON.stringify({ type: 'complete', data: makeResult() })
    );
    expect(message).toEqual({ type: 'complete', result: makeResult() });
  });

  it('error 봉투를 그대로 전달한다', () => {
    expect(
      parsePostcodeBridgeMessage(JSON.stringify({ type: 'error', message: '로드 실패' }))
    ).toEqual({ type: 'error', message: '로드 실패' });
  });

  it('complete 인데 페이로드가 깨졌으면 null 이다 — 빈 주소로 흘리지 않는다', () => {
    expect(
      parsePostcodeBridgeMessage(JSON.stringify({ type: 'complete', data: { roadAddress: 1 } }))
    ).toBeNull();
  });

  it('알 수 없는 타입·비 JSON 은 null 이다(무시)', () => {
    expect(parsePostcodeBridgeMessage(JSON.stringify({ type: 'whatever' }))).toBeNull();
    expect(parsePostcodeBridgeMessage('ping')).toBeNull();
  });

  it('WebView 안 임의 스크립트가 보낸 XSS 주소는 통과하지 못한다', () => {
    expect(
      parsePostcodeBridgeMessage(
        JSON.stringify({
          type: 'complete',
          data: makeResult({ roadAddress: '<img src=x onerror=alert(1)>' }),
        })
      )
    ).toBeNull();
  });
});

describe('pickPrimaryAddress', () => {
  it('도로명주소를 우선한다', () => {
    expect(pickPrimaryAddress(makeResult())).toBe('서울 강남구 테헤란로 152');
  });

  it('도로명 미부여 건물은 지번주소로 폴백한다', () => {
    expect(pickPrimaryAddress(makeResult({ roadAddress: '' }))).toBe('서울 강남구 역삼동 737');
  });
});
