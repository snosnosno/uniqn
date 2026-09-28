// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/components/ops/StaffAttendanceSheet.tsx
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
import type { OpsStaffWorkLogReason } from '@/core/types/ops';

export const REASON_NOTICE: Record<Exclude<OpsStaffWorkLogReason, 'ok'>, string> = {
  no_posting:
    '대회에 공고가 연결되어 있지 않아 근태를 기록할 수 없습니다. STAFF 탭 상단에서 공고를 먼저 연결해 주세요.',
  no_event_date:
    '대회 운영일이 지정되어 있지 않아 기록할 행을 특정할 수 없습니다. 대회 정보에서 운영일을 먼저 지정해 주세요.',
  not_linked:
    '이 스태프에게는 해당 날짜의 근무 기록이 없습니다. 수동으로 추가한 스태프는 공고 근무 기록과 연결되지 않습니다.',
  cancelled: '해당 날짜의 근무 기록이 취소되었거나 노쇼 처리되어 근태를 기록할 수 없습니다.',
  ambiguous:
    '같은 날짜에 근무 기록이 2건 이상이라 어느 기록에 남길지 자동으로 정할 수 없습니다. 근무 일정 화면에서 직접 기록해 주세요.',
  settled: '정산이 완료된 근무 기록이라 근태를 수정할 수 없습니다.',
};

export const NO_PERMISSION_NOTICE =
  '이 공고의 근무 기록을 수정할 권한이 없습니다. 대회 운영 권한과 공고 정산 권한은 별개입니다.';
