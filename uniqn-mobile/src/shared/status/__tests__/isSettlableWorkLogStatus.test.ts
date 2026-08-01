/**
 * 정산 게이트 status 술어 — 서버 게이트의 UI 측 거울.
 *
 * 서버 `SettlementRepository.settleWorkLogWithTransaction` 이
 * `status ∈ {checked_out, completed}` 를 검사한다. 이 술어가 서버보다 넓으면
 * "누르면 항상 실패하는 버튼" 이 생기고, 좁으면 정산 가능한 근무가 잠긴다.
 * 정산 어포던스를 그리는 4개 지점(개별 카드·그룹 행·그룹 일괄·선택 모드)이 전부 이걸 거친다.
 */
import { isSettlableWorkLogStatus } from '../types';
import { STATUS } from '@/constants';

describe('isSettlableWorkLogStatus', () => {
  it.each([STATUS.WORK_LOG.CHECKED_OUT, STATUS.WORK_LOG.COMPLETED])(
    '서버가 허용하는 status 는 true (%s)',
    (status) => {
      expect(isSettlableWorkLogStatus(status)).toBe(true);
    }
  );

  it.each([
    STATUS.WORK_LOG.SCHEDULED,
    STATUS.WORK_LOG.CHECKED_IN,
    STATUS.WORK_LOG.CANCELLED,
    STATUS.WORK_LOG.NO_SHOW,
  ])('서버가 거부하는 status 는 false (%s)', (status) => {
    expect(isSettlableWorkLogStatus(status)).toBe(false);
  });

  it('값이 없는 레거시·목 데이터는 false — 서버도 거부하므로 정합', () => {
    expect(isSettlableWorkLogStatus(undefined)).toBe(false);
    expect(isSettlableWorkLogStatus(null)).toBe(false);
    expect(isSettlableWorkLogStatus('')).toBe(false);
  });

  it('예상 밖 문자열도 false — 화이트리스트 판정이라 fail-closed 다', () => {
    expect(isSettlableWorkLogStatus('checked_ou')).toBe(false);
    expect(isSettlableWorkLogStatus('COMPLETED')).toBe(false);
  });
});
