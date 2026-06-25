import { createOpsTournamentSchema } from '../opsTournament.schema';
import { registerParticipantSchema, opsParticipantStatusSchema } from '../opsParticipant.schema';

const validConfig = {
  buyInChips: 0,
  rebuyChips: 0,
  addonChips: 0,
  buyInCost: 50000,
  feeCost: 5000,
  rebuyCost: 50000,
  addonCost: 30000,
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
