/**
 * UNIQN Mobile - 도메인 레이어 중앙 인덱스
 *
 * @description Phase 7 - 도메인 모듈 구조 완성
 * 모든 도메인 모듈을 중앙에서 export
 *
 * ## 도메인 구조
 *
 * ```
 * domains/
 * ├── job/              # 구인공고 도메인
 * │   └── index.ts      # 타입 + 향후 로직
 * ├── application/      # 지원서 도메인
 * │   └── index.ts      # 타입 + 향후 로직
 * ├── schedule/         # 스케줄 도메인
 * │   ├── index.ts
 * │   └── ScheduleMerger.ts  # Phase 5
 * ├── settlement/       # 정산 도메인
 * │   ├── index.ts
 * │   ├── SettlementCalculator.ts  # Phase 6
 * │   ├── TaxCalculator.ts         # Phase 6
 * │   └── SettlementCache.ts       # Phase 6
 * └── staff/            # 스태프 도메인
 *     └── index.ts      # 타입 + 향후 로직
 * ```
 *
 * ## 사용 예시
 *
 * ```typescript
 * // 개별 도메인 import
 * import { ScheduleMerger } from '@/domains/schedule';
 * import { SettlementCalculator } from '@/domains/settlement';
 *
 * // 전체 도메인 import
 * import { ScheduleMerger, SettlementCalculator } from '@/domains';
 *
 * // 타입만 import
 * import type { JobPosting, Application } from '@/domains';
 * ```
 */

// ============================================================================
// Job Domain (구인공고)
// ============================================================================

export * from './job';

// ============================================================================
// Application Domain (지원서)
// ============================================================================

export * from './application';

// ============================================================================
// Schedule Domain (스케줄) - Phase 5
// ============================================================================

export * from './schedule';

// ============================================================================
// Settlement Domain (정산) - Phase 6
// ============================================================================

export * from './settlement';

// ============================================================================
// Staff Domain (스태프)
// ============================================================================

export * from './staff';
