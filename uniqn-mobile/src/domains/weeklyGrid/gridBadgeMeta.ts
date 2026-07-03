/**
 * gridBadgeMeta — 그리드 뱃지(부족/공고/배치) 표시 메타 SSOT.
 *
 * CalendarCell 그리드 모드의 압축 뱃지와 GridBadgeLegend 범례(P0-3)가 공유한다.
 * U1 a11y: 색상 단독 금지 → glyph(아이콘 대용 글리프)+count 병기 + a11y 라벨에 종류명+수치.
 * U3: 토큰 팔레트 리터럴 클래스만(동적 className 조립 금지 → dark: 유실 방지).
 *     라이트 모드는 text-{token}-500(어두운 텍스트)로 충분하나, 다크 surface 위 같은 hue의
 *     반투명 틴트 배경에서는 -500 텍스트 대비가 낮아 dark: 변형으로 밝은 -300 텍스트를 병행한다.
 */
import type { GridBadgeKind } from './gridSlotState';

export interface GridBadgeMeta {
  glyph: string;
  label: string;
  unit: string;
  tokenClass: string;
}

export const GRID_BADGE_META: Record<GridBadgeKind, GridBadgeMeta> = {
  shortage: {
    glyph: '!',
    label: '부족',
    unit: '명',
    tokenClass: 'bg-warning-500/20 text-warning-500 dark:text-warning-300',
  },
  job: {
    glyph: '+',
    label: '공고',
    unit: '건',
    tokenClass: 'bg-primary-500/25 text-primary-500 dark:text-primary-200',
  },
  batch: {
    glyph: '✓',
    label: '배치',
    unit: '명',
    tokenClass: 'bg-success-500/20 text-success-500 dark:text-success-300',
  },
};

/** 범례 표시 순서 — 셀 우선순위 압축(U2: 부족>공고>배치)과 동일. */
export const GRID_BADGE_ORDER: readonly GridBadgeKind[] = ['shortage', 'job', 'batch'];
