/**
 * useEnsureDefaultWorkspace — 기본 워크스페이스 자동 보장 훅 테스트
 *
 * 신규 employer(워크스페이스 0개)가 근무표/운영처 생성 경로에서 workspaceId undefined
 * 데드엔드에 빠지지 않도록, 조회가 "성공적으로 끝났고 0개"일 때만 1회 자동 생성한다.
 * (1) 준비완료+빈 목록 → 정확히 1회 발사, (2) 비어있지 않으면 미발사, (3) 준비 전(로딩/에러) 미발사,
 * (4) 리렌더에도 재발사 없음(create_workspace 는 멱등 아님 → 중복 생성 가드),
 * (5) 준비 false→true 전환 시 그 시점에 1회 발사.
 */
import { renderHook } from '@testing-library/react-native';
import { useEnsureDefaultWorkspace } from '../useEnsureDefaultWorkspace';
import { useCreateWorkspace } from '../useWorkspaces';

jest.mock('../useWorkspaces', () => ({ useCreateWorkspace: jest.fn() }));

const mockUseCreate = useCreateWorkspace as unknown as jest.Mock;

const mutate = jest.fn();

beforeEach(() => {
  mutate.mockReset();
  mockUseCreate.mockReturnValue({ mutate, isPending: false });
});

function run(initial: Parameters<typeof useEnsureDefaultWorkspace>[0]) {
  return renderHook(
    (props: Parameters<typeof useEnsureDefaultWorkspace>[0]) => useEnsureDefaultWorkspace(props),
    { initialProps: initial }
  );
}

it('준비완료 + 워크스페이스 0개 → 기본 이름으로 정확히 1회 생성', () => {
  const { rerender } = run({ isReady: true, isEmpty: true });

  expect(mutate).toHaveBeenCalledTimes(1);
  expect(mutate.mock.calls[0][0]).toBe('내 팀');

  // 리렌더(생성 실패 후 재평가 포함)에도 재발사 없음 — 무한루프/중복 생성 가드
  rerender({ isReady: true, isEmpty: true });
  expect(mutate).toHaveBeenCalledTimes(1);
});

it('워크스페이스가 이미 있으면 미발사', () => {
  run({ isReady: true, isEmpty: false });
  expect(mutate).not.toHaveBeenCalled();
});

it('조회가 아직 준비 전(로딩/에러)이면 미발사', () => {
  run({ isReady: false, isEmpty: true });
  expect(mutate).not.toHaveBeenCalled();
});

it('준비 false→true 전환 시 그 시점에 1회 발사', () => {
  const { rerender } = run({ isReady: false, isEmpty: true });
  expect(mutate).not.toHaveBeenCalled();

  rerender({ isReady: true, isEmpty: true });
  expect(mutate).toHaveBeenCalledTimes(1);
});

it('isCreating 은 mutation.isPending 을 그대로 반영', () => {
  mockUseCreate.mockReturnValue({ mutate, isPending: true });
  const { result } = run({ isReady: true, isEmpty: false });
  expect(result.current.isCreating).toBe(true);
});

it('retry() 는 자동 발사 없이도 기본 이름으로 재생성을 트리거', () => {
  // 자동 발사 조건 아님(isEmpty=false) → 자동 mutate 없음. 수동 retry 만 발사.
  const { result } = run({ isReady: true, isEmpty: false });
  expect(mutate).not.toHaveBeenCalled();

  result.current.retry();
  expect(mutate).toHaveBeenCalledTimes(1);
  expect(mutate.mock.calls[0][0]).toBe('내 팀');
});
