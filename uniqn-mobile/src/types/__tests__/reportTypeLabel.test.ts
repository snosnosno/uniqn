/**
 * getReportTypeLabel — 신고 유형 라벨(관리자 신고 목록·상세 제목)
 */
import { getReportTypeLabel } from '../report';

describe('getReportTypeLabel', () => {
  it('구인자가 채팅으로 신고한 inappropriate_behavior 도 한글 라벨 — 원문 키를 보이지 않는다(09-26 QA)', () => {
    expect(getReportTypeLabel('inappropriate_behavior', 'employer')).toBe('부적절한 행동');
  });

  it('신고자 쪽 맵을 먼저 본다', () => {
    expect(getReportTypeLabel('no_show', 'employer')).toBe('노쇼');
    expect(getReportTypeLabel('false_posting', 'employee')).toBe('허위 공고');
  });

  it('반대쪽 맵 키도 찾는다', () => {
    expect(getReportTypeLabel('tardiness', 'employee')).toBe('지각');
  });

  it('어느 맵에도 없으면 원문 그대로', () => {
    expect(getReportTypeLabel('unknown_type', 'employer')).toBe('unknown_type');
  });
});
