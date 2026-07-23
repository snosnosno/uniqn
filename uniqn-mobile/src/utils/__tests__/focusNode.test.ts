/**
 * focusIfPossible — DOM focus 가능 노드만 안전하게 포커스 (a11y C2)
 *
 * 웹(RN-web)에서 ref 는 DOM 노드라 focus() 가 있고, 네이티브/테스트 렌더러는 없다.
 * 호출부가 플랫폼 분기 없이 한 줄로 쓰도록 가드를 헬퍼에 내장한다.
 */
import { focusIfPossible } from '../focusNode';

describe('focusIfPossible', () => {
  it('focus 함수가 있는 노드면 focus() 를 호출하고 true 를 돌려준다', () => {
    const focus = jest.fn();
    expect(focusIfPossible({ focus })).toBe(true);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('null · focus 없는 노드는 아무것도 하지 않고 false — 네이티브에서 안전 no-op', () => {
    expect(focusIfPossible(null)).toBe(false);
    expect(focusIfPossible(undefined)).toBe(false);
    expect(focusIfPossible({})).toBe(false);
  });
});
