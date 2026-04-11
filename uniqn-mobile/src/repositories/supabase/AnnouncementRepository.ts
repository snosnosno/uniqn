/**
 * UNIQN Mobile - Supabase Announcement Repository
 *
 * @description Supabase PostgREST 기반 Announcement Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. 공지사항 CRUD 작업 캡슐화
 * 2. 상태 전이 (draft → published → archived)
 * 3. 역할 기반 대상 필터링
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { BusinessError, ERROR_CODES, toError, isAppError } from '@/errors';
import { handleSupabaseError, paginatedQuery } from '@/utils/supabase';
import type {
  Announcement,
  AnnouncementStatus,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from '@/types';
import type { UserRole } from '@/types/role';
import type {
  IAnnouncementRepository,
  FetchAnnouncementsOptions,
  FetchAnnouncementsResult,
  AnnouncementCountByStatus,
} from '../interfaces/IAnnouncementRepository';

// ============================================================================
// Constants
// ============================================================================

const TABLE = 'announcements';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['published'],
  published: ['archived'],
  archived: ['published'],
};

const TABLE_COLUMNS =
  'id,author_id,author_name,category,content,created_at,image_storage_path,image_url,images,is_pinned,priority,published_at,status,target_audience,title,updated_at,view_count' as const;

// ============================================================================
// Helpers
// ============================================================================

/**
 * snake_case DB 행을 Announcement로 변환
 */
function toAnnouncement(row: Record<string, unknown>): Announcement {
  return {
    id: row.id as string,
    title: row.title as string,
    content: row.content as string,
    category: row.category as Announcement['category'],
    status: row.status as AnnouncementStatus,
    priority: (row.priority as Announcement['priority']) ?? 0,
    isPinned: (row.is_pinned as boolean) ?? false,
    targetAudience: (row.target_audience as Announcement['targetAudience']) ?? { type: 'all' },
    authorId: row.author_id as string,
    authorName: row.author_name as string,
    viewCount: (row.view_count as number) ?? 0,
    publishedAt: row.published_at ? new Date(row.published_at as string) : undefined,
    createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    imageUrl: (row.image_url as string) ?? null,
    imageStoragePath: (row.image_storage_path as string) ?? null,
    images: (row.images as Announcement['images']) ?? [],
  };
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Supabase Announcement Repository
 */
export class SupabaseAnnouncementRepository implements IAnnouncementRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getById(announcementId: string): Promise<Announcement | null> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(TABLE_COLUMNS)
        .eq('id', announcementId)
        .maybeSingle();

      if (error) {
        handleSupabaseError(error, { operation: '공지사항 조회', table: TABLE });
      }

      return data ? toAnnouncement(data as Record<string, unknown>) : null;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('공지사항 조회 실패', toError(error), { announcementId });
      handleSupabaseError(error, { operation: '공지사항 조회', table: TABLE });
    }
  }

  async getPublished(
    userRole: UserRole | null,
    options: FetchAnnouncementsOptions = {}
  ): Promise<FetchAnnouncementsResult> {
    try {
      const { pageSize = 20, lastDoc } = options;

      // Supabase에서는 다중 정렬을 지원하므로 isPinned → priority → publishedAt 순
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase
        .from(TABLE)
        .select(TABLE_COLUMNS)
        .eq('status', 'published')
        .order('is_pinned', { ascending: false })
        .order('priority', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(pageSize + 1);

      if (lastDoc !== undefined && lastDoc !== null) {
        // 커서 기반 페이지네이션: published_at 기준
        query = supabase
          .from(TABLE)
          .select(TABLE_COLUMNS)
          .eq('status', 'published')
          .lt('published_at', lastDoc as string)
          .order('is_pinned', { ascending: false })
          .order('priority', { ascending: false })
          .order('published_at', { ascending: false })
          .limit(pageSize + 1);
      }

      const { data, error } = await query;

      if (error) {
        handleSupabaseError(error, { operation: '발행된 공지사항 조회', table: TABLE });
      }

      const rows = ((data ?? []) as Record<string, unknown>[]).map(toAnnouncement);

      // 역할 기반 필터링 (클라이언트 사이드)
      const filtered = rows.filter((announcement) => {
        const targetAudience = announcement.targetAudience ?? { type: 'all' };
        if (targetAudience.type === 'all') return true;
        if (targetAudience.type === 'roles' && targetAudience.roles && userRole) {
          return targetAudience.roles.includes(userRole);
        }
        return false;
      });

      const hasMore = filtered.length > pageSize;
      const items = hasMore ? filtered.slice(0, pageSize) : filtered;
      const lastItem = items.length > 0 ? items[items.length - 1] : null;

      logger.info('발행된 공지사항 조회 완료', {
        component: 'AnnouncementRepository',
        count: items.length,
        userRole,
      });

      return {
        announcements: items,
        lastDoc: lastItem?.publishedAt ?? null,
        hasMore,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('발행된 공지사항 조회 실패', toError(error), { userRole });
      handleSupabaseError(error, { operation: '발행된 공지사항 조회', table: TABLE });
    }
  }

  async getAll(options: FetchAnnouncementsOptions = {}): Promise<FetchAnnouncementsResult> {
    try {
      const { filters, pageSize = 20, lastDoc } = options;

      const result = await paginatedQuery<Record<string, unknown>>(TABLE, {
        orderBy: 'created_at',
        ascending: false,
        pageSize,
        cursor: lastDoc,
        filters: (q) => {
          if (filters?.status && filters.status !== 'all') {
            return q.eq('status', filters.status);
          }
          return q;
        },
      });

      const announcements = result.items.map(toAnnouncement);

      logger.info('전체 공지사항 조회 완료', {
        component: 'AnnouncementRepository',
        count: announcements.length,
        filters,
      });

      return {
        announcements,
        lastDoc: result.lastDoc,
        hasMore: result.hasMore,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('전체 공지사항 조회 실패', toError(error));
      handleSupabaseError(error, { operation: '전체 공지사항 조회', table: TABLE });
    }
  }

  async getCountByStatus(): Promise<AnnouncementCountByStatus> {
    try {
      const [draftResult, publishedResult, archivedResult] = await Promise.all([
        supabase.from(TABLE).select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from(TABLE).select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from(TABLE).select('id', { count: 'exact', head: true }).eq('status', 'archived'),
      ]);

      if (draftResult.error) {
        handleSupabaseError(draftResult.error, { operation: '공지사항 통계 조회', table: TABLE });
      }
      if (publishedResult.error) {
        handleSupabaseError(publishedResult.error, {
          operation: '공지사항 통계 조회',
          table: TABLE,
        });
      }
      if (archivedResult.error) {
        handleSupabaseError(archivedResult.error, {
          operation: '공지사항 통계 조회',
          table: TABLE,
        });
      }

      const draft = draftResult.count ?? 0;
      const published = publishedResult.count ?? 0;
      const archived = archivedResult.count ?? 0;

      return {
        draft,
        published,
        archived,
        total: draft + published + archived,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('공지사항 통계 조회 실패', toError(error));
      handleSupabaseError(error, { operation: '공지사항 통계 조회', table: TABLE });
    }
  }

  // ==========================================================================
  // 생성 (Create)
  // ==========================================================================

  async create(
    authorId: string,
    authorName: string,
    input: CreateAnnouncementInput
  ): Promise<string> {
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from(TABLE)
        .insert({
          title: input.title,
          content: input.content,
          category: input.category,
          status: 'draft' as AnnouncementStatus,
          priority: input.priority ?? 0,
          is_pinned: input.isPinned ?? false,
          target_audience: input.targetAudience,
          author_id: authorId,
          author_name: authorName,
          view_count: 0,
          image_url: input.imageUrl ?? null,
          image_storage_path: input.imageStoragePath ?? null,
          images: input.images ?? [],
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single();

      if (error) {
        handleSupabaseError(error, { operation: '공지사항 생성', table: TABLE });
      }

      const announcementId = (data as Record<string, unknown>).id as string;

      logger.info('공지사항 생성 완료', {
        component: 'AnnouncementRepository',
        announcementId,
        title: input.title,
        authorId,
      });

      return announcementId;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('공지사항 생성 실패', toError(error), { authorId });
      handleSupabaseError(error, { operation: '공지사항 생성', table: TABLE });
    }
  }

  // ==========================================================================
  // 수정 (Update)
  // ==========================================================================

  async update(announcementId: string, input: UpdateAnnouncementInput): Promise<void> {
    try {
      // 현재 상태 조회
      const { data: current, error: fetchError } = await supabase
        .from(TABLE)
        .select('status')
        .eq('id', announcementId)
        .maybeSingle();

      if (fetchError) {
        handleSupabaseError(fetchError, { operation: '공지사항 수정 전 조회', table: TABLE });
      }

      if (!current) {
        throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
          userMessage: '공지사항을 찾을 수 없습니다',
          metadata: { announcementId },
        });
      }

      const currentStatus = (current as Record<string, unknown>).status as string;
      if (currentStatus === 'archived') {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '보관된 공지사항은 수정할 수 없습니다',
          metadata: { announcementId, currentStatus },
        });
      }

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (input.title !== undefined) updates.title = input.title;
      if (input.content !== undefined) updates.content = input.content;
      if (input.category !== undefined) updates.category = input.category;
      if (input.priority !== undefined) updates.priority = input.priority;
      if (input.isPinned !== undefined) updates.is_pinned = input.isPinned;
      if (input.targetAudience !== undefined) updates.target_audience = input.targetAudience;
      if (input.imageUrl !== undefined) updates.image_url = input.imageUrl;
      if (input.imageStoragePath !== undefined) updates.image_storage_path = input.imageStoragePath;
      if (input.images !== undefined) updates.images = input.images;

      const { error } = await supabase.from(TABLE).update(updates).eq('id', announcementId);

      if (error) {
        handleSupabaseError(error, { operation: '공지사항 수정', table: TABLE });
      }

      logger.info('공지사항 수정 완료', {
        component: 'AnnouncementRepository',
        announcementId,
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('공지사항 수정 실패', toError(error), { announcementId });
      handleSupabaseError(error, { operation: '공지사항 수정', table: TABLE });
    }
  }

  async publish(announcementId: string): Promise<void> {
    try {
      // 현재 상태 조회 + 전이 검증
      const { data: current, error: fetchError } = await supabase
        .from(TABLE)
        .select('status')
        .eq('id', announcementId)
        .maybeSingle();

      if (fetchError) {
        handleSupabaseError(fetchError, { operation: '공지사항 발행 전 조회', table: TABLE });
      }

      if (!current) {
        throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
          userMessage: '공지사항을 찾을 수 없습니다',
          metadata: { announcementId },
        });
      }

      const currentStatus = (current as Record<string, unknown>).status as string;
      const allowed = ALLOWED_TRANSITIONS[currentStatus];

      if (!allowed?.includes('published')) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: `현재 상태(${currentStatus})에서는 발행할 수 없습니다`,
          metadata: { announcementId, currentStatus, targetStatus: 'published' },
        });
      }

      const now = new Date().toISOString();
      const { error } = await supabase
        .from(TABLE)
        .update({
          status: 'published' as AnnouncementStatus,
          published_at: now,
          updated_at: now,
        })
        .eq('id', announcementId);

      if (error) {
        handleSupabaseError(error, { operation: '공지사항 발행', table: TABLE });
      }

      logger.info('공지사항 발행 완료', {
        component: 'AnnouncementRepository',
        announcementId,
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('공지사항 발행 실패', toError(error), { announcementId });
      handleSupabaseError(error, { operation: '공지사항 발행', table: TABLE });
    }
  }

  async archive(announcementId: string): Promise<void> {
    try {
      // 현재 상태 조회 + 전이 검증
      const { data: current, error: fetchError } = await supabase
        .from(TABLE)
        .select('status')
        .eq('id', announcementId)
        .maybeSingle();

      if (fetchError) {
        handleSupabaseError(fetchError, { operation: '공지사항 보관 전 조회', table: TABLE });
      }

      if (!current) {
        throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
          userMessage: '공지사항을 찾을 수 없습니다',
          metadata: { announcementId },
        });
      }

      const currentStatus = (current as Record<string, unknown>).status as string;
      const allowed = ALLOWED_TRANSITIONS[currentStatus];

      if (!allowed?.includes('archived')) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: `현재 상태(${currentStatus})에서는 보관할 수 없습니다`,
          metadata: { announcementId, currentStatus, targetStatus: 'archived' },
        });
      }

      const { error } = await supabase
        .from(TABLE)
        .update({
          status: 'archived' as AnnouncementStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', announcementId);

      if (error) {
        handleSupabaseError(error, { operation: '공지사항 보관', table: TABLE });
      }

      logger.info('공지사항 보관 완료', {
        component: 'AnnouncementRepository',
        announcementId,
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('공지사항 보관 실패', toError(error), { announcementId });
      handleSupabaseError(error, { operation: '공지사항 보관', table: TABLE });
    }
  }

  async incrementViewCount(announcementId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('increment_announcement_view_count', {
        p_announcement_id: announcementId,
      });

      if (error) {
        // RPC 미존재 시 폴백
        const { data } = await supabase
          .from(TABLE)
          .select('view_count')
          .eq('id', announcementId)
          .single();

        if (data) {
          await supabase
            .from(TABLE)
            .update({
              view_count: (((data as Record<string, unknown>).view_count as number) ?? 0) + 1,
            })
            .eq('id', announcementId);
        }
      }
    } catch (error) {
      // 조회수 증가 실패는 치명적이지 않음
      logger.error('공지사항 조회수 증가 실패', toError(error), { announcementId });
    }
  }

  // ==========================================================================
  // 삭제 (Delete)
  // ==========================================================================

  async delete(announcementId: string): Promise<void> {
    try {
      // 존재 확인
      const { data: existing, error: fetchError } = await supabase
        .from(TABLE)
        .select('id')
        .eq('id', announcementId)
        .maybeSingle();

      if (fetchError) {
        handleSupabaseError(fetchError, { operation: '공지사항 삭제 전 조회', table: TABLE });
      }

      if (!existing) {
        throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
          userMessage: '공지사항을 찾을 수 없습니다',
          metadata: { announcementId },
        });
      }

      const { error } = await supabase.from(TABLE).delete().eq('id', announcementId);

      if (error) {
        handleSupabaseError(error, { operation: '공지사항 삭제', table: TABLE });
      }

      logger.info('공지사항 삭제 완료', {
        component: 'AnnouncementRepository',
        announcementId,
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('공지사항 삭제 실패', toError(error), { announcementId });
      handleSupabaseError(error, { operation: '공지사항 삭제', table: TABLE });
    }
  }
}
