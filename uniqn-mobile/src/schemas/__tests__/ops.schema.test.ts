import {
  createOpsTournamentSchema,
  updateOpsTournamentSchema,
  opsCostConfigSchema,
} from '../opsTournament.schema';
import { registerParticipantSchema, opsParticipantStatusSchema } from '../opsParticipant.schema';

const validConfig = {
  buyInChips: 0,
  rebuyChips: 0,
  addonChips: 0,
  buyInCost: 50000,
  feeCost: 5000,
  rebuyCost: 50000,
  addonCost: 30000,
  bountyCost: null,
};

describe('createOpsTournamentSchema', () => {
  it('유효한 대회 생성 입력 통과', () => {
    const r = createOpsTournamentSchema.safeParse({
      name: '수요 딥스택',
      gameType: 'NLH',
      startingChips: 30000,
      seatsPerTable: 9,
      config: validConfig,
    });
    expect(r.success).toBe(true);
  });

  it('XSS 이름 거부', () => {
    const r = createOpsTournamentSchema.safeParse({
      name: '<script>alert(1)</script>',
      gameType: 'NLH',
      startingChips: 0,
      seatsPerTable: 9,
      config: validConfig,
    });
    expect(r.success).toBe(false);
  });

  it('좌석 범위(2~11) 밖은 거부', () => {
    const r = createOpsTournamentSchema.safeParse({
      name: 'T',
      gameType: 'NLH',
      startingChips: 0,
      seatsPerTable: 12,
      config: validConfig,
    });
    expect(r.success).toBe(false);
  });
});

/**
 * eventDate 형식 강제 (결함 ④).
 * 🔑 create·update **양쪽**을 단언한다 — 원래 두 자리에 각각 `z.string().optional()` 이 있어
 *    한 곳만 고치면 반쪽이 되는 구조였다. 상수 공유가 실제로 성립하는지 여기서 잠근다.
 */
describe('eventDate 형식 — create/update 양쪽 동일 계약', () => {
  const createWith = (eventDate: unknown) =>
    createOpsTournamentSchema.safeParse({
      name: '수요 딥스택',
      gameType: 'NLH',
      startingChips: 30000,
      seatsPerTable: 9,
      config: validConfig,
      eventDate,
    });

  const updateWith = (eventDate: unknown) => updateOpsTournamentSchema.safeParse({ eventDate });

  it.each(['2026-08-08', '2024-02-29'])('양쪽 허용: %s', (v) => {
    expect(createWith(v).success).toBe(true);
    expect(updateWith(v).success).toBe(true);
  });

  it.each([
    ['7/1', '결함 ④의 실제 증상 — 이 값이 통과하던 게 버그다'],
    ['2026-7-1', '0 패딩 없음'],
    ['2026-02-30', '실재하지 않는 날짜'],
    ['', '빈 문자열은 undefined 로 보내야 한다'],
  ])('양쪽 거부: %s (%s)', (v) => {
    expect(createWith(v).success).toBe(false);
    expect(updateWith(v).success).toBe(false);
  });

  it('미전달(undefined)은 양쪽 통과 — 날짜 없는 대회는 정상이다', () => {
    expect(createWith(undefined).success).toBe(true);
    expect(updateWith(undefined).success).toBe(true);
  });

  it('앞뒤 공백은 trim 후 판정한다', () => {
    const r = createWith(' 2026-08-08 ');
    expect(r.success).toBe(true);
    expect(r.success && r.data.eventDate).toBe('2026-08-08');
  });
});

describe('opsCostConfigSchema — 바운티(H6 값 검증 계층)', () => {
  it('bountyCost null 통과 · 음수(-1) 거부', () => {
    expect(opsCostConfigSchema.safeParse({ ...validConfig, bountyCost: null }).success).toBe(true);
    expect(opsCostConfigSchema.safeParse({ ...validConfig, bountyCost: -1 }).success).toBe(false);
  });
});

describe('registerParticipantSchema', () => {
  const tid = '00000000-0000-0000-0000-000000000000';
  it('이름 필수', () => {
    expect(registerParticipantSchema.safeParse({ tournamentId: tid, name: '' }).success).toBe(
      false
    );
    expect(registerParticipantSchema.safeParse({ tournamentId: tid, name: 'Alice' }).success).toBe(
      true
    );
  });
});

describe('opsParticipantStatusSchema', () => {
  it('알려진 상태 수용 / 미지 값 거부', () => {
    expect(opsParticipantStatusSchema.safeParse('active').success).toBe(true);
    expect(opsParticipantStatusSchema.safeParse('zzz').success).toBe(false);
  });
});
