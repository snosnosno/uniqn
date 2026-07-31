import { resolveTimeProvenance } from '../timeProvenance';
import type { WorkTimeModification } from '@/types';

function edit(overrides: Partial<WorkTimeModification> = {}): WorkTimeModification {
  return {
    modifiedAt: new Date('2026-07-31T10:00:00'),
    modifiedBy: 'employer-1',
    reason: '오타 정정',
    ...overrides,
  };
}

describe('resolveTimeProvenance', () => {
  describe('퇴근축', () => {
    it("end_time_source 가 'qr' 이고 수정 이력이 없으면 QR 이다", () => {
      expect(resolveTimeProvenance({ axis: 'end', endTimeSource: 'qr' })).toBe('qr');
    });

    // 🔴 레거시 데이터 방어: 2026-07-31 이전 수동 수정 경로는 end_time_source 를 갱신하지 않아
    //    QR 퇴근을 사람이 고친 행이 여전히 'qr' 로 남아 있다. 컬럼만 믿으면 거짓 QR 표시가 뜬다.
    it("'qr' 이어도 퇴근 시각 수정 이력이 있으면 수정됨으로 판정한다", () => {
      const provenance = resolveTimeProvenance({
        axis: 'end',
        endTimeSource: 'qr',
        modificationHistory: [edit({ newEndTime: new Date('2026-07-31T19:04:00') })],
      });

      expect(provenance).toBe('edited');
    });

    it("end_time_source 가 'manual' 이면 이력이 없어도 수정됨이다", () => {
      expect(resolveTimeProvenance({ axis: 'end', endTimeSource: 'manual' })).toBe('edited');
    });

    it('출처가 없으면 아무것도 주장하지 않는다', () => {
      expect(resolveTimeProvenance({ axis: 'end' })).toBe('unknown');
      expect(resolveTimeProvenance({ axis: 'end', endTimeSource: null })).toBe('unknown');
    });

    // 미정(null)으로 바꾼 것도 수정이다. truthy 검사를 쓰면 이 케이스를 놓친다.
    it('퇴근 시각을 미정(null)으로 바꾼 이력도 수정으로 센다', () => {
      const provenance = resolveTimeProvenance({
        axis: 'end',
        endTimeSource: 'qr',
        modificationHistory: [edit({ newEndTime: null })],
      });

      expect(provenance).toBe('edited');
    });

    it('출근만 고친 이력은 퇴근 판정을 바꾸지 않는다', () => {
      const provenance = resolveTimeProvenance({
        axis: 'end',
        endTimeSource: 'qr',
        modificationHistory: [edit({ newStartTime: new Date('2026-07-31T09:00:00') })],
      });

      expect(provenance).toBe('qr');
    });
  });

  describe('출근축', () => {
    // 스키마에 start_time_source 가 없다 — 출근이 QR 유래라고 주장할 근거가 없다.
    it('출근은 QR 로 판정하지 않는다', () => {
      expect(resolveTimeProvenance({ axis: 'start', endTimeSource: 'qr' })).toBe('unknown');
    });

    it('출근 시각 수정 이력이 있으면 수정됨이다', () => {
      const provenance = resolveTimeProvenance({
        axis: 'start',
        modificationHistory: [edit({ newStartTime: new Date('2026-07-31T09:00:00') })],
      });

      expect(provenance).toBe('edited');
    });

    it('퇴근만 고친 이력은 출근 판정을 바꾸지 않는다', () => {
      const provenance = resolveTimeProvenance({
        axis: 'start',
        modificationHistory: [edit({ newEndTime: new Date('2026-07-31T19:04:00') })],
      });

      expect(provenance).toBe('unknown');
    });
  });

  it('빈 이력 배열은 이력 없음과 같다', () => {
    expect(
      resolveTimeProvenance({ axis: 'end', endTimeSource: 'qr', modificationHistory: [] })
    ).toBe('qr');
  });
});
