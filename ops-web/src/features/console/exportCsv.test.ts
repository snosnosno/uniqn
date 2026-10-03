import { describe, expect, it } from 'vitest';
import type { OpsEvent, OpsParticipant } from '@/core/types/ops';
import { buildHistoryCsv, buildParticipantsCsv, csvCell, csvFileName } from './exportCsv';

const p = (o: Partial<OpsParticipant>): OpsParticipant => ({
  id: 'id',
  tournamentId: 't',
  entryNumber: 1,
  name: '홍길동',
  viewToken: null,
  status: 'active',
  chips: 30000,
  rebuys: 0,
  addOns: 0,
  reentries: 0,
  knockouts: 0,
  createdAt: '',
  updatedAt: '',
  ...o,
});

describe('csvCell', () => {
  it.each(['=1+1', '+82', '-cmd', '@SUM(A1)'])('수식으로 읽힐 %s 는 앞에 따옴표를 붙인다', (v) => {
    expect(csvCell(v).replace(/^"|"$/g, '')).toBe(`'${v}`);
  });

  it('숫자 음수는 그대로 둔다(수식 아님)', () => {
    expect(csvCell(-5)).toBe('-5');
  });

  it('쉼표·따옴표·줄바꿈은 감싸고 따옴표는 두 번', () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
  });

  it('null·undefined 는 빈칸', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
});

describe('buildParticipantsCsv', () => {
  const list = [
    p({ id: 'a', entryNumber: 3, name: '셋', status: 'active' }),
    p({
      id: 'b',
      entryNumber: 1,
      name: '우승',
      status: 'busted',
      finishPosition: 1,
      prizeAmount: 1000000,
      prizePaidAt: '2026-10-01T00:00:00Z',
    }),
    p({ id: 'c', entryNumber: 2, name: '둘', status: 'busted', finishPosition: 2 }),
  ];
  const csv = buildParticipantsCsv(list, (id) => (id === 'a' ? 'T1-3' : null));
  const lines = csv.replace(/^﻿/, '').trimEnd().split('\r\n');

  it('엑셀 한글용 BOM 으로 시작한다', () => {
    expect(csv.startsWith('﻿')).toBe(true);
  });

  it('순위 있는 사람이 위(1위부터), 나머지는 엔트리 순', () => {
    expect(lines.slice(1).map((l) => l.split(',')[1])).toEqual(['우승', '둘', '셋']);
  });

  it('탈락자는 칩 칸을 비우고 지급 완료는 O', () => {
    expect(lines[1]).toBe('1,우승,탈락,,,0,0,0,0,1,1000000,O');
    expect(lines[3]).toBe('3,셋,플레이,T1-3,30000,0,0,0,0,,,');
  });

  it('연락처·국적·메모는 내보내지 않는다', () => {
    const withPii = buildParticipantsCsv(
      [p({ phone: '01012345678', nationality: 'KR', note: '비밀' })],
      () => null
    );
    expect(withPii).not.toMatch(/01012345678|KR|비밀/);
  });
});

describe('buildHistoryCsv', () => {
  const event = (o: Partial<OpsEvent>): OpsEvent => ({
    id: 'e',
    tournamentId: 't',
    type: 'player_busted',
    payload: {},
    createdAt: '2026-10-03T15:00:05Z',
    ...o,
  });
  const csv = buildHistoryCsv([
    event({ payload: { finish_position: 3, prize: 500000 }, actorDevice: '등록데스크 1' }),
    event({ type: 'level_set', payload: { level_sort: 4 }, createdAt: '2026-10-03T14:00:00Z' }),
  ]);
  const lines = csv.replace(/^﻿/, '').trimEnd().split('\r\n');

  it('BOM 과 머리줄로 시작한다', () => {
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines[0]).toBe('시각,분류,내용,요약,기기');
  });

  it('시각은 한국 시각, 분류·내용은 화면과 같은 한글 라벨', () => {
    expect(lines[1]).toBe(
      '2026-10-04 00:00:05,참가자,탈락,finish position 3 · prize 500000,등록데스크 1'
    );
    expect(lines[2]).toBe('2026-10-03 23:00:00,클럭,레벨 변경,level sort 4,');
  });

  it('받은 순서를 그대로 둔다', () => {
    expect(lines).toHaveLength(3);
  });

  it('이름·연락처·국적·메모는 요약에서 뺀다', () => {
    const edited = buildHistoryCsv([
      event({
        type: 'player_updated',
        payload: {
          name_after: '홍길동',
          name_before: '홍길순',
          phone_after: '01012345678',
          phone_before: '01000000000',
          nationality_after: 'KR',
          note: '비밀',
          participant_id: 'p1',
        },
      }),
      event({ type: 'player_deleted', payload: { name: '삭제된사람', entry_number: 7 } }),
    ]);
    expect(edited).not.toMatch(/홍길동|홍길순|01012345678|01000000000|KR|비밀|삭제된사람/);
    expect(edited).toContain('participant id p1');
    expect(edited).toContain('entry number 7');
  });

  it('기기 이름이 수식으로 읽히지 않게 막는다', () => {
    const injected = buildHistoryCsv([event({ actorDevice: '=HYPERLINK("x")' })]);
    expect(injected).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe('csvFileName', () => {
  it('이력 파일은 이름에 이력이 들어간다', () => {
    expect(csvFileName('대회', new Date(2026, 9, 1), '이력')).toBe('대회_이력_20261001.csv');
  });

  it('파일명에 못 쓰는 문자를 바꾸고 날짜를 붙인다', () => {
    expect(csvFileName('주말 대회: A/B', new Date(2026, 9, 1))).toBe(
      '주말_대회_A_B_명단_20261001.csv'
    );
  });
});
