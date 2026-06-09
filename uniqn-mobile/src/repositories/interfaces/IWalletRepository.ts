/**
 * UNIQN Mobile - Wallet Repository Interface
 *
 * @description 결제 시스템 wallet 조회 + 적립/차감/환불 RPC 추상화
 * @version 2.0.0
 *
 * 이 인터페이스의 목적:
 * 1. DB 직접 의존 제거 → 테스트 용이성
 * 2. wallet 도메인 작업(조회 + 결제 RPC) 캡슐화 (wallet 도메인 SSOT)
 * 3. 향후 백엔드 교체 가능성 확보
 *
 * 적립(출석)/차감(공고 결제)/환불 RPC도 wallet 도메인 SSOT로 본 인터페이스가 소유.
 * (JobPostingRepository가 결제/환불 시 본 Repository를 orchestrate)
 *
 * @see docs/superpowers/specs/2026-04-26-monetization-design.md §3, §6.1
 */

import type {
  DiamondProduct,
  WalletSummary,
  ClaimAttendanceResponse,
  PostingCost,
  CreatePostingPaymentResult,
  RefundResult,
  CancelPostingResult,
  GetWalletLedgerResponse,
  WalletReason,
} from '@/types/wallet';

// ============================================================================
// Interface
// ============================================================================

/**
 * Wallet Repository 인터페이스 (read-only)
 *
 * 구현체:
 * - WalletRepository (프로덕션, Supabase)
 */
export interface IWalletRepository {
  /**
   * 현재 사용자(또는 지정 사용자)의 지갑 요약 조회.
   *
   * @param userId 미지정 시 RPC가 auth.uid() 사용. admin/service_role만 타인 조회 가능.
   * @returns heart/diamond 잔액 + lifetime 누적 + 만료 임박(7일) lot 목록.
   * @throws Supabase RPC 에러 그대로 throw — 호출자가 처리.
   */
  getSummary(userId?: string): Promise<WalletSummary>;

  /**
   * 활성 다이아 충전 상품 목록 (display_order 오름차순).
   *
   * @returns active=true 상품만, 시드 6종 기준.
   */
  listProducts(): Promise<DiamondProduct[]>;

  /**
   * 본인 일일 출석 체크 — 하트 1개 적립(90일 만료). KST 기준 일일 1회.
   *
   * @returns 성공 시 lot 정보, 이미 출석 시 success:false. 미인증 등은 throw.
   */
  claimDailyAttendance(): Promise<ClaimAttendanceResponse>;

  /**
   * 공고 유형별 비용 조회 — 표시용 단일소스. flag off 시 cost=0.
   *
   * @param postingType 공고 유형 (예: 'urgent', 'regular')
   * @param ownerId 공고 소유자 user_id
   */
  getPostingCost(postingType: string, ownerId: string): Promise<PostingCost>;

  /**
   * 공고 생성 + 서버 권위 비용 차감을 단일 트랜잭션으로 (결제 RPC).
   *
   * @param ownerId 비용 주체(워크스페이스 owner) user_id
   * @param payload snake_case job_postings payload (payload.id를 멱등키로 유지)
   * @param reason 차감 사유 (기본 consume_job_posting)
   * @throws Supabase RPC 에러 그대로 throw — 호출자가 INSUFFICIENT_BALANCE 매핑.
   */
  createJobPostingWithPayment(
    ownerId: string,
    payload: Record<string, unknown>,
    reason?: WalletReason
  ): Promise<CreatePostingPaymentResult>;

  /**
   * 공고 취소 환불 (24h 100% / 이후 50%). 환불은 항상 owner 지갑에 적립.
   *
   * @param postingId 취소된 공고 id
   * @param ownerId 비용 주체(owner) user_id — caller가 owner 또는 협업자여야 통과.
   * @throws Supabase transport 에러만 throw.
   */
  refundJobCancellation(postingId: string, ownerId: string): Promise<RefundResult>;

  /**
   * 공고 취소(status=cancelled) + 환불을 단일 트랜잭션 원자화 (M3).
   * 환불 실패 시 서버에서 RAISE → 취소까지 롤백(부분실패 swallow 제거).
   *
   * @param postingId 취소할 공고 id
   * @param ownerId 비용 주체(owner) user_id — caller가 owner 또는 협업자여야 통과.
   * @returns success(+optional refund) 또는 success:false+error. transport 에러만 throw.
   */
  cancelJobPostingWithRefund(postingId: string, ownerId: string): Promise<CancelPostingResult>;

  /**
   * 본인 지갑 거래내역(wallet_ledger) 페이지 조회 — 최신순. RLS가 본인 행만 노출.
   *
   * @param offset 시작 인덱스(기본 0)
   * @param limit 페이지 크기(기본 20)
   * @returns items + hasMore(다음 페이지 존재 여부, limit+1 prefetch 방식).
   */
  getWalletLedger(offset?: number, limit?: number): Promise<GetWalletLedgerResponse>;
}
