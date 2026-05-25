import {
  calculateFilledPositionsFromSchedule,
  calculateTotalPositionsFromSchedule,
} from '@/domains/job-posting/stats';
import type { PostingSchedule } from '@/types/jobPosting';

// HANDOFF 알고리즘: 같은 사람이 여러 슬롯·날짜에 돌아가며 근무 가능하다고 가정하여
// 역할별 peak(여러 슬롯/날짜 중 최대 필요 인원)의 합으로 totalPositions를 산출한다.

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

    it('calculateFilledPositionsFromSchedule sums filled in fixed synthetic slot', () => {
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
                  { role: 'dealer', count: 3, filled: 2 },
                  { role: 'floor', count: 1, filled: 0 },
                ],
              },
            ],
          },
        ],
      };
      expect(calculateFilledPositionsFromSchedule(schedule)).toBe(2);
    });
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

    it('grouped 3-day dealer x2 every day -> max 2', () => {
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

      expect(calculateTotalPositionsFromSchedule(schedule)).toBe(2);
    });

    it('non-grouped 3-day dealer x2 -> max 2', () => {
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

      expect(calculateTotalPositionsFromSchedule(schedule)).toBe(2);
    });

    it('mixed counts across dates: d1,d2 dealer x2 + d3 dealer x3 -> 3', () => {
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

      expect(calculateTotalPositionsFromSchedule(schedule)).toBe(3);
    });

    it('multi-role peak sum: dealer x2 + floor x1 + serving x1 across 2 days -> 4', () => {
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

      expect(calculateTotalPositionsFromSchedule(schedule)).toBe(4);
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

      // translator max 3 + security max 1 = 4
      expect(calculateTotalPositionsFromSchedule(schedule)).toBe(4);
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

      // other(무customRole) 하나의 키로 묶여 max=3
      expect(calculateTotalPositionsFromSchedule(schedule)).toBe(3);
    });

    it('same role in two timeSlots within one date (dealer x2 morning + dealer x3 evening) -> 3', () => {
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

      expect(calculateTotalPositionsFromSchedule(schedule)).toBe(3);
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
