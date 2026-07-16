import { Alert } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';

type BeforeRemoveHandler = (e: {
  preventDefault: jest.Mock;
  data: { action: Record<string, unknown> };
}) => void;

const listeners: BeforeRemoveHandler[] = [];
const mockDispatch = jest.fn();
jest.mock('expo-router', () => ({
  useNavigation: () => ({
    addListener: (_: string, cb: BeforeRemoveHandler) => {
      listeners.push(cb);
      return () => listeners.splice(listeners.indexOf(cb), 1);
    },
    dispatch: (...args: unknown[]) => mockDispatch(...args),
  }),
}));

const fireBeforeRemove = () => {
  const e = { preventDefault: jest.fn(), data: { action: {} } };
  listeners.forEach((cb) => cb(e));
  return e;
};

describe('useUnsavedChangesGuard — 저장 직후 stale 리스너', () => {
  beforeEach(() => {
    listeners.length = 0;
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('dirty면 뒤로가기를 차단한다(기존 계약)', () => {
    renderHook(() => useUnsavedChangesGuard(true));
    const e = fireBeforeRemove();
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('markClean() 후 같은 틱 뒤로가기는 차단하지 않는다(저장 완료 시퀀스)', () => {
    const view = renderHook(() => useUnsavedChangesGuard(true));
    // setIsDirty(false)의 리렌더가 아직 반영되지 않은 창을 재현: rerender 없이 즉시 발화
    act(() => view.result.current.markClean());
    const e = fireBeforeRemove();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('markClean 후 다시 dirty가 되면 차단이 복원된다', () => {
    const view = renderHook(({ dirty }: { dirty: boolean }) => useUnsavedChangesGuard(dirty), {
      initialProps: { dirty: true },
    });
    act(() => view.result.current.markClean());
    view.rerender({ dirty: false });
    view.rerender({ dirty: true });
    const e = fireBeforeRemove();
    expect(e.preventDefault).toHaveBeenCalled();
  });
});
