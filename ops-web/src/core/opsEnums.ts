// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/types/supabase.ts
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
/** supabase 생성 타입 `Constants` 에서 ops enum 만 발췌 — 모양은 원본과 같다. */
export const Constants = {
  public: {
    Enums: {
      ops_event_type: ['tournament_created', 'tournament_status_changed', 'registration_toggled', 'player_registered', 'player_checked_in', 'player_rebuy', 'player_addon', 'player_busted', 'player_reentered', 'player_moved', 'seat_freed', 'table_added', 'table_closed', 'table_redraw', 'prize_assigned', 'level_play', 'level_pause', 'level_set', 'prize_structure_set', 'player_bust_undone', 'prize_corrected', 'posting_linked', 'posting_unlinked', 'staff_imported', 'staff_added', 'staff_removed', 'table_staff_assigned', 'table_staff_unassigned', 'monitor_config_set', 'prize_paid', 'prize_paid_undone', 'player_chips_set', 'player_no_show', 'player_no_show_undone', 'player_updated', 'player_deleted', 'tournament_archived', 'tournament_archive_undone'],
      ops_participant_status: ['registered', 'checked_in', 'active', 'busted', 'no_show'],
      ops_table_lock_type: ['none', 'locked', 'feature'],
      ops_table_status: ['open', 'closed', 'standby'],
      ops_tournament_status: ['upcoming', 'active', 'completed'],
    },
  },
} as const;
