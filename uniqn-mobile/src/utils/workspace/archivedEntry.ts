/**
 * UNIQN Mobile - 워크스페이스 보관함 진입점 노출 규칙
 *
 * @description 워크스페이스 0개(EmptyState) 화면에서 보관함(복원) 진입점을 노출할지
 *              판정하는 순수 규칙. 마지막 워크스페이스를 보관하면 활성 워크스페이스가
 *              사라져 EmptyState 로 떨어지는데, 여기서 복원 경로가 없으면 앱 내에서
 *              워크스페이스를 되살릴 수 없는 dead-end 가 된다(P1#9).
 */

export interface ArchivedRestoreEntryInput {
  /** 현재 활성 워크스페이스 존재 여부 (없으면 EmptyState 상태) */
  hasActiveWorkspace: boolean;
  /** 내가 owner 인 보관된 워크스페이스 수 */
  archivedCount: number;
}

/**
 * EmptyState 에서 보관함 복원 진입점을 노출할지 결정한다.
 *
 * - 활성 워크스페이스가 있으면 기존 owner 전용 보관함 진입점을 쓰므로 여기서는 숨긴다.
 * - 활성 워크스페이스가 없을 때만, 복원 대상(보관된 워크스페이스 1개 이상)이 있으면 노출한다.
 */
export function shouldShowArchivedRestoreEntry(input: ArchivedRestoreEntryInput): boolean {
  return !input.hasActiveWorkspace && input.archivedCount > 0;
}
