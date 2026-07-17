/**
 * A6 — 에러 코드 값 전역 유일성 가드
 *
 * ERROR_CODES(AppError)와 WORKSPACE_ERROR_CODES(workspace)는 같은 E6xxx 비즈니스
 * 대역을 공유한다. 서로 다른 도메인이 같은 값을 쓰면 에러 매칭·로깅·사용자 안내가
 * 뒤섞이므로, 모든 코드맵의 값을 모아 중복이 없음을 단언한다.
 */

import { ERROR_CODES } from '@/errors/AppError';
import { WORKSPACE_ERROR_CODES } from '@/errors/workspace';

describe('에러 코드 값 전역 유일성', () => {
  it('모든 코드맵을 합쳐도 중복 값이 없다', () => {
    const allCodes = [...Object.values(ERROR_CODES), ...Object.values(WORKSPACE_ERROR_CODES)];

    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const code of allCodes) {
      if (seen.has(code)) {
        duplicates.push(code);
      }
      seen.add(code);
    }

    expect(duplicates).toEqual([]);
  });
});
