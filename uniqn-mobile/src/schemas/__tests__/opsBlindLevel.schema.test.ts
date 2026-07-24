/**
 * opsBlindLevelsSchema — 블라인드 구조 입력 스키마 테스트.
 * 프리셋 저장·전체교체(setLevels) 공용 경계. 개수 상한 100(클라 가드)·최소 1레벨.
 */
import { opsBlindLevelsSchema } from '@/schemas/opsBlindLevel.schema';

const lvl = (level: number) => ({
  level,
  smallBlind: 100,
  bigBlind: 200,
  ante: 0,
  durationSec: 1200,
  isBreak: false,
});

describe('opsBlindLevelsSchema', () => {
  it('1레벨 이상 통과', () => {
    expect(opsBlindLevelsSchema.safeParse([lvl(1)]).success).toBe(true);
  });

  it('빈 배열 거부(최소 1레벨)', () => {
    expect(opsBlindLevelsSchema.safeParse([]).success).toBe(false);
  });

  it('100개 통과(상한 경계)', () => {
    const many = Array.from({ length: 100 }, (_, i) => lvl(i + 1));
    expect(opsBlindLevelsSchema.safeParse(many).success).toBe(true);
  });

  it('101개 거부(상한 100 초과) — 한글 안내 메시지', () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => lvl(i + 1));
    const result = opsBlindLevelsSchema.safeParse(tooMany);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('100');
    }
  });
});
