/**
 * 한국어 조사 선택 — 받침 판정 계약 테스트
 *
 * @description 문구 감사(2026-08-24 P2-1)에서 `${who}가` 처럼 조사를 문자열로 박아
 * "박지훈가" 가 나가던 결함이 실사용 2곳, 잠재 6곳이었다. 값의 마지막 글자 종성으로
 * 조사를 고르되, 한글뿐 아니라 **숫자·영문**도 한국어 독음 기준으로 판정해야 한다
 * (전화번호 `…5678` → 팔(ㄹ) → '로', 이메일 `…com` → 엠(ㅁ) → '으로').
 */
import { josa, particleFor, hasFinalConsonant } from '@/utils/text/josa';

describe('hasFinalConsonant — 받침 판정', () => {
  it('한글 받침 유무를 가른다', () => {
    expect(hasFinalConsonant('박지훈')).toBe(true); // ㄴ
    expect(hasFinalConsonant('김철수')).toBe(false); // 수
    expect(hasFinalConsonant('공고')).toBe(false);
    expect(hasFinalConsonant('정산')).toBe(true);
  });

  it('영문은 알파벳 한국어 독음으로 판정한다', () => {
    expect(hasFinalConsonant('Face ID')).toBe(false); // D = 디
    expect(hasFinalConsonant('Gmail')).toBe(true); // L = 엘(ㄹ)
    expect(hasFinalConsonant('naver.com')).toBe(true); // M = 엠(ㅁ)
    expect(hasFinalConsonant('Slack')).toBe(false); // K = 케이
  });

  it('숫자는 한국어 읽기로 판정한다', () => {
    expect(hasFinalConsonant('010-1234-5678')).toBe(true); // 8 = 팔(ㄹ)
    expect(hasFinalConsonant('12')).toBe(false); // 2 = 이
    expect(hasFinalConsonant('3')).toBe(true); // 3 = 삼(ㅁ)
    expect(hasFinalConsonant('10')).toBe(true); // 0 = 영(ㅇ)
  });

  it('끝의 공백·닫는 괄호·따옴표는 무시하고 그 앞 글자로 판정한다', () => {
    expect(hasFinalConsonant('정산  ')).toBe(true);
    expect(hasFinalConsonant('(공고)')).toBe(false);
    expect(hasFinalConsonant('"박지훈"')).toBe(true);
  });

  it('판정할 글자가 없으면 false 로 떨어진다', () => {
    expect(hasFinalConsonant('')).toBe(false);
    expect(hasFinalConsonant('   ')).toBe(false);
  });
});

describe('particleFor — 조사만 반환', () => {
  it.each([
    ['을/를', '정산', '을'],
    ['을/를', '공고', '를'],
    ['이/가', '박지훈', '이'],
    ['이/가', '김철수', '가'],
    ['은/는', '정산', '은'],
    ['은/는', '공고', '는'],
    ['와/과', '정산', '과'],
    ['와/과', '공고', '와'],
  ] as const)('%s 짝에서 "%s" → "%s"', (pair, word, expected) => {
    expect(particleFor(word, pair)).toBe(expected);
  });

  describe('으로/로 — ㄹ 받침은 받침이 있어도 "로"', () => {
    it.each([
      ['서울', '로'], // ㄹ 받침
      ['Gmail', '로'], // L = 엘(ㄹ)
      ['010-1234-5678', '로'], // 8 = 팔(ㄹ)
      ['Face ID', '로'], // 받침 없음
      ['정산', '으로'], // ㄴ 받침
      ['naver.com', '으로'], // M = 엠(ㅁ)
    ])('"%s" → "%s"', (word, expected) => {
      expect(particleFor(word, '으로/로')).toBe(expected);
    });
  });
});

describe('josa — 값 + 조사 결합', () => {
  it('감사에서 실제로 깨져 있던 사례를 바로잡는다', () => {
    // CollaboratorRow: `${who}가` → "박지훈가"
    expect(josa('박지훈', '이/가')).toBe('박지훈이');
    expect(josa('김철수', '이/가')).toBe('김철수가');
    // BiometricButton: `${biometricTypeName}으로` → "Face ID으로"
    expect(josa('Face ID', '으로/로')).toBe('Face ID로');
    expect(josa('지문 인식', '으로/로')).toBe('지문 인식으로');
    // employer-applications: `${email}로` → "…com로"
    expect(josa('user@naver.com', '으로/로')).toBe('user@naver.com으로');
  });

  it('빈 값이면 조사를 붙이지 않는다 — "를" 같은 조각이 홀로 남지 않게', () => {
    expect(josa('', '을/를')).toBe('');
    expect(josa('   ', '이/가')).toBe('   ');
  });
});
