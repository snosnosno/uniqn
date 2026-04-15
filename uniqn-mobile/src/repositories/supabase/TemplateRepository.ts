/**
 * UNIQN Mobile - Supabase Template Repository
 *
 * @description Supabase PostgREST 기반 Template Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. 템플릿 CRUD 작업
 * 2. 권한 검증 (사용자 스코프)
 * 3. 사용 통계 업데이트
 */

import * as Sentry from '@sentry/react-native';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { BusinessError, PermissionError, ERROR_CODES, isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { extractTemplateData } from '@/types/jobTemplate';
import { formDataToDraft } from '@/utils/job-posting/draftAdapter';
import type { JobPostingTemplate, CreateTemplateInput } from '@/types';
import type { JobPostingDraft } from '@/types/jobPostingDraft';
import type { ITemplateRepository } from '../interfaces/ITemplateRepository';

// ============================================================================
// Constants
// ============================================================================

const TABLES = {
  TEMPLATES: 'job_posting_templates',
} as const;
const TABLE_COLUMNS = 'id,created_at,name,template_data,updated_at,user_id' as const;

// ============================================================================
// Helpers
// ============================================================================

function rowToTemplate(row: Record<string, unknown>): JobPostingTemplate {
  return toCamelCase<JobPostingTemplate>(row);
}

// ============================================================================
// Repository Implementation
// ============================================================================

export class SupabaseTemplateRepository implements ITemplateRepository {
  async getTemplates(userId: string): Promise<JobPostingTemplate[]> {
    try {
      logger.info('템플릿 목록 조회', { userId });

      const { data, error } = await supabase
        .from(TABLES.TEMPLATES)
        .select(TABLE_COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        handleSupabaseError(error, { operation: '템플릿 목록 조회', table: TABLES.TEMPLATES });
      }

      const templates = ((data ?? []) as Record<string, unknown>[]).map(rowToTemplate);
      logger.info('템플릿 목록 조회 완료', { userId, count: templates.length });

      return templates;
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '템플릿 목록 조회', table: TABLES.TEMPLATES });
    }
  }

  async saveTemplate(input: CreateTemplateInput, userId: string): Promise<string> {
    try {
      logger.info('템플릿 저장 시작', { userId, name: input.name });

      const draft = input.draft ?? (input.formData ? formDataToDraft(input.formData) : undefined);

      if (!draft) {
        throw new BusinessError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '템플릿 초안 정보가 필요합니다',
        });
      }

      const templateData = extractTemplateData(draft);
      const now = new Date().toISOString();

      const insertData: Record<string, unknown> = {
        name: input.name,
        user_id: userId,
        created_at: now,
        template_data: templateData,
        usage_count: 0,
      };

      if (input.description) {
        insertData.description = input.description;
      }

      const { data, error } = await supabase
        .from(TABLES.TEMPLATES)
        .insert(insertData)
        .select('id')
        .single();

      if (error) {
        handleSupabaseError(error, { operation: '템플릿 저장', table: TABLES.TEMPLATES });
      }

      logger.info('템플릿 저장 완료', { templateId: data.id });
      return data.id as string;
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '템플릿 저장', table: TABLES.TEMPLATES });
    }
  }

  async loadTemplate(templateId: string): Promise<JobPostingTemplate> {
    try {
      logger.info('템플릿 불러오기', { templateId });

      const { data, error } = await supabase
        .from(TABLES.TEMPLATES)
        .select(TABLE_COLUMNS)
        .eq('id', templateId)
        .single();

      if (error) {
        handleSupabaseError(error, { operation: '템플릿 불러오기', table: TABLES.TEMPLATES });
      }

      // 사용 통계 업데이트 (비동기, 에러 무시)
      supabase
        .rpc('increment_template_usage', { p_template_id: templateId })
        .then(({ error: rpcError }) => {
          if (rpcError) {
            logger.warn('템플릿 사용 통계 업데이트 실패', { templateId, error: rpcError });
            Sentry.addBreadcrumb({
              category: 'swallow',
              level: 'warning',
              message: '템플릿 사용 통계 업데이트 실패 — 무시됨',
              data: { templateId, error: String(rpcError) },
            });
          }
        });

      const template = rowToTemplate(data as Record<string, unknown>);
      logger.info('템플릿 불러오기 완료', { templateId, name: template.name });

      return template;
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '템플릿 불러오기', table: TABLES.TEMPLATES });
    }
  }

  async deleteTemplate(templateId: string, userId: string): Promise<void> {
    try {
      logger.info('템플릿 삭제 시작', { templateId, userId });

      // 본인 확인 + 삭제를 한 번에 (affected rows 체크)
      const { data, error } = await supabase
        .from(TABLES.TEMPLATES)
        .delete()
        .eq('id', templateId)
        .eq('user_id', userId)
        .select('id');

      if (error) {
        handleSupabaseError(error, { operation: '템플릿 삭제', table: TABLES.TEMPLATES });
      }

      if (!data || data.length === 0) {
        // 템플릿이 없거나 본인 것이 아님 — 존재 여부를 확인
        const { data: existing } = await supabase
          .from(TABLES.TEMPLATES)
          .select('id, user_id')
          .eq('id', templateId)
          .maybeSingle();

        if (!existing) {
          throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
            userMessage: '존재하지 않는 템플릿입니다',
          });
        }

        throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
          userMessage: '본인의 템플릿만 삭제할 수 있습니다',
        });
      }

      logger.info('템플릿 삭제 완료', { templateId });
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '템플릿 삭제', table: TABLES.TEMPLATES });
    }
  }

  async updateTemplate(
    templateId: string,
    input: Partial<
      Pick<CreateTemplateInput, 'name' | 'description'> & {
        draft?: JobPostingDraft;
        formData?: CreateTemplateInput['formData'];
      }
    >,
    userId: string
  ): Promise<void> {
    try {
      logger.info('템플릿 업데이트 시작', { templateId, userId });

      const updateData: Record<string, unknown> = {};

      if (input.name !== undefined) {
        updateData.name = input.name;
      }

      if (input.description !== undefined) {
        updateData.description = input.description;
      }

      const draft = input.draft ?? (input.formData ? formDataToDraft(input.formData) : undefined);
      if (draft !== undefined) {
        updateData.template_data = extractTemplateData(draft);
      }

      // 본인 확인 + 업데이트
      const { data, error } = await supabase
        .from(TABLES.TEMPLATES)
        .update(updateData)
        .eq('id', templateId)
        .eq('user_id', userId)
        .select('id');

      if (error) {
        handleSupabaseError(error, { operation: '템플릿 업데이트', table: TABLES.TEMPLATES });
      }

      if (!data || data.length === 0) {
        const { data: existing } = await supabase
          .from(TABLES.TEMPLATES)
          .select('id, user_id')
          .eq('id', templateId)
          .maybeSingle();

        if (!existing) {
          throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
            userMessage: '존재하지 않는 템플릿입니다',
          });
        }

        throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
          userMessage: '본인의 템플릿만 수정할 수 있습니다',
        });
      }

      logger.info('템플릿 업데이트 완료', { templateId });
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '템플릿 업데이트', table: TABLES.TEMPLATES });
    }
  }
}
