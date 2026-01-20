/**
 * 정산 캐시
 *
 * @description Phase 6 - 정산 계산기 통합
 * 정산 계산 결과를 캐싱하여 중복 계산 방지
 */

// ============================================================================
// Types
// ============================================================================

/**
 * 캐시된 정산 결과
 */
export interface CachedSettlement {
  hoursWorked: number;
  basePay: number;
  allowancePay: number;
  totalPay: number;
  taxAmount: number;
  afterTaxPay: number;
}

interface CacheEntry {
  breakdown: CachedSettlement;
  timestamp: number;
  inputHash: string;
}

// ============================================================================
// SettlementCache
// ============================================================================

/**
 * 정산 캐시
 *
 * @description
 * - TTL 기반 캐시 (기본 5분)
 * - inputHash를 통한 변경 감지
 * - 단일/공고별 무효화 지원
 */
export class SettlementCache {
  private static cache = new Map<string, CacheEntry>();
  private static readonly TTL = 5 * 60 * 1000; // 5분

  /**
   * 캐시 키 생성
   *
   * @param workLogId - WorkLog ID
   * @param overrides - 오버라이드 객체 (선택)
   * @returns 캐시 키
   */
  static generateKey(workLogId: string, overrides?: object): string {
    if (!overrides || Object.keys(overrides).length === 0) {
      return workLogId;
    }
    // 오버라이드가 있으면 해시 추가
    const hash = this.hashObject(overrides);
    return `${workLogId}_${hash}`;
  }

  /**
   * 캐시 조회
   *
   * @param workLogId - WorkLog ID
   * @returns 캐시된 정산 결과 또는 null
   */
  static get(workLogId: string): CachedSettlement | null {
    const entry = this.cache.get(workLogId);
    if (!entry) return null;

    // TTL 확인
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(workLogId);
      return null;
    }

    return entry.breakdown;
  }

  /**
   * 캐시 저장
   *
   * @param workLogId - WorkLog ID
   * @param breakdown - 정산 결과
   * @param inputHash - 입력값 해시 (변경 감지용)
   */
  static set(workLogId: string, breakdown: CachedSettlement, inputHash: string): void {
    this.cache.set(workLogId, {
      breakdown,
      timestamp: Date.now(),
      inputHash,
    });
  }

  /**
   * 단일 키 무효화
   *
   * @param workLogId - WorkLog ID
   */
  static invalidate(workLogId: string): void {
    this.cache.delete(workLogId);
  }

  /**
   * 공고별 캐시 무효화
   *
   * @description 특정 공고의 모든 WorkLog 캐시 삭제
   * @param jobPostingId - 공고 ID
   */
  static invalidateByJobPosting(jobPostingId: string): void {
    // 공고 ID가 포함된 모든 캐시 키 삭제
    // 참고: 현재 구현에서는 workLogId만 키로 사용하므로
    // 공고별 무효화는 별도 메타데이터 필요
    // 향후 확장을 위해 인터페이스만 정의
    for (const key of this.cache.keys()) {
      if (key.includes(jobPostingId)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 전체 캐시 무효화
   */
  static clear(): void {
    this.cache.clear();
  }

  /**
   * 캐시 만료 여부 확인
   *
   * @description inputHash가 다르면 stale로 판정
   * @param workLogId - WorkLog ID
   * @param inputHash - 현재 입력값 해시
   * @returns stale 여부
   */
  static isStale(workLogId: string, inputHash: string): boolean {
    const entry = this.cache.get(workLogId);
    if (!entry) return true;

    // TTL 확인
    if (Date.now() - entry.timestamp > this.TTL) {
      return true;
    }

    // inputHash 비교
    return entry.inputHash !== inputHash;
  }

  /**
   * 캐시 통계
   *
   * @returns 캐시 크기
   */
  static getStats(): { size: number; ttl: number } {
    return {
      size: this.cache.size,
      ttl: this.TTL,
    };
  }

  /**
   * 입력 해시 생성
   *
   * @description 입력값 변경 감지를 위한 간단한 해시
   * @param input - 해시할 입력 객체
   * @returns 해시 문자열
   */
  static createInputHash(input: object): string {
    return this.hashObject(input);
  }

  /**
   * 객체 해시 (내부용)
   */
  private static hashObject(obj: object): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 32bit integer로 변환
    }
    return Math.abs(hash).toString(36);
  }
}
