import { mapVenueDaySlotToConfirmedStaff, buildVenueDayGroup } from '../venueDayDetailMapping';
import { getTodayString } from '@/utils/date';
import type { VenueDaySlot } from '@/repositories/workSchedule';

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
    checkInTs: null,
    checkOutTs: null,
    payrollStatus: null,
    date: '2026-06-29',
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

    it('🔴 실적(checkInTs/checkOutTs)을 카드로 실어 나른다', () => {
      // 이게 빠지면 카드는 예정만, 시트는 실적을 보여줘 같은 행이 두 시각을 말한다.
      const result = mapVenueDaySlotToConfirmedStaff(
        makeSlot({
          checkInTs: '2026-06-29T09:05:00+09:00',
          checkOutTs: '2026-06-29T18:10:00+09:00',
        }),
        '2026-06-29'
      );
      expect(result.checkInTime).toBe('2026-06-29T09:05:00+09:00');
      expect(result.checkOutTime).toBe('2026-06-29T18:10:00+09:00');
    });

    it('실적이 없으면 undefined 다(빈 문자열·에폭으로 채우지 않는다)', () => {
      const result = mapVenueDaySlotToConfirmedStaff(makeSlot(), '2026-06-29');
      expect(result.checkInTime).toBeUndefined();
      expect(result.checkOutTime).toBeUndefined();
    });

    it('payrollStatus 를 그대로 싣고, 모르는 값은 undefined 로 흡수한다', () => {
      expect(
        mapVenueDaySlotToConfirmedStaff(makeSlot({ payrollStatus: 'completed' }), '2026-06-29')
          .payrollStatus
      ).toBe('completed');
      expect(
        mapVenueDaySlotToConfirmedStaff(makeSlot({ payrollStatus: 'garbage' }), '2026-06-29')
          .payrollStatus
      ).toBeUndefined();
      expect(
        mapVenueDaySlotToConfirmedStaff(makeSlot(), '2026-06-29').payrollStatus
      ).toBeUndefined();
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
      // `scheduled` 는 "아직 출근하지 않은" 의 판정축이다 — 화면이 `total - checkedIn` 뺄셈으로
      // 대신 세면 퇴근·노쇼까지 미출근으로 접힌다. 여기서 열거값으로 고정해 둔다.
      expect(group!.stats).toEqual({
        total: 4,
        scheduled: 1,
        checkedIn: 1,
        completed: 1,
        noShow: 1,
      });
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
