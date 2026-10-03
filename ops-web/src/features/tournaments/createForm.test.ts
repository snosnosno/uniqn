import { describe, expect, it } from 'vitest';
import { createOpsTournamentSchema } from '@/core/schemas/opsTournament.schema';
import type { OpsTournament } from '@/core/types/ops';
import {
  initialCreateForm,
  prefillFromTournament,
  prefillSources,
  toCreateInput,
  toInt,
  toIntOrNull,
} from './createForm';

describe('createForm', () => {
  it('숫자 변환 — 쉼표·단위 허용, 빈칸 규칙', () => {
    expect(toInt('30,000칩')).toBe(30000);
    expect(toInt('')).toBe(0);
    expect(toIntOrNull('')).toBeNull();
    expect(toIntOrNull('10,000')).toBe(10000);
  });

  it('기본값 + 이름만 넣으면 서버 스키마(동기화 사본)를 통과한다', () => {
    const input = toCreateInput({ ...initialCreateForm('2026-09-28'), name: '  수요 딥스택 ' });
    expect(input.name).toBe('수요 딥스택');
    expect(input.venue).toBeUndefined();
    expect(input.config.bountyCost).toBeNull();
    expect(createOpsTournamentSchema.safeParse(input).success).toBe(true);
  });

  it('좌석 수 0/빈칸이면 9', () => {
    expect(toCreateInput({ ...initialCreateForm(''), seatsPerTable: '' }).seatsPerTable).toBe(9);
  });

  describe('지난 대회 설정 불러오기', () => {
    const source = {
      id: 's',
      ownerId: 'o',
      name: '지난주 토너먼트',
      venue: '강남 홀덤펍',
      eventDate: '2026-09-20',
      gameType: 'PLO',
      status: 'completed',
      seatsPerTable: 8,
      startingChips: 50000,
      buyInChips: 50000,
      rebuyChips: 40000,
      addonChips: 30000,
      buyInCost: 100000,
      feeCost: 10000,
      rebuyCost: 80000,
      addonCost: 50000,
      bountyCost: 20000,
      jobPostingId: 'posting-old',
      registrationOpen: false,
      autoSeatOnRegister: true,
      reentryAllowed: true,
      nextEntrySeq: 40,
      createdAt: '2026-09-20T00:00:00Z',
      updatedAt: '2026-09-20T00:00:00Z',
    } satisfies OpsTournament;

    it('장소·게임·칩·좌석·금액을 채우고 이름·날짜·공고 연결은 그대로 둔다', () => {
      const form = {
        ...initialCreateForm('2026-10-04', '11111111-1111-4111-8111-111111111111'),
        name: '이번 대회',
      };
      const next = prefillFromTournament(form, source);
      expect(next).toMatchObject({
        name: '이번 대회',
        eventDate: '2026-10-04',
        jobPostingId: '11111111-1111-4111-8111-111111111111',
        venue: '강남 홀덤펍',
        gameType: 'PLO',
        seatsPerTable: '8',
        startingChips: '50000',
        rebuyCost: '80000',
        bountyCost: '20000',
      });
      expect(createOpsTournamentSchema.safeParse(toCreateInput(next)).success).toBe(true);
    });

    it('바운티 없는 대회를 불러오면 바운티 칸을 비운다', () => {
      const form = { ...initialCreateForm('2026-10-04'), bountyCost: '5000' };
      expect(prefillFromTournament(form, { ...source, bountyCost: null }).bountyCost).toBe('');
    });

    it('장소가 없는 대회를 불러와도 이미 적은 장소는 남는다', () => {
      const form = { ...initialCreateForm('2026-10-04'), venue: '홍대점' };
      expect(prefillFromTournament(form, { ...source, venue: null }).venue).toBe('홍대점');
    });

    it('후보는 최근에 만든 순서로 최대 20개', () => {
      const many = Array.from({ length: 25 }, (_, i) => ({
        ...source,
        id: `t${i}`,
        createdAt: `2026-09-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      }));
      const list = prefillSources(many);
      expect(list).toHaveLength(20);
      expect(list[0].id).toBe('t24');
    });
  });

  it('이름이 비면 스키마가 거부', () => {
    expect(createOpsTournamentSchema.safeParse(toCreateInput(initialCreateForm(''))).success).toBe(
      false
    );
  });
});
