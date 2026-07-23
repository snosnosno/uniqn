/** 기본 블라인드 구조(B1, spec §2 확정). ante=BB, 20분/레벨, 브레이크 없음. 시드·앱 기본 프리셋 단일 소스. */
import type { OpsBlindLevelInput } from '@/schemas/opsBlindLevel.schema';

export const DEFAULT_LEVEL_DURATION_SEC = 1200;

const PAIRS: readonly [sb: number, bb: number][] = [
  [100, 200],
  [200, 300],
  [200, 400],
  [300, 500],
  [300, 600],
  [400, 800],
  [500, 1000],
  [600, 1200],
  [800, 1500],
  [1000, 2000],
  [1500, 2500],
  [1500, 3000],
  [2000, 4000],
  [2500, 5000],
  [3000, 6000],
  [4000, 8000],
  [5000, 10000],
  [6000, 12000],
  [8000, 16000],
  [10000, 20000],
  [15000, 25000],
  [15000, 30000],
  [20000, 40000],
  [25000, 50000],
  [30000, 60000],
  [40000, 80000],
  [50000, 100000],
  [60000, 120000],
  [80000, 150000],
  [100000, 200000],
];

export const DEFAULT_BLIND_LEVELS: OpsBlindLevelInput[] = PAIRS.map(([sb, bb], i) => ({
  level: i + 1,
  smallBlind: sb,
  bigBlind: bb,
  ante: bb,
  durationSec: DEFAULT_LEVEL_DURATION_SEC,
  isBreak: false,
}));
