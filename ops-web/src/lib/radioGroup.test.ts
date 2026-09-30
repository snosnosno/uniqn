import { describe, expect, it } from 'vitest';
import { nextRadioIndex, radioGroupKeyDown, radioTabIndex } from './radioGroup';

describe('nextRadioIndex — WAI-ARIA 라디오 그룹 화살표 이동', () => {
  it.each([
    ['ArrowRight', 0, 1],
    ['ArrowDown', 1, 2],
    ['ArrowLeft', 2, 1],
    ['ArrowUp', 1, 0],
  ])('%s: %i → %i', (key, current, expected) => {
    expect(nextRadioIndex(key, current, 3)).toBe(expected);
  });

  it('끝에서 다음은 처음으로, 처음에서 이전은 끝으로 돈다', () => {
    expect(nextRadioIndex('ArrowRight', 2, 3)).toBe(0);
    expect(nextRadioIndex('ArrowLeft', 0, 3)).toBe(2);
  });

  it('Home·End 는 처음·끝으로 간다', () => {
    expect(nextRadioIndex('Home', 2, 3)).toBe(0);
    expect(nextRadioIndex('End', 0, 3)).toBe(2);
  });

  it('선택된 값이 없으면(−1) 다음은 처음, 이전은 끝', () => {
    expect(nextRadioIndex('ArrowDown', -1, 3)).toBe(0);
    expect(nextRadioIndex('ArrowUp', -1, 3)).toBe(2);
  });

  it('다른 키·선택지 1개 이하·이미 그 자리면 움직이지 않는다(null)', () => {
    expect(nextRadioIndex('Enter', 0, 3)).toBeNull();
    expect(nextRadioIndex('KeyX', 0, 3)).toBeNull();
    expect(nextRadioIndex('ArrowRight', 0, 1)).toBeNull();
    expect(nextRadioIndex('ArrowRight', 0, 0)).toBeNull();
    expect(nextRadioIndex('Home', 0, 3)).toBeNull();
  });
});

describe('radioTabIndex — Tab 으로 들어오는 칸은 하나뿐', () => {
  it('선택된 칸만 0, 나머지는 −1', () => {
    expect([0, 1, 2].map((i) => radioTabIndex(i, 1))).toEqual([-1, 0, -1]);
  });

  it('선택이 없으면 첫 칸이 0', () => {
    expect([0, 1, 2].map((i) => radioTabIndex(i, -1))).toEqual([0, -1, -1]);
  });
});

describe('radioGroupKeyDown — 처리기', () => {
  /** DOM 없이 keydown 이벤트를 흉내 낸다(vitest 환경=node). */
  function fakeEvent(
    key: string,
    focusedIndex = -1,
    mods: Partial<Record<'altKey' | 'ctrlKey' | 'metaKey', boolean>> = {}
  ) {
    const radios = [0, 1, 2].map(() => ({
      focused: false,
      focus() {
        this.focused = true;
      },
    }));
    let prevented = false;
    const event = {
      key,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      ...mods,
      preventDefault: () => {
        prevented = true;
      },
      currentTarget: {
        querySelectorAll: () => radios,
        ownerDocument: { activeElement: focusedIndex >= 0 ? radios[focusedIndex] : null },
      },
    };
    return { event: event as never, radios, prevented: () => prevented };
  }
  const OPTIONS = ['a', 'b', 'c'] as const;

  it('기본(선택하며 이동): 다음 칸을 선택하고 포커스를 옮긴다', () => {
    const picked: string[] = [];
    const { event, radios, prevented } = fakeEvent('ArrowRight', 0);
    radioGroupKeyDown(OPTIONS, 'a', (v) => picked.push(v))(event);
    expect(picked).toEqual(['b']);
    expect(radios[1]?.focused).toBe(true);
    expect(prevented()).toBe(true);
  });

  it('selectOnMove=false(즉시 저장 그룹): 포커스만 옮기고 선택(서버 쓰기)은 하지 않는다', () => {
    const picked: string[] = [];
    const { event, radios } = fakeEvent('ArrowLeft', 0);
    radioGroupKeyDown(OPTIONS, 'a', (v) => picked.push(v), { selectOnMove: false })(event);
    expect(picked).toEqual([]);
    expect(radios[2]?.focused).toBe(true);
  });

  it('selectOnMove=false: 이동 기준은 선택값이 아니라 지금 포커스된 칸', () => {
    const { event, radios } = fakeEvent('ArrowRight', 1);
    radioGroupKeyDown(OPTIONS, 'a', () => undefined, { selectOnMove: false })(event);
    expect(radios[2]?.focused).toBe(true);
  });

  it('수정키 조합·선택 없음(null)', () => {
    const picked: string[] = [];
    const mod = fakeEvent('ArrowRight', 0, { altKey: true });
    radioGroupKeyDown(OPTIONS, 'a', (v) => picked.push(v))(mod.event);
    expect(picked).toEqual([]);
    expect(mod.prevented()).toBe(false);
    const none = fakeEvent('ArrowDown');
    radioGroupKeyDown(OPTIONS, null, (v) => picked.push(v))(none.event);
    expect(picked).toEqual(['a']);
  });
});
