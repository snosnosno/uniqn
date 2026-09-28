import { describe, expect, it } from 'vitest';
import { mergeInterval, offsetOf, sampleInterval, type ClockSample } from './serverClock';

/** 기기 시계가 true 보다 `skew` 만큼 빠를 때, 서버가 [serverAt] 에 응답을 만든 샘플. */
function sample(serverAt: number, skew: number, before = 20, after = 20): ClockSample {
  const localAtServer = serverAt + skew;
  return {
    sentAt: localAtServer - before,
    receivedAt: localAtServer + after,
    serverDate: Math.floor(serverAt / 1000) * 1000,
  };
}

describe('serverClock 오프셋 추정', () => {
  it('한 샘플 구간은 진짜 오프셋을 포함한다', () => {
    const skew = 3_700; // 기기가 3.7초 빠름 → 오프셋 −3700
    const iv = sampleInterval(sample(1_000_450, skew))!;
    expect(iv.lo).toBeLessThanOrEqual(-skew);
    expect(iv.hi).toBeGreaterThanOrEqual(-skew);
  });

  it('초 경계의 여러 위치 샘플을 쌓으면 1초 해상도보다 좁게 수렴', () => {
    const skew = -2_345; // 기기가 2.345초 느림
    let iv = null;
    for (const serverAt of [1_000_010, 1_003_990, 1_007_500, 1_011_200, 1_015_870, 1_020_050]) {
      iv = mergeInterval(iv, sampleInterval(sample(serverAt, skew))!);
    }
    expect(iv!.hi - iv!.lo).toBeLessThan(200);
    expect(Math.abs(offsetOf(iv) - -skew)).toBeLessThan(100);
  });

  it('교집합이 비면(기기 시계 변경) 새 샘플부터 다시', () => {
    const a = sampleInterval(sample(1_000_000, 0))!;
    const b = sampleInterval(sample(2_000_000, 60_000))!; // 1분 점프
    expect(mergeInterval(a, b)).toEqual(b);
  });

  it('너무 느린 응답·역순 시각은 버린다', () => {
    expect(sampleInterval({ sentAt: 0, receivedAt: 6_000, serverDate: 0 })).toBeNull();
    expect(sampleInterval({ sentAt: 10, receivedAt: 5, serverDate: 0 })).toBeNull();
  });

  it('추정 전 오프셋은 0(기기 시계 신뢰)', () => {
    expect(offsetOf(null)).toBe(0);
  });
});

describe('mergeRobust — 이상치 1건에 무너지지 않는다', () => {
  it('모순 샘플 1건은 무시, 같은 쪽 2연속이면 갈아탄다', async () => {
    const { mergeRobust, resetServerClockForTest, recordClockSample, getServerOffsetMs } =
      await import('./serverClock');
    resetServerClockForTest();
    // 오프셋 0 근처로 수렴
    for (const t of [1_000_100, 1_003_600, 1_007_300]) {
      recordClockSample({
        sentAt: t - 20,
        receivedAt: t + 20,
        serverDate: Math.floor(t / 1000) * 1000,
      });
    }
    const settled = getServerOffsetMs();
    expect(Math.abs(settled)).toBeLessThan(600);
    // 낡은 Date(60초 과거) 한 건 → 무시
    const far = { lo: -61_000, hi: -59_000 };
    expect(mergeRobust(far)).not.toEqual(far);
    // 같은 쪽이 한 번 더 오면 갈아탄다
    expect(mergeRobust({ lo: -60_500, hi: -59_500 })).toEqual({ lo: -60_500, hi: -59_500 });
    resetServerClockForTest();
  });
});
