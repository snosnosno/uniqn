/**
 * 접힘 요약 문자열 — "접힌 줄은 숨김이 아니라 읽기"(설계 §3-1)
 *
 * 🔑 요약은 **값 부분만** 담는다. `CollapsibleSection` 이 제목을 이미 그리므로 요약에까지
 *    제목을 넣으면 화면에 `출근 예정   출근 예정 미정` 처럼 두 번 나온다. 설계 §3-1 의
 *    `출근 예정 미정` / `역할 미지정` 은 **렌더된 줄 전체**를 가리킨 표현이다.
 */
import { buildRoleSummary } from '../workLogEditSummary';

describe('buildRoleSummary', () => {
  it('역할 이름을 보여준다', () => {
    expect(buildRoleSummary('dealer', null, null)).toBe('딜러');
  });

  it('색이 있으면 색 이름을 덧붙인다', () => {
    expect(buildRoleSummary('dealer', null, 'slot-teal')).toBe('딜러 · 청록');
  });

  it('기타 역할은 저장된 커스텀 이름을 함께 보여준다', () => {
    // 이 시트는 커스텀 이름을 **고칠 수 없다**(RPC 패치에 키가 없다). 그래서 최소한
    // 지금 무엇으로 저장돼 있는지는 읽히게 한다.
    expect(buildRoleSummary('other', '바리스타', null)).toBe('기타 · 바리스타');
  });

  it('이름 없는 기타는 역할 이름만 보여준다', () => {
    expect(buildRoleSummary('other', '  ', null)).toBe('기타');
  });

  it('퇴역 팔레트 색은 이름 대신 지난 팔레트라고 말한다', () => {
    expect(buildRoleSummary('floor', null, 'secondary-100')).toBe('플로어 · 지난 팔레트 색');
  });
});
