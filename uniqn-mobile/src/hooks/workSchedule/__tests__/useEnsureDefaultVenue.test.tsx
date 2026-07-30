/**
 * useEnsureDefaultVenue — 기본 운영처 자동 생성(P1-1) 훅 테스트
 *
 * 운영처 0개 워크스페이스 첫 진입 시 `{닉네임}의 지점` 으로 1회 자동 생성한다.
 * (1) 준비완료+빈 목록 → 정확히 1회 발사, (2) 비어있지 않으면 미발사, (3) 로딩 중 미발사,
 * (4) 리렌더에도 재발사 없음(실패 시 무한루프 가드), (5) 워크스페이스 전환 시 새로 1회,
 * (6) 닉네임을 모르면 폴백명으로 발사 — 예전엔 워크스페이스 이름을 복사해서 팀과 지점이
 *     둘 다 '내 팀' 이 됐다(S1에서 중단).
 */
import { renderHook } from '@testing-library/react-native';
import { useEnsureDefaultVenue } from '../useEnsureDefaultVenue';
import { useCreateVenueContainer } from '../useCreateVenueContainer';

jest.mock('../useCreateVenueContainer', () => ({ useCreateVenueContainer: jest.fn() }));

const mockUseCreate = useCreateVenueContainer as unknown as jest.Mock;

const mutate = jest.fn();

beforeEach(() => {
  mutate.mockReset();
  mockUseCreate.mockReturnValue({ mutate, isPending: false });
});

function run(initial: Parameters<typeof useEnsureDefaultVenue>[0]) {
  return renderHook(
    (props: Parameters<typeof useEnsureDefaultVenue>[0]) => useEnsureDefaultVenue(props),
    {
      initialProps: initial,
    }
  );
}

it('준비완료 + 운영처 0개 → `{닉네임}의 지점` 으로 정확히 1회 생성', () => {
  const { rerender } = run({
    workspaceId: 'ws-1',
    displayName: '김사장',
    isReady: true,
    isEmpty: true,
  });

  expect(mutate).toHaveBeenCalledTimes(1);
  expect(mutate.mock.calls[0][0]).toBe('김사장의 지점');

  // 리렌더(실패 후 재평가 포함)에도 같은 워크스페이스엔 재발사 없음 — 무한루프 가드
  rerender({ workspaceId: 'ws-1', displayName: '김사장', isReady: true, isEmpty: true });
  expect(mutate).toHaveBeenCalledTimes(1);
});

it('운영처가 이미 있으면 미발사', () => {
  run({ workspaceId: 'ws-1', displayName: '김사장', isReady: true, isEmpty: false });
  expect(mutate).not.toHaveBeenCalled();
});

it('컨테이너 조회가 아직 준비 전(로딩)이면 미발사', () => {
  run({ workspaceId: 'ws-1', displayName: '김사장', isReady: false, isEmpty: true });
  expect(mutate).not.toHaveBeenCalled();
});

it('workspaceId 없으면 미발사', () => {
  run({ workspaceId: undefined, displayName: '김사장', isReady: true, isEmpty: true });
  expect(mutate).not.toHaveBeenCalled();
});

it('닉네임을 모르면 폴백 지점명으로 발사한다(워크스페이스 이름을 복사하지 않는다)', () => {
  run({ workspaceId: 'ws-1', displayName: undefined, isReady: true, isEmpty: true });
  expect(mutate).toHaveBeenCalledTimes(1);
  expect(mutate.mock.calls[0][0]).toBe('내 지점');
});

it('워크스페이스 전환 시 새 워크스페이스에서 다시 1회 발사', () => {
  const { rerender } = run({
    workspaceId: 'ws-1',
    displayName: '김사장',
    isReady: true,
    isEmpty: true,
  });
  expect(mutate).toHaveBeenCalledTimes(1);

  rerender({ workspaceId: 'ws-2', displayName: '김사장', isReady: true, isEmpty: true });
  expect(mutate).toHaveBeenCalledTimes(2);
  expect(mutate.mock.calls[1][0]).toBe('김사장의 지점');
});
