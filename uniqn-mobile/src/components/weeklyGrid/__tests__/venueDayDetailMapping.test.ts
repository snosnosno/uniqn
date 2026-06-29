import { mapVenueDaySlotToConfirmedStaff, buildVenueDayGroup } from '../venueDayDetailMapping';
import { getTodayString } from '@/utils/date';
import type { VenueDaySlot } from '@/repositories/weeklyGrid';

function makeSlot(overrides: Partial<VenueDaySlot> = {}): VenueDaySlot {
  return {
    workLogId: 'wl-1',
    staffId: 'staff-1',
    staffName: '홍길동',
    staffNickname: '길동',
    staffPhotoUrl: 'https://example.com/p.png',
    role: 'dealer',
    customRole: null,
    timeSlot: '18:00',
    status: 'scheduled',
    jobPostingId: 'jp-1',
    isContainer: true,
    color: null,
    notes: '메모',
    ...overrides,
  };
}

describe('venueDayDetailMapping', () => {
  describe('mapVenueDaySlotToConfirmedStaff', () => {
    it('슬롯을 ConfirmedStaff 로 투영하고 staffPhotoUrl→staffPhotoURL 케이싱을 맞춘다', () => {
      const result = mapVenueDaySlotToConfirmedStaff(makeSlot(), '2026-06-29');
      expect(result).toMatchObject({
        id: 'wl-1',
        staffId: 'staff-1',
        staffName: '홍길동',
        staffNickname: '길동',
        staffPhotoURL: 'https://example.com/p.png',
        role: 'dealer',
        date: '2026-06-29',
        status: 'scheduled',
        timeSlot: '18:00',
        notes: '메모',
      });
    });

    it('null 필드는 안전 기본값으로 흡수한다(이름 미상/staff/빈 staffId)', () => {
      const result = mapVenueDaySlotToConfirmedStaff(
        makeSlot({ staffName: null, staffNickname: null, role: null, staffId: null }),
        '2026-06-29'
      );
      expect(result.staffName).toBe('이름 미상');
      expect(result.role).toBe('staff');
      expect(result.staffId).toBe('');
    });

    it('이름이 없으면 닉네임으로 폴백한다', () => {
      const result = mapVenueDaySlotToConfirmedStaff(
        makeSlot({ staffName: null, staffNickname: '길동' }),
        '2026-06-29'
      );
      expect(result.staffName).toBe('길동');
    });

    it('비정상 status 는 scheduled 로 정규화한다', () => {
      const result = mapVenueDaySlotToConfirmedStaff(makeSlot({ status: 'garbage' }), '2026-06-29');
      expect(result.status).toBe('scheduled');
    });
  });

  describe('buildVenueDayGroup', () => {
    it('빈 배열이면 null 을 반환한다', () => {
      expect(buildVenueDayGroup([], '2026-06-29')).toBeNull();
    });

    it('상태별 통계를 집계한다', () => {
      const group = buildVenueDayGroup(
        [
          makeSlot({ workLogId: 'a', status: 'checked_in' }),
          makeSlot({ workLogId: 'b', status: 'completed' }),
          makeSlot({ workLogId: 'c', status: 'no_show' }),
          makeSlot({ workLogId: 'd', status: 'scheduled' }),
        ],
        '2026-06-29'
      );
      expect(group).not.toBeNull();
      expect(group!.stats).toEqual({ total: 4, checkedIn: 1, completed: 1, noShow: 1 });
      expect(group!.staff).toHaveLength(4);
    });

    it('오늘 날짜면 isToday=true, isPast=false', () => {
      const today = getTodayString();
      const group = buildVenueDayGroup([makeSlot()], today);
      expect(group!.isToday).toBe(true);
      expect(group!.isPast).toBe(false);
    });

    it('과거 날짜면 isPast=true', () => {
      const group = buildVenueDayGroup([makeSlot()], '2000-01-01');
      expect(group!.isPast).toBe(true);
      expect(group!.isToday).toBe(false);
    });
  });
});
