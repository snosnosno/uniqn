import { isPhoneLike, parseRoster } from '../roster';

const first = (line: string) => parseRoster(line).rows[0];

describe('isPhoneLike', () => {
  it.each([
    '010-1234-5678',
    '01012345678',
    '010 1234 5678',
    '010.1234.5678',
    '+82 10-1234-5678',
    '02-123-4567',
  ])('전화번호로 본다: %s', (s) => expect(isPhoneLike(s)).toBe(true));

  it.each(['1234567', '2024 1234', '2 010-1234-5678', '12345678901234', '010-12', 'KR', ''])(
    '전화번호로 보지 않는다: %s',
    (s) => expect(isPhoneLike(s)).toBe(false)
  );
});

describe('parseRoster', () => {
  it('한 줄에 한 명 — 빈 줄은 건너뛰고 줄 번호는 원문 기준', () => {
    const r = parseRoster('홍길동\n\n  김철수  \n');
    expect(r.rows).toEqual([
      { line: 1, name: '홍길동', phone: undefined, error: undefined, warning: undefined },
      { line: 3, name: '김철수', phone: undefined, error: undefined, warning: undefined },
    ]);
    expect(r).toMatchObject({ validCount: 2, errorCount: 0, overLimit: false });
  });

  it.each([
    ['1. 홍길동', '홍길동'],
    ['12) 김철수', '김철수'],
    ['1.홍길동', '홍길동'],
    ['- 이영희', '이영희'],
    ['• 박민수', '박민수'],
  ])('앞 번호·글머리를 뗀다: %s', (line, name) => {
    expect(first(line).name).toBe(name);
  });

  it('번호처럼 보여도 숫자가 이어지면 떼지 않는다', () => {
    expect(first('2.5배 김씨').name).toBe('2.5배 김씨');
  });

  it.each([
    ['홍길동\t010-1234-5678', '홍길동', '010-1234-5678'],
    ['홍길동, 01012345678', '홍길동', '01012345678'],
    ['홍길동 010 1234 5678', '홍길동', '010 1234 5678'],
    ['홍길동 010.1234.5678', '홍길동', '010.1234.5678'],
    ['John Smith +82 10-1234-5678', 'John Smith', '+82 10-1234-5678'],
    ['홍길동\tKR\t01012345678', '홍길동', '01012345678'],
    ['홍길동 01012345678 KR', '홍길동', '01012345678'],
    ['010-1234-5678 홍길동', '홍길동', '010-1234-5678'],
    ['010-1234-5678\t홍길동', '홍길동', '010-1234-5678'],
    ['김철수 2 010-1234-5678', '김철수 2', '010-1234-5678'],
  ])('연락처를 가른다: %s', (line, name, phone) => {
    expect(first(line)).toMatchObject({ name, phone });
  });

  it.each([
    ['홍길동2', '홍길동2'],
    ['Player 7', 'Player 7'],
    ['Player 1234567', 'Player 1234567'],
    ['홍길동 2024 1234', '홍길동 2024 1234'],
    ['Smith, John', 'Smith, John'],
  ])('이름에 든 숫자·쉼표는 연락처로 떼지 않는다: %s', (line, name) => {
    expect(first(line)).toMatchObject({ name, phone: undefined });
  });

  it('엑셀 번호 칸은 이름이 아니다', () => {
    expect(first('1\t홍길동\t010-1234-5678')).toMatchObject({
      name: '홍길동',
      phone: '010-1234-5678',
    });
  });

  it('탭 칸 중 전화번호가 아닌 것(국적 등)은 연락처로 쓰지 않는다', () => {
    expect(first('홍길동\tKR')).toMatchObject({ name: '홍길동', phone: undefined });
  });

  it.each(['이름\t연락처', '성명', 'No\tName\t연락처', 'name'])(
    '머리글 줄은 오류로 막는다: %s',
    (line) => {
      expect(first(line).error).toBe('머리글 줄이에요. 지워 주세요');
    }
  );

  it('이름이 숫자뿐이면 등록은 되지만 확인하라고 알린다', () => {
    expect(first('17')).toMatchObject({
      name: '17',
      error: undefined,
      warning: '이름이 숫자예요. 맞는지 확인해 주세요',
    });
  });

  it('51자 이름·스크립트가 든 이름은 오류', () => {
    const r = parseRoster(`${'가'.repeat(51)}\n<script>alert(1)</script>\n정상`);
    expect(r.rows.map((x) => Boolean(x.error))).toEqual([true, true, false]);
    expect(r).toMatchObject({ validCount: 1, errorCount: 2 });
  });

  it('번호만 있고 이름이 없는 줄은 오류', () => {
    expect(first('3.').error).toBe('이름이 비었어요');
    expect(first('010-1234-5678').error).toBe('이름이 비었어요');
  });

  it('명단 안 중복과 이미 등록된 이름은 막지 않고 표시만 한다', () => {
    const r = parseRoster('홍길동\n김철수\n홍길동', ['김철수']);
    expect(r.rows.map((x) => x.warning)).toEqual([
      undefined,
      '이미 등록된 이름이에요',
      '명단 안에 같은 이름이 또 있어요',
    ]);
    expect(r).toMatchObject({ validCount: 3, errorCount: 0 });
  });

  it('200명까지는 통과, 201명은 한도 초과', () => {
    const lines = (n: number) => Array.from({ length: n }, (_, i) => `P${i}`).join('\n');
    expect(parseRoster(lines(200)).overLimit).toBe(false);
    expect(parseRoster(lines(201)).overLimit).toBe(true);
  });

  it('윈도우 줄바꿈(CRLF)도 한 줄씩 읽는다', () => {
    expect(parseRoster('가\r\n나\r\n').rows.map((r) => r.name)).toEqual(['가', '나']);
  });
});
