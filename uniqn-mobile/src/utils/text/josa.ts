/**
 * 한국어 조사 선택 — 값의 받침에 맞는 조사를 고른다
 *
 * @description 문구 안에 `${who}가` 처럼 조사를 박으면 값의 받침에 따라 문법이 깨진다
 * (감사 2026-08-24 P2-1: 실사용 2곳이 "박지훈가"·"Face ID으로" 로 나가고 있었다).
 * 값의 **마지막 유효 글자**를 한국어 독음 기준으로 읽어 종성을 판정한다.
 *
 * - 한글: 유니코드 음절에서 종성 인덱스를 직접 계산한다.
 * - 영문: 알파벳 이름의 한국어 독음으로 판정한다(D=디 받침없음 / L=엘 ㄹ / M=엠 ㅁ).
 * - 숫자: 한자어 수 읽기로 판정한다(8=팔 ㄹ / 2=이 받침없음 / 3=삼 ㅁ).
 *
 * ⚠️ 판정할 글자가 없거나(빈 값) 위 세 갈래에 없는 문자면 **받침 없음**으로 떨어진다.
 *    한자·이모지로 끝나는 값은 지원 범위 밖이다 — 그런 값을 조사와 붙일 일이 생기면
 *    문구를 조사 없는 구조로 바꾸는 쪽이 낫다.
 */

/** 조사 짝. 표기는 국어 관용 순서를 따른다(받침 순서는 짝마다 다르므로 아래 표가 진실원). */
export type JosaPair = '을/를' | '이/가' | '은/는' | '와/과' | '으로/로';

/**
 * 짝 → [받침 있을 때, 받침 없을 때].
 *
 * ⚠️ 라벨을 '/' 로 쪼개 앞뒤를 쓰면 **'와/과' 에서 뒤집힌다**(받침 있을 때가 '과').
 *    관용 표기 순서와 받침 순서가 일치하지 않으므로 표로 고정한다.
 */
const PARTICLES: Record<JosaPair, readonly [string, string]> = {
  '을/를': ['을', '를'],
  '이/가': ['이', '가'],
  '은/는': ['은', '는'],
  '와/과': ['과', '와'],
  '으로/로': ['으로', '로'],
};

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
const JONGSEONG_COUNT = 28;
/** 종성 목록에서 ㄹ 의 인덱스 — '으로/로' 는 ㄹ 받침을 받침 없음처럼 다룬다. */
const JONGSEONG_RIEUL = 8;

/** 알파벳 이름의 한국어 독음 종성. 없으면 받침 없음. */
const ALPHABET_FINAL: Record<string, 'ㄹ' | 'ㅁ' | 'ㄴ'> = {
  l: 'ㄹ', // 엘
  m: 'ㅁ', // 엠
  n: 'ㄴ', // 엔
  r: 'ㄹ', // 알
};

/** 한자어 수 읽기의 종성. 없으면 받침 없음. */
const DIGIT_FINAL: Record<string, 'ㄹ' | 'ㅁ' | 'ㄱ' | 'ㅇ'> = {
  '0': 'ㅇ', // 영
  '1': 'ㄹ', // 일
  '3': 'ㅁ', // 삼
  '6': 'ㄱ', // 육
  '7': 'ㄹ', // 칠
  '8': 'ㄹ', // 팔
};

/** 조사 판정에서 건너뛰는 꼬리 문자 — 괄호·따옴표·공백은 값의 일부가 아니다. */
const IGNORED_TAIL = /[\s)\]}'"'"』」》>]/;

/** 판정에 쓸 마지막 글자. 없으면 null. */
function lastMeaningfulChar(word: string): string | null {
  for (let i = word.length - 1; i >= 0; i -= 1) {
    const ch = word[i];
    if (ch && !IGNORED_TAIL.test(ch)) return ch;
  }
  return null;
}

/** 마지막 글자의 종성 기호. 받침이 없거나 판정 불가면 null. */
function finalConsonant(word: string): string | null {
  const ch = lastMeaningfulChar(word);
  if (!ch) return null;

  const code = ch.charCodeAt(0);
  if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
    const index = (code - HANGUL_BASE) % JONGSEONG_COUNT;
    if (index === 0) return null;
    return index === JONGSEONG_RIEUL ? 'ㄹ' : 'other';
  }

  const lower = ch.toLowerCase();
  if (ALPHABET_FINAL[lower]) return ALPHABET_FINAL[lower];
  if (DIGIT_FINAL[ch]) return DIGIT_FINAL[ch];

  return null;
}

/** 값이 받침으로 끝나는가. 판정 불가면 false. */
export function hasFinalConsonant(word: string): boolean {
  return finalConsonant(word) !== null;
}

/** 값에 맞는 조사만 반환한다. */
export function particleFor(word: string, pair: JosaPair): string {
  const [withFinal, withoutFinal] = PARTICLES[pair];
  const final = finalConsonant(word);

  // '으로/로' 만 예외 — ㄹ 받침은 받침 없음과 같은 편에 선다("서울로", "8층으로"가 아니라 "…8로").
  if (pair === '으로/로') {
    return final === null || final === 'ㄹ' ? withoutFinal : withFinal;
  }

  return final === null ? withoutFinal : withFinal;
}

/**
 * 값 + 조사를 결합한다.
 *
 * @example josa('박지훈', '이/가') // '박지훈이'
 * @example josa('Face ID', '으로/로') // 'Face ID로'
 */
export function josa(word: string, pair: JosaPair): string {
  // 빈 값에 조사를 붙이면 "를" 같은 조각이 홀로 남는다 — 호출부에서 값 없음을
  // 이미 걸렀어야 하지만, 여기서도 조용히 통과시키지 않고 원문을 그대로 돌려준다.
  if (lastMeaningfulChar(word) === null) return word;
  return `${word}${particleFor(word, pair)}`;
}
