// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/components/ops/HistoryTab.tsx
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
import type { OpsEventType } from '@/core/types/ops';

export const EVENT_LABEL: Record<OpsEventType, string> = {
  tournament_created: '대회 생성',
  tournament_status_changed: '대회 상태 변경',
  registration_toggled: '등록 전환',
  player_registered: '참가자 등록',
  player_checked_in: '체크인',
  player_rebuy: '리바이',
  player_addon: '애드온',
  player_busted: '탈락',
  player_reentered: '재진입',
  player_moved: '좌석 이동',
  seat_freed: '좌석 비움',
  table_added: '테이블 추가',
  table_closed: '테이블 상태 변경',
  table_redraw: '리드로우',
  prize_assigned: '상금 배정',
  level_play: '레벨 시작',
  level_pause: '일시정지',
  level_set: '레벨 변경',
  prize_structure_set: '상금 구조 설정',
  player_bust_undone: '탈락 취소',
  prize_corrected: '상금 정정',
  // 1e 스태프 연동(S1 C3 보완 — enum 원문 노출 해소)
  posting_linked: '공고 연결',
  posting_unlinked: '공고 연결 해제',
  staff_imported: '스태프 일괄 가져오기',
  staff_added: '스태프 추가',
  staff_removed: '스태프 제외',
  table_staff_assigned: '테이블 딜러 배정',
  table_staff_unassigned: '테이블 딜러 배정 해제',
  // S1 신규(C4 지급 마킹 · C6 모니터 구성)
  monitor_config_set: 'TV 모니터 구성 변경',
  prize_paid: '상금 지급 완료',
  prize_paid_undone: '상금 지급 취소',
  // 결함① 칩 카운트 수동 입력
  player_chips_set: '칩 카운트 수정',
  // 결함② 노쇼 표시/취소 — Record<OpsEventType, …> 라 enum 값을 추가하면 여기도 강제된다
  //   (그게 이 Record 의 존재 이유다. 빠지면 감사 로그에 enum 원문이 노출된다).
  player_no_show: '노쇼 처리',
  player_no_show_undone: '노쇼 취소',
  // 결함③ 정정·오등록 제거·대회 보관
  player_updated: '참가자 정보 수정',
  player_deleted: '등록 취소(삭제)',
  tournament_archived: '대회 보관',
  tournament_archive_undone: '대회 복원',
};

export function summarizePayload(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      parts.push(`${key.replace(/_/g, ' ')} ${value}`);
    }
    if (parts.length >= 3) break;
  }
  return parts.join(' · ');
}
