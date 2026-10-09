import { describe, expect, it } from 'vitest';
import { DEFAULT_BLIND_LEVELS } from '@/core/domains/ops/defaultBlindStructure';
import {
  opsBlindLevelsSaveSchema,
  opsBlindLevelsSchema,
} from '@/core/schemas/opsBlindLevel.schema';
import { breakRow, nextRow, toDraftRow, toInput, toInputs } from './blindDraft';

describe('blindDraft', () => {
  it('기본 30레벨 왕복(→ draft → 입력)은 원본과 같고 서버 스키마를 통과', () => {
    const rows = DEFAULT_BLIND_LEVELS.map((l) => toDraftRow(l));
    const r = toInputs(rows);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // 프리셋·기본 구조에서 온 행은 서버 순번이 없다 → prevSort null(새 행).
      expect(r.levels).toEqual(DEFAULT_BLIND_LEVELS.map((l) => ({ ...l, prevSort: null })));
      expect(opsBlindLevelsSchema.safeParse(r.levels).success).toBe(true);
      expect(opsBlindLevelsSaveSchema.safeParse(r.levels).success).toBe(true);
    }
  });

  it('서버에서 온 행은 저장 전 순번(prevSort)을 싣는다 — 앞 행을 지워도 그 레벨의 정체가 남는다', () => {
    const server = DEFAULT_BLIND_LEVELS.slice(0, 4).map((l, i) => ({ ...l, sort: i + 1 }));
    const rows = server.map((l) => toDraftRow(l));
    // 1번 행 삭제 + 값 수정 + 끝에 새 행 — 표 편집기가 하는 일 그대로
    const edited = [...rows.slice(1).map((r) => ({ ...r, ante: '25' })), nextRow(rows)];
    const r = toInputs(edited);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.levels.map((l) => l.prevSort)).toEqual([2, 3, 4, null]);
  });

  it('분 칸을 안 건드린 행은 초 단위 원래 시간을 그대로 저장(반올림 소실 없음)', () => {
    const base = { level: 3, smallBlind: 100, bigBlind: 200, ante: 0, isBreak: false };
    const row = toDraftRow({ ...base, durationSec: 90 });
    expect(toInput({ ...row, smallBlind: '150' })?.durationSec).toBe(90);
    expect(toInput({ ...row, minutes: '3' })?.durationSec).toBe(180);
  });

  it('휴식 행은 블라인드 0 고정', () => {
    expect(toInput({ ...breakRow([]), smallBlind: '500', minutes: '10' })).toMatchObject({
      smallBlind: 0,
      isBreak: true,
      durationSec: 600,
    });
  });

  it('분이 0·빈칸이면 그 행 번호로 거부', () => {
    const rows = [toDraftRow(DEFAULT_BLIND_LEVELS[0]), { ...nextRow([]), minutes: '' }];
    expect(toInputs(rows)).toEqual({ ok: false, badRow: 2 });
  });

  it('새 행 = 마지막 일반 레벨 + 1, 시간은 직전 행과 같게', () => {
    const rows = [toDraftRow({ ...DEFAULT_BLIND_LEVELS[0], level: 3 }), breakRow([])];
    rows[1] = { ...rows[1], minutes: '15' };
    expect(nextRow(rows)).toMatchObject({ level: '4', minutes: '15', isBreak: false });
  });

  it('쉼표·단위가 섞여도 숫자만', () => {
    expect(
      toInput({ ...nextRow([]), smallBlind: '1,000', bigBlind: '2,000칩', minutes: '20분' })
    ).toMatchObject({
      smallBlind: 1000,
      bigBlind: 2000,
      durationSec: 1200,
    });
  });
});
