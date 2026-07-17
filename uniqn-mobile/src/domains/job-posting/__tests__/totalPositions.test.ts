import { calculateTotalPositionsFromSchedule } from '@/domains/job-posting/stats';
import type { PostingSchedule } from '@/types/jobPosting';

// 좌석 기준(seat basis) 알고리즘: 모든 날짜×슬롯×역할 count의 총합(좌석 기준)으로
// totalPositions를 산출한다. (날짜마다 다른 사람 투입 가정 — 구 peak 회전 모델 대체)

describe('calculateTotalPositionsFromSchedule', () => {
  describe('fixed schedule', () => {
    it('sums roles count in synthetic slot (dealer 2 + floor 1 = 3)', () => {
      const schedule: PostingSchedule = {
        kind: 'fixed',
        requirements: [
          {
            date: null,
            timeSlots: [
              {
                startTime: '19:00',
                isTimeToBeAnnounced: false,
                roles: [
                  { role: 'dealer', count: 2 },
                  { role: 'floor', count: 1 },
                ],
              },
            ],
          },
        ],
      };
      expect(calculateTotalPositionsFromSchedule(schedule)).toBe(3);
    });

    it('returns 0 when synthetic slot roles is empty', () => {
      const schedule: PostingSchedule = {
        kind: 'fixed',
        requirements: [
          {
            date: null,
            timeSlots: [{ startTime: '19:00', isTimeToBeAnnounced: false, roles: [] }],
          },
        ],
      };
      expect(calculateTotalPositionsFromSchedule(schedule)).toBe(0);
    });

    // 같은 슬롯 안 동일 역할 중복 엔트리는 동시 필요 인원이므로 합산해야 한다.
    // (peak-by-role 만 쓰면 [dealer:3, dealer:2] 가 max 3 으로 과소 집계되는 회귀)
    it('sums duplicate same-role entries within one slot (dealer 3 + dealer 2 = 5)', () => {
      const schedule: PostingSchedule = {
        kind: 'fixed',
        requirements: [
          {
            date: null,
            timeSlots: [
              {
                startTime: '19:00',
                isTimeToBeAnnounced: false,
                roles: [
                  { role: 'dealer', count: 3 },
                  { role: 'dealer', count: 2 },
                ],
              },
            ],
          },
        ],
      };
      expect(calculateTotalPositionsFromSchedule(schedule)).toBe(5);
    });

    // SP3: calculateFilledPositionsFromSchedule 제거됨 — filled 는 schedule 에서 파생하지 않음(컬럼·트리거 권위).
    // 관련 테스트는 삭제. capacity/총원 계산은 위 calculateTotalPositionsFromSchedule 로 충분히 커버됨.
  });

  describe('dated schedule', () => {
    it('returns 0 when requirements array is empty', () => {
      const schedule: PostingSchedule = {
        kind: 'dated',
        primaryDate: '2025-05-01',
        allDates: [],
        requirements: [],
      };

      expect(calculateTotalPositionsFromSchedule(schedule)).toBe(0);
    });

    it('grouped 3-day dealer x2 every day -> sum 6', () => {
      const schedule: PostingSchedule = {
        kind: 'dated',
        primaryDate: '2025-05-01',
        allDates: ['2025-05-01', '2025-05-02', '2025-05-03'],
        requirements: [
          {
            date: '2025-05-01',
            isGrouped: true,
            timeSlots: [{ startTime: '10:00', roles: [{ role: 'dealer', count: 2 }] }],
          },
          {
            date: '2025-05-02',
            isGrouped: true,
            timeSlots: [{ startTime: '10:00', roles: [{ role: 'dealer', count: 2 }] }],
          },
          {
            date: '2025-05-03',
            isGrouped: true,
            timeSlots: [{ startTime: '10:00', roles: [{ role: 'dealer', count: 2 }] }],
          },
        ],
      };

      expect(calculateTotalPositionsFromSchedule(schedule)).toBe(6);
    });

    it('non-grouped 3-day dealer x2 -> sum 6', () => {
      const schedule: PostingSchedule = {
        kind: 'dated',
        primaryDate: '2025-05-01',
        allDates: ['2025-05-01', '2025-05-02', '2025-05-03'],
        requirements: [
          {
            date: '2025-05-01',
            timeSlots: [{ startTime: '10:00', roles: [{ role: 'dealer', count: 2 }] }],
          },
          {
            date: '2025-05-02',
            timeSlots: [{ startTime: '10:00', roles: [{ role: 'dealer', count: 2 }] }],
          },
          {
            date: '2025-05-03',
            timeSlots: [{ startTime: '10:00', roles: [{ role: 'dealer', count: 2 }] }],
          },
        ],
      };

      expect(calculateTotalPositionsFromSchedule(schedule)).toBe(6);
    });

    it('mixed counts: d1,d2 dealer x2 + d3 dealer x3 -> 7', () => {
      const schedule: PostingSchedule = {
        kind: 'dated',
        primaryDate: '2025-05-01',
        allDates: ['2025-05-01', '2025-05-02', '2025-05-03'],
        requirements: [
          {
            date: '2025-05-01',
            timeSlots: [{ startTime: '10:00', roles: [{ role: 'dealer', count: 2 }] }],
          },
          {
            date: '2025-05-02',
            timeSlots: [{ startTime: '10:00', roles: [{ role: 'dealer', count: 2 }] }],
          },
          {
            date: '2025-05-03',
            timeSlots: [{ startTime: '10:00', roles: [{ role: 'dealer', count: 3 }] }],
          },
        ],
      };

      expect(calculateTotalPositionsFromSchedule(schedule)).toBe(7);
    });

    it('multi-role seat sum: (dealer2+floor1+serving1) x 2 days -> 8', () => {
      const schedule: PostingSchedule = {
        kind: 'dated',
        primaryDate: '2025-05-01',
        allDates: ['2025-05-01', '2025-05-02'],
        requirements: [
          {
            date: '2025-05-01',
            timeSlots: [
              {
                startTime: '10:00',
                roles: [
                  { role: 'dealer', count: 2 },
                  { role: 'floor', count: 1 },
                  { role: 'serving', count: 1 },
                ],
              },
            ],
          },
          {
            date: '2025-05-02',
            timeSlots: [
              {
                startTime: '10:00',
                roles: [
                  { role: 'dealer', count: 2 },
                  { role: 'floor', count: 1 },
                  { role: 'serving', count: 1 },
                ],
              },
            ],
          },
        ],
      };

      expect(calculateTotalPositionsFromSchedule(schedule)).toBe(8);
    });

    it('role=other with customRole "translator" keeps separate key from plain other', () => {
      const schedule: PostingSchedule = {
        kind: 'dated',
        primaryDate: '2025-05-01',
        allDates: ['2025-05-01', '2025-05-02'],
        requirements: [
          {
            date: '2025-05-01',
            timeSlots: [
              {
                startTime: '10:00',
                roles: [
                  { role: 'other', customRole: 'translator', count: 2 },
                  { role: 'other', customRole: 'security', count: 1 },
                ],
              },
            ],
          },
          {
            date: '2025-05-02',
            timeSlots: [
              {
                startTime: '10:00',
                roles: [
                  { role: 'other', customRole: 'translator', count: 3 },
                  { role: 'other', customRole: 'security', count: 1 },
                ],
              },
            ],
          },
        ],
      };

      // translator 2+3 + security 1+1 = 7
      expect(calculateTotalPositionsFromSchedule(schedule)).toBe(7);
    });

    it('role=other without customRole groups under a single key safely', () => {
      const schedule: PostingSchedule = {
        kind: 'dated',
        primaryDate: '2025-05-01',
        allDates: ['2025-05-01', '2025-05-02'],
        requirements: [
          {
            date: '2025-05-01',
            timeSlots: [
              {
                startTime: '10:00',
                roles: [{ role: 'other', count: 2 }],
              },
            ],
          },
          {
            date: '2025-05-02',
            timeSlots: [
              {
                startTime: '10:00',
                roles: [{ role: 'other', count: 3 }],
              },
            ],
          },
        ],
      };

      // other(무customRole) 2+3 = 5
      expect(calculateTotalPositionsFromSchedule(schedule)).toBe(5);
    });

    it('same role in two timeSlots within one date (dealer x2 morning + dealer x3 evening) -> 5', () => {
      const schedule: PostingSchedule = {
        kind: 'dated',
        primaryDate: '2025-05-01',
        allDates: ['2025-05-01'],
        requirements: [
          {
            date: '2025-05-01',
            timeSlots: [
              { startTime: '10:00', roles: [{ role: 'dealer', count: 2 }] },
              { startTime: '18:00', roles: [{ role: 'dealer', count: 3 }] },
            ],
          },
        ],
      };

      expect(calculateTotalPositionsFromSchedule(schedule)).toBe(5);
    });

    it('safely ignores slots with empty roles array', () => {
      const schedule: PostingSchedule = {
        kind: 'dated',
        primaryDate: '2025-05-01',
        allDates: ['2025-05-01'],
        requirements: [
          {
            date: '2025-05-01',
            timeSlots: [
              { startTime: '10:00', roles: [] },
              { startTime: '14:00', roles: [{ role: 'dealer', count: 2 }] },
            ],
          },
        ],
      };

      expect(calculateTotalPositionsFromSchedule(schedule)).toBe(2);
    });

    it('safely handles roles with count 0 and missing role field', () => {
      const schedule: PostingSchedule = {
        kind: 'dated',
        primaryDate: '2025-05-01',
        allDates: ['2025-05-01'],
        requirements: [
          {
            date: '2025-05-01',
            timeSlots: [
              {
                startTime: '10:00',
                roles: [
                  { role: 'dealer', count: 0 },
                  { role: 'floor', count: 1 },
                  // role 필드 없음: 안전하게 스킵
                  { count: 5 } as never,
                  // 빈 문자열 role: 안전하게 스킵
                  { role: '' as never, count: 7 },
                ],
              },
            ],
          },
        ],
      };

      // dealer=0, floor=1, 나머지는 스킵 → 합 1
      expect(calculateTotalPositionsFromSchedule(schedule)).toBe(1);
    });
  });
});
