import { describe, expect, it } from 'vitest';
import { createOpsTournamentSchema } from '@/core/schemas/opsTournament.schema';
import { initialCreateForm, toCreateInput, toInt, toIntOrNull } from './createForm';

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

  it('이름이 비면 스키마가 거부', () => {
    expect(createOpsTournamentSchema.safeParse(toCreateInput(initialCreateForm(''))).success).toBe(
      false
    );
  });
});
