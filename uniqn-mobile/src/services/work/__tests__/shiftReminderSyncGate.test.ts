/**
 * shouldSyncShiftReminders — 리마인더 동기화 게이트
 *
 * 이 게이트가 틀리면 두 방향 모두 조용히 망가진다. 어느 쪽도 에러를 내지 않고 알림만
 * 사라지거나 남으므로, 규칙을 여기서 못박는다.
 */
import { shouldSyncShiftReminders } from '../shiftReminderScheduler';

describe('shouldSyncShiftReminders', () => {
  // 🔴 sync 는 예약뿐 아니라 원장 정리도 한다. "비었으니 건너뛴다" 로 막으면 계획에서
  //    사라진 예약(취소·퇴근·종류 폐지)이 영영 취소되지 않는다.
  it('로드가 성공했으면 결과가 0건이어도 돌린다', () => {
    expect(shouldSyncShiftReminders({ isLoading: false })).toBe(true);
    expect(shouldSyncShiftReminders({ isLoading: false, error: null })).toBe(true);
  });

  // 🔴 로딩 중 목록은 실제 0건이 아니라 폴백 빈 배열이다. 그대로 넘기면 원장의 모든 키가
  //    "계획에서 사라진 것" 으로 판정돼 취소된다.
  it('로딩 중에는 돌리지 않는다', () => {
    expect(shouldSyncShiftReminders({ isLoading: true })).toBe(false);
  });

  // 🔴 에러면 취소만 남고 재예약이 없다 — 확정 근무 알림이 통째로 무음 소실된다.
  it('조회가 실패했으면 돌리지 않는다', () => {
    expect(shouldSyncShiftReminders({ isLoading: false, error: new Error('네트워크 실패') })).toBe(
      false
    );
  });

  it('로딩과 에러가 겹쳐도 돌리지 않는다', () => {
    expect(shouldSyncShiftReminders({ isLoading: true, error: new Error('x') })).toBe(false);
  });
});
