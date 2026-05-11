/**
 * UNIQN Mobile - Supabase User Repository
 *
 * @description Supabase PostgREST 기반 User Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. 사용자 프로필 조회/수정
 * 2. 회원탈퇴 요청/취소/상태 관리
 * 3. 개인정보 내보내기
 * 4. 계정 완전 삭제 (병렬 익명화 + 삭제)
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { toError, BusinessError, ERROR_CODES, isAppError } from '@/errors';
import { handleSupabaseError, toSnakeCase, toCamelCase } from '@/utils/supabase';
import { parseUserDocument } from '@/schemas';
import type {
  IUserRepository,
  DeletionRequest,
  UserDataExport,
  EmployerRegistrationInput,
} from '../interfaces';
import type { FirestoreUserProfile, MyDataEditableFields } from '@/types';

// ============================================================================
// Supabase Table Names
// ============================================================================

const TABLES = {
  USERS: 'users',
  APPLICATIONS: 'applications',
  WORK_LOGS: 'work_logs',
  NOTIFICATIONS: 'notifications',
  ORPHAN_ACCOUNTS: 'orphan_accounts',
  CONSENTS: 'consents',
} as const;
// PostgREST alias `identity:identity_data` — DB 컬럼은 identity_data 이지만
// 응답 필드명은 identity 로 받아 `FirestoreUserProfile.identity` 매핑 유지.
// 마이그레이션 20260507144735 에서 컬럼이 rename 됨 (PR #56).
const USER_COLUMNS =
  'id,birth_date,bubble_score,career,created_at,deletion_requested_at,deletion_scheduled_for,email,employer_agreements,employer_registered_at,experience_years,fcm_tokens,gender,identity:identity_data,identity_provider,identity_verified,identity_verified_at,is_active,is_orphan,marketing_agreed,name,nickname,note,phone,phone_verified,photo_url,photo_url_blurhash,privacy_agreed,profile_completed,region,role,social_provider,status,terms_agreed,updated_at' as const;

// ============================================================================
// Helpers
// ============================================================================

/**
 * snake_case DB 행을 camelCase UserProfile로 변환
 */
function toUserProfile(row: Record<string, unknown>): FirestoreUserProfile {
  const camel = toCamelCase<Record<string, unknown>>(row);

  // DB의 `id`를 앱의 `uid`로 매핑
  return {
    ...camel,
    uid: (row.id as string) ?? (camel.uid as string),
  } as unknown as FirestoreUserProfile;
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Supabase User Repository
 */
export class SupabaseUserRepository implements IUserRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getById(userId: string): Promise<FirestoreUserProfile | null> {
    try {
      logger.info('사용자 조회', { userId });

      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select(USER_COLUMNS)
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        handleSupabaseError(error, { operation: '사용자 조회', table: TABLES.USERS });
      }

      if (!data) {
        return null;
      }

      const profile = toUserProfile(data as Record<string, unknown>);
      const parsed = parseUserDocument(profile);
      if (!parsed) {
        logger.warn('사용자 문서 파싱 실패', { userId });
        return null;
      }

      return parsed;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('사용자 조회 실패', toError(error), { userId });
      handleSupabaseError(error, { operation: '사용자 조회', table: TABLES.USERS });
    }
  }

  async getByIdBatch(userIds: string[]): Promise<Map<string, FirestoreUserProfile>> {
    try {
      if (userIds.length === 0) {
        return new Map();
      }

      logger.info('사용자 배치 조회', { count: userIds.length });

      const uniqueIds = [...new Set(userIds)];

      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select(USER_COLUMNS)
        .in('id', uniqueIds);

      if (error) {
        handleSupabaseError(error, { operation: '사용자 배치 조회', table: TABLES.USERS });
      }

      const profileMap = new Map<string, FirestoreUserProfile>();

      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const profile = toUserProfile(row);
        const parsed = parseUserDocument(profile);
        if (!parsed) {
          logger.warn('사용자 문서 파싱 실패', { userId: row.id as string });
          continue;
        }
        profileMap.set(row.id as string, parsed);
      }

      logger.info('사용자 배치 조회 완료', {
        requested: userIds.length,
        found: profileMap.size,
      });

      return profileMap;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('사용자 배치 조회 실패', toError(error), { count: userIds.length });
      handleSupabaseError(error, { operation: '사용자 배치 조회', table: TABLES.USERS });
    }
  }

  async exists(userId: string): Promise<boolean> {
    try {
      const { count, error } = await supabase
        .from(TABLES.USERS)
        .select('id', { count: 'exact', head: true })
        .eq('id', userId);

      if (error) {
        handleSupabaseError(error, { operation: '사용자 존재 여부 확인', table: TABLES.USERS });
      }

      return (count ?? 0) > 0;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('사용자 존재 여부 확인 실패', toError(error), { userId });
      handleSupabaseError(error, { operation: '사용자 존재 여부 확인', table: TABLES.USERS });
    }
  }

  async getDeletionStatus(userId: string): Promise<DeletionRequest | null> {
    try {
      logger.info('탈퇴 상태 조회', { userId });

      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('id, deletion_requested_at, deletion_scheduled_for, status')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        handleSupabaseError(error, { operation: '탈퇴 상태 조회', table: TABLES.USERS });
      }

      if (!data) {
        return null;
      }

      const row = data as Record<string, unknown>;

      // 탈퇴 요청이 없는 경우
      if (!row.deletion_requested_at) {
        return null;
      }

      const status =
        row.status === 'deleted' ? 'completed' : row.status === 'active' ? 'cancelled' : 'pending';

      return {
        userId,
        reason: 'other', // DB에 reason 컬럼이 별도로 없으면 기본값
        requestedAt: new Date(row.deletion_requested_at as string),
        scheduledDeletionAt: new Date(row.deletion_scheduled_for as string),
        status,
      } satisfies DeletionRequest;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('탈퇴 상태 조회 실패', toError(error), { userId });
      handleSupabaseError(error, { operation: '탈퇴 상태 조회', table: TABLES.USERS });
    }
  }

  // ==========================================================================
  // 변경 (Write)
  // ==========================================================================

  async createOrMerge(userId: string, profile: Record<string, unknown>): Promise<void> {
    try {
      logger.info('사용자 문서 생성/병합', { userId, fields: Object.keys(profile) });

      const snakeData = toSnakeCase(profile);
      const { error } = await supabase.from(TABLES.USERS).upsert({ id: userId, ...snakeData });

      if (error) {
        handleSupabaseError(error, { operation: '사용자 문서 생성/병합', table: TABLES.USERS });
      }

      logger.info('사용자 문서 생성/병합 완료', { userId });
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('사용자 문서 생성/병합 실패', toError(error), { userId });
      handleSupabaseError(error, { operation: '사용자 문서 생성/병합', table: TABLES.USERS });
    }
  }

  async updateFields(userId: string, updates: Record<string, unknown>): Promise<void> {
    try {
      logger.info('사용자 필드 업데이트', { userId, fields: Object.keys(updates) });

      const snakeData = toSnakeCase(updates);
      const { error } = await supabase
        .from(TABLES.USERS)
        .update({ ...snakeData, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) {
        handleSupabaseError(error, { operation: '사용자 필드 업데이트', table: TABLES.USERS });
      }

      logger.info('사용자 필드 업데이트 완료', { userId });
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('사용자 필드 업데이트 실패', toError(error), { userId });
      handleSupabaseError(error, { operation: '사용자 필드 업데이트', table: TABLES.USERS });
    }
  }

  async updateProfile(userId: string, updates: Partial<MyDataEditableFields>): Promise<void> {
    try {
      logger.info('프로필 업데이트', { userId, fields: Object.keys(updates) });

      const snakeData = toSnakeCase(updates as Record<string, unknown>);
      const { error } = await supabase
        .from(TABLES.USERS)
        .update({ ...snakeData, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) {
        handleSupabaseError(error, { operation: '프로필 업데이트', table: TABLES.USERS });
      }

      logger.info('프로필 업데이트 완료', { userId });
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('프로필 업데이트 실패', toError(error), { userId });
      handleSupabaseError(error, { operation: '프로필 업데이트', table: TABLES.USERS });
    }
  }

  async requestDeletion(userId: string, request: Omit<DeletionRequest, 'userId'>): Promise<void> {
    try {
      logger.info('회원탈퇴 요청 저장', { userId, reason: request.reason });

      const { error } = await supabase
        .from(TABLES.USERS)
        .update({
          status: 'deactivated',
          deletion_requested_at: request.requestedAt.toISOString(),
          deletion_scheduled_for: request.scheduledDeletionAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        handleSupabaseError(error, { operation: '회원탈퇴 요청 저장', table: TABLES.USERS });
      }

      logger.info('회원탈퇴 요청 저장 완료', {
        userId,
        scheduledDeletionAt: request.scheduledDeletionAt.toISOString(),
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('회원탈퇴 요청 저장 실패', toError(error), { userId });
      handleSupabaseError(error, { operation: '회원탈퇴 요청 저장', table: TABLES.USERS });
    }
  }

  async cancelDeletion(userId: string): Promise<void> {
    try {
      logger.info('회원탈퇴 철회', { userId });

      // 1. 현재 사용자 상태 조회
      const { data, error: fetchError } = await supabase
        .from(TABLES.USERS)
        .select('id, status, deletion_requested_at, deletion_scheduled_for')
        .eq('id', userId)
        .maybeSingle();

      if (fetchError) {
        handleSupabaseError(fetchError, { operation: '회원탈퇴 철회 조회', table: TABLES.USERS });
      }

      if (!data) {
        throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
          userMessage: '사용자를 찾을 수 없습니다',
        });
      }

      const row = data as Record<string, unknown>;

      // 2. 탈퇴 요청이 없는 경우
      if (!row.deletion_requested_at) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '진행 중인 탈퇴 요청이 없습니다',
        });
      }

      // 3. 유예 기간 확인
      const scheduledDeletionAt = row.deletion_scheduled_for
        ? new Date(row.deletion_scheduled_for as string)
        : null;

      if (!scheduledDeletionAt || scheduledDeletionAt < new Date()) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '탈퇴 유예 기간이 만료되었습니다',
        });
      }

      // 4. 탈퇴 철회 (C9 — affected rows 검증)
      // pre-fetch와 update 사이 race: 다른 탭/관리자/자동잡이 row 상태를 바꾸면
      // update가 0건이어도 error 없이 성공으로 보이므로 .select()로 반환 검사.
      //
      // DB users.status 매핑:
      //   'deactivated' + deletion_requested_at NOT NULL → DeletionRequest.status='pending'
      //   'active'  → 'cancelled'  / 'deleted' → 'completed'
      // 따라서 철회 가능한 row 는 status='deactivated' AND deletion_requested_at NOT NULL.
      const { data: updatedRows, error: updateError } = await supabase
        .from(TABLES.USERS)
        .update({
          status: 'active',
          deletion_requested_at: null,
          deletion_scheduled_for: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .eq('status', 'deactivated') // race 가드: 우리가 본 그 상태일 때만 철회
        .not('deletion_requested_at', 'is', null)
        .select('id');

      if (updateError) {
        handleSupabaseError(updateError, { operation: '회원탈퇴 철회', table: TABLES.USERS });
      }

      if (!updatedRows || updatedRows.length === 0) {
        // race detected — 다른 곳에서 이미 처리됨
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '탈퇴 상태가 이미 변경되었습니다. 잠시 후 다시 시도해주세요.',
        });
      }

      logger.info('회원탈퇴 철회 완료', { userId, affected: updatedRows.length });
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('회원탈퇴 철회 실패', toError(error), { userId });
      handleSupabaseError(error, { operation: '회원탈퇴 철회', table: TABLES.USERS });
    }
  }

  // ==========================================================================
  // 특수 작업 (Transaction)
  // ==========================================================================

  async markAsOrphan(
    uid: string,
    reason: string,
    _phone?: string,
    platform?: string
  ): Promise<void> {
    try {
      const { error } = await supabase.from(TABLES.ORPHAN_ACCOUNTS).upsert({
        id: uid,
        reason,
        platform: platform ?? null,
        created_at: new Date().toISOString(),
      });

      if (error) {
        logger.error('고아 계정 마킹 실패 (Supabase)', toError(error), { uid, reason });
        return; // 마킹 실패는 throw하지 않음 (원래 동작 유지)
      }

      logger.warn('고아 계정 마킹 완료 (수동 정리 필요)', { uid, reason });
    } catch (error) {
      logger.error('고아 계정 마킹 실패', toError(error), { uid, reason });
      // 마킹 실패는 throw하지 않음
    }
  }

  async registerAsEmployer(
    userId: string,
    input: EmployerRegistrationInput
  ): Promise<FirestoreUserProfile> {
    try {
      // 1. 현재 프로필 조회
      const { data: userData, error: fetchError } = await supabase
        .from(TABLES.USERS)
        .select(USER_COLUMNS)
        .eq('id', userId)
        .maybeSingle();

      if (fetchError) {
        handleSupabaseError(fetchError, { operation: '구인자 등록 조회', table: TABLES.USERS });
      }

      if (!userData) {
        throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
          userMessage: '사용자 정보를 찾을 수 없습니다',
        });
      }

      const row = userData as Record<string, unknown>;
      const currentRole = row.role as string;

      // 2. 이미 구인자/관리자인 경우
      if (currentRole === 'employer' || currentRole === 'admin') {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '이미 구인자로 등록되어 있습니다',
        });
      }

      // 3. 전화번호 인증 확인
      if (!row.phone_verified) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '전화번호 인증을 먼저 완료해주세요',
        });
      }

      // 4. 서버사이드 RPC로 역할 변경 (역할 상승 공격 방지)
      const now = new Date().toISOString();
      const employerAgreements = {
        termsAgreedAt: now,
        termsVersion: input.termsVersion,
        liabilityWaiverAgreedAt: now,
        liabilityWaiverVersion: input.liabilityWaiverVersion,
      };

      const { error: rpcError } = await supabase.rpc('register_as_employer', {
        p_employer_agreements: employerAgreements,
      });

      if (rpcError) {
        handleSupabaseError(rpcError, { operation: '구인자 등록 RPC', table: TABLES.USERS });
      }

      // 5. 동의 기록 저장 (별도 테이블)
      const { error: consentError } = await supabase.from(TABLES.CONSENTS).upsert({
        user_id: userId,
        kind: 'employer_registration',
        agreed_at: now,
        terms_agreed: true,
        terms_version: input.termsVersion,
        liability_waiver_agreed: true,
        liability_waiver_version: input.liabilityWaiverVersion,
      });

      if (consentError) {
        logger.warn('동의 기록 저장 실패 (비치명적)', { userId, error: consentError.message });
      }

      // 6. 변경된 프로필 재조회
      const updatedProfile = await this.getById(userId);
      if (!updatedProfile) {
        throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
          userMessage: '프로필 조회 실패',
        });
      }
      return updatedProfile;
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '구인자 등록', table: TABLES.USERS });
    }
  }

  // ==========================================================================
  // 데이터 내보내기 / 삭제
  // ==========================================================================

  async getExportData(userId: string): Promise<UserDataExport> {
    try {
      logger.info('데이터 내보내기 조회', { userId });

      // 1. 프로필 조회
      const profile = await this.getById(userId);
      if (!profile) {
        throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
          userMessage: '사용자를 찾을 수 없습니다',
        });
      }

      // 2. 지원 내역 + 근무 기록 병렬 조회
      const [applicationsResult, workLogsResult] = await Promise.all([
        supabase
          .from(TABLES.APPLICATIONS)
          .select('id, job_posting_title, status, created_at')
          .eq('applicant_id', userId),
        supabase
          .from(TABLES.WORK_LOGS)
          .select('id, date, check_in_ts, check_out_ts')
          .eq('staff_id', userId),
      ]);

      if (applicationsResult.error) {
        handleSupabaseError(applicationsResult.error, {
          operation: '데이터 내보내기 - 지원 내역',
          table: TABLES.APPLICATIONS,
        });
      }

      if (workLogsResult.error) {
        handleSupabaseError(workLogsResult.error, {
          operation: '데이터 내보내기 - 근무 기록',
          table: TABLES.WORK_LOGS,
        });
      }

      const applications = ((applicationsResult.data ?? []) as Record<string, unknown>[]).map(
        (row) => ({
          id: row.id as string,
          jobPostingTitle: (row.job_posting_title as string) ?? '',
          status: row.status as string,
          createdAt: (row.created_at as string) ?? '',
        })
      );

      const workLogs = ((workLogsResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: row.id as string,
        date: (row.date as string) ?? '',
        checkInAt: (row.check_in_ts as string) ?? undefined,
        checkOutAt: (row.check_out_ts as string) ?? undefined,
      }));

      const exportData: UserDataExport = {
        profile,
        applications,
        workLogs,
        exportedAt: new Date().toISOString(),
      };

      logger.info('데이터 내보내기 조회 완료', {
        userId,
        applicationsCount: applications.length,
        workLogsCount: workLogs.length,
      });

      return exportData;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('데이터 내보내기 조회 실패', toError(error), { userId });
      handleSupabaseError(error, { operation: '데이터 내보내기 조회', table: TABLES.USERS });
    }
  }

  async permanentlyDeleteWithBatch(userId: string): Promise<void> {
    try {
      logger.info('계정 완전 삭제 (RPC)', { userId });

      // 서버사이드 원자적 트랜잭션으로 익명화 + 삭제 처리
      const { data: result, error: rpcError } = await supabase.rpc('permanently_delete_user', {
        p_user_id: userId,
      });

      if (rpcError) {
        handleSupabaseError(rpcError, { operation: '계정 완전 삭제 RPC', table: TABLES.USERS });
      }

      logger.info('계정 완전 삭제 완료 (RPC)', {
        userId,
        anonymizedApplications: result?.anonymizedApplications,
        anonymizedWorkLogs: result?.anonymizedWorkLogs,
        deletedNotifications: result?.deletedNotifications,
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('계정 완전 삭제 실패', toError(error), { userId });
      handleSupabaseError(error, { operation: '계정 완전 삭제', table: TABLES.USERS });
    }
  }
}
