/**
 * P1#9 회귀: 마지막 워크스페이스를 보관하면 앱 내 복원 경로가 사라지는 문제.
 *
 * 워크스페이스 0개(EmptyState) 화면에서 보관함 진입점을 노출할지 판정하는 순수 규칙.
 * - 활성 워크스페이스가 없고(= EmptyState 상태) 보관된 워크스페이스가 1개 이상이면 노출.
 * - 보관된 워크스페이스가 0개면 복원할 대상이 없으므로 숨긴다.
 * - 활성 워크스페이스가 있으면 기존 owner 전용 보관함 진입점을 쓰므로 이 진입점은 숨긴다.
 */

import { shouldShowArchivedRestoreEntry } from '@/utils/workspace/archivedEntry';

describe('shouldShowArchivedRestoreEntry', () => {
  it('활성 워크스페이스가 없고 보관된 워크스페이스가 있으면 복원 진입점을 노출한다', () => {
    expect(shouldShowArchivedRestoreEntry({ hasActiveWorkspace: false, archivedCount: 1 })).toBe(
      true
    );
  });

  it('활성 워크스페이스가 없고 보관된 워크스페이스도 없으면 노출하지 않는다', () => {
    expect(shouldShowArchivedRestoreEntry({ hasActiveWorkspace: false, archivedCount: 0 })).toBe(
      false
    );
  });

  it('활성 워크스페이스가 있으면 보관된 워크스페이스가 있어도 이 진입점은 노출하지 않는다', () => {
    expect(shouldShowArchivedRestoreEntry({ hasActiveWorkspace: true, archivedCount: 3 })).toBe(
      false
    );
  });
});
