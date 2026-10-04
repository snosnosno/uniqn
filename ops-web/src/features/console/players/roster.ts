/**
 * 명단 붙여넣기 해석(순수) — 엑셀·카톡에서 복사한 줄들을 등록 입력으로 바꾼다.
 * 한 줄 = 한 명. 앞의 번호("1.", "2)")와 엑셀 번호 칸은 떼고, 전화번호로 보이는 부분을 연락처로 가른다.
 * 검증 규칙은 단건 등록과 같다(이름 1~50자 · 연락처 30자 · xss). 중복은 막지 않고 **표시만** 한다 —
 * 동명이인은 실제로 있고, 같은 사람이 두 번 들어가는지는 운영자가 판단한다.
 *
 * 전화번호 판정은 보수적으로 한다(구분자를 뺀 9~13자리, `0` 또는 `+` 로 시작). 느슨하면
 * "홍길동 2024 1234"·"Player 1234567" 같은 이름의 숫자를 연락처로 떼어 이름이 잘린 채 200명이 들어간다.
 */
import { BULK_REGISTER_MAX } from '@/core/schemas/opsParticipant.schema';
import { xssValidation } from '@/core/utils/security';

export interface RosterRow {
  /** 붙여넣은 글에서의 줄 번호(1부터, 빈 줄 포함) — 오류 안내에 쓴다 */
  line: number;
  name: string;
  phone?: string;
  /** 등록을 막는 문제 */
  error?: string;
  /** 등록은 되지만 확인이 필요한 점 */
  warning?: string;
}

export interface RosterParse {
  rows: RosterRow[];
  /** 문제 없는 줄 수 */
  validCount: number;
  errorCount: number;
  /** 한도(200명) 초과 여부 */
  overLimit: boolean;
}

const NAME_MAX = 50;
const PHONE_MAX = 30;
/** 표 머리글로 흔히 쓰는 말 — 사람 이름으로 등록되지 않게 막는다. */
const HEADER_WORDS = new Set([
  '이름',
  '성명',
  '성함',
  '닉네임',
  'name',
  '번호',
  'no',
  'no.',
  '연락처',
  '전화번호',
]);

/** 전화번호로 볼 수 있는가 — 구분자(공백·하이픈·점·괄호)를 뺀 9~13자리, `0` 또는 `+` 로 시작. */
export function isPhoneLike(raw: string): boolean {
  const s = raw.trim();
  if (!/^\+?[\d\s\-.()]+$/.test(s)) return false;
  const digits = s.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 13 && (s.startsWith('+') || digits.startsWith('0'));
}

const isNumberOnly = (s: string) => /^\d+$/.test(s);

/** 앞 번호·글머리("1.", "2)", "- ") 제거. "2.5배"처럼 번호 뒤에 숫자가 이어지면 번호가 아니다. */
function stripBullet(raw: string): string {
  return raw.replace(/^\s*(?:\d{1,3}\s*[.)](?!\d)|[-*•])\s*/, '').trim();
}

/** 탭으로 나뉜 칸(엑셀) — 번호 칸·전화번호 칸이 아닌 첫 칸이 이름이다. */
function fromCells(cells: string[]): { name: string; phone?: string } {
  const phone = cells.find(isPhoneLike);
  const name = cells.find((c) => !isNumberOnly(c) && !isPhoneLike(c));
  // 이름 칸을 못 찾았으면(숫자뿐인 줄) 번호 칸이라도 이름으로 두어 "이름이 숫자예요" 로 알린다.
  return { name: name ?? cells.find((c) => !isPhoneLike(c)) ?? '', phone };
}

/** 공백으로 이어진 한 줄 — 전화번호로 읽히는 토막(최대 4토막)을 찾아 연락처로 떼고, 그 앞을 이름으로 본다. */
function fromText(text: string): { name: string; phone?: string } {
  const tokens = text.split(/\s+/).filter(Boolean);
  for (let start = 0; start < tokens.length; start += 1) {
    for (let len = Math.min(4, tokens.length - start); len >= 1; len -= 1) {
      const candidate = tokens.slice(start, start + len).join(' ');
      if (!isPhoneLike(candidate)) continue;
      // 전화번호가 맨 앞이면 뒤가 이름("010-… 홍길동"), 아니면 앞이 이름(뒤에 남는 국적 등은 버린다).
      const nameTokens = start === 0 ? tokens.slice(len) : tokens.slice(0, start);
      return { name: nameTokens.join(' '), phone: candidate };
    }
  }
  return { name: text };
}

function splitLine(raw: string): { name: string; phone?: string } {
  if (raw.includes('\t')) {
    const cells = raw
      .split('\t')
      .map((c) => stripBullet(c))
      .filter(Boolean);
    return fromCells(cells);
  }
  const text = stripBullet(raw);
  // 쉼표는 뒤 칸에 전화번호가 있을 때만 칸 구분으로 본다 — "Smith, John" 은 이름이다.
  const parts = text.split(',').map((c) => c.trim());
  const phone = parts.slice(1).find(isPhoneLike);
  if (phone) return { name: parts[0], phone };
  return fromText(text);
}

function validate(name: string, phone: string | undefined): string | undefined {
  if (!name) return '이름이 비었어요';
  if (HEADER_WORDS.has(name.toLowerCase())) return '머리글 줄이에요. 지워 주세요';
  if (name.length > NAME_MAX) return `이름은 ${NAME_MAX}자를 넘을 수 없어요`;
  if (!xssValidation(name)) return '이름에 쓸 수 없는 문자가 있어요';
  if (phone && phone.length > PHONE_MAX) return `연락처는 ${PHONE_MAX}자를 넘을 수 없어요`;
  return undefined;
}

export function parseRoster(text: string, existingNames: readonly string[] = []): RosterParse {
  const existing = new Set(existingNames.map((n) => n.trim()));
  const seen = new Set<string>();
  const rows: RosterRow[] = [];

  text.split(/\r?\n/).forEach((raw, index) => {
    if (!raw.trim()) return;
    const { name, phone } = splitLine(raw);
    const error = validate(name, phone);
    const warning = error
      ? undefined
      : isNumberOnly(name)
        ? '이름이 숫자예요. 맞는지 확인해 주세요'
        : seen.has(name)
          ? '명단 안에 같은 이름이 또 있어요'
          : existing.has(name)
            ? '이미 등록된 이름이에요'
            : undefined;
    if (!error) seen.add(name);
    rows.push({ line: index + 1, name, phone, error, warning });
  });

  const errorCount = rows.filter((r) => r.error).length;
  return {
    rows,
    validCount: rows.length - errorCount,
    errorCount,
    overLimit: rows.length > BULK_REGISTER_MAX,
  };
}
