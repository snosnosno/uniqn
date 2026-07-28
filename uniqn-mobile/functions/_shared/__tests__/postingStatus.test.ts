/**
 * functions/ ↔ src/ 브라우즈 상태 파리티 가드
 *
 * functions/ 는 tsconfig exclude + 별도 CF 번들이라 src 의 BROWSABLE_POSTING_STATUSES 를
 * import 할 수 없다. 값이 두 벌로 남는 건 구조상 불가피하지만, **드리프트는 불가피하지 않다** —
 * 이 테스트가 그 경계를 유일하게 지킨다. jest moduleNameMapper(`@/` → src) 덕에
 * 여기서만 양쪽을 동시에 불러올 수 있다.
 *
 * 이 테스트가 깨지면 둘 중 하나만 고치지 말고 **두 곳을 같이** 맞춰라.
 * (예: 새 상태를 브라우즈에 노출하면 목록 OG·상세 OG·앱 목록이 함께 바뀌어야 한다.)
 */

import { BROWSABLE_POSTING_STATUSES as EDGE, BROWSABLE_POSTING_STATUS_SET } from '../postingStatus';
import { BROWSABLE_POSTING_STATUSES as APP } from '@/domains/job-posting/constants';

describe('브라우즈 가능 공고 상태 — functions ↔ src 파리티', () => {
  it('엣지 함수 상수가 앱 원본과 정확히 같다(순서 포함)', () => {
    expect([...EDGE]).toEqual([...APP]);
  });

  it('Set 파생본이 배열 원본과 같은 원소를 가진다', () => {
    expect([...BROWSABLE_POSTING_STATUS_SET].sort()).toEqual([...EDGE].sort());
    expect(BROWSABLE_POSTING_STATUS_SET.size).toBe(EDGE.length);
  });

  it('브라우즈 대상이 아닌 상태는 포함되지 않는다', () => {
    for (const hidden of ['draft', 'pending', 'closed', 'cancelled', 'expired', 'container']) {
      expect(BROWSABLE_POSTING_STATUS_SET.has(hidden)).toBe(false);
    }
  });
});
