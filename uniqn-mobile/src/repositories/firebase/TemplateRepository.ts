/**
 * UNIQN Mobile - Firebase Template Repository
 *
 * @description Firebase Firestore 기반 Template Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. Firebase 쿼리 실행
 * 2. 템플릿 CRUD 작업 캡슐화
 * 3. 권한 검증 및 데이터 변환
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  increment,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { BusinessError, PermissionError, ERROR_CODES } from '@/errors';
import type { JobPostingTemplate, CreateTemplateInput } from '@/types';
import type { JobPostingDraft } from '@/types/jobPostingDraft';
import { extractTemplateData } from '@/types';
import { formDataToDraft } from '@/utils/job-posting/draftAdapter';
import { COLLECTIONS, FIELDS } from '@/constants';
import type { ITemplateRepository } from '../interfaces/ITemplateRepository';

// ============================================================================
// Firebase Template Repository
// ============================================================================

export class FirebaseTemplateRepository implements ITemplateRepository {
  /**
   * 사용자의 템플릿 목록 조회
   *
   * @param userId 사용자 ID
   * @returns 템플릿 목록 (최신순)
   */
  async getTemplates(userId: string): Promise<JobPostingTemplate[]> {
    logger.info('템플릿 목록 조회', { userId });

    const templatesRef = collection(getFirebaseDb(), COLLECTIONS.TEMPLATES);
    const q = query(
      templatesRef,
      where(FIELDS.TEMPLATE.createdBy, '==', userId),
      orderBy(FIELDS.TEMPLATE.createdAt, 'desc')
    );

    const snapshot = await getDocs(q);

    const templates = snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data(),
    })) as JobPostingTemplate[];

    logger.info('템플릿 목록 조회 완료', { userId, count: templates.length });

    return templates;
  }

  /**
   * 템플릿 저장
   *
   * @param input 템플릿 생성 입력
   * @param userId 사용자 ID
   * @returns 생성된 템플릿 ID
   */
  async saveTemplate(input: CreateTemplateInput, userId: string): Promise<string> {
    logger.info('템플릿 저장 시작', { userId, name: input.name });

    const templatesRef = collection(getFirebaseDb(), COLLECTIONS.TEMPLATES);
    const newDocRef = doc(templatesRef);

    // 날짜/일정 관련 필드 제외한 템플릿 데이터 추출
    const draft = input.draft ?? (input.formData ? formDataToDraft(input.formData) : undefined);

    if (!draft) {
      throw new BusinessError(ERROR_CODES.VALIDATION_REQUIRED, {
        userMessage: '템플릿 초안 정보가 필요합니다',
      });
    }

    const templateData = extractTemplateData(draft);

    // 디버깅: 저장될 데이터 확인
    logger.info('템플릿 데이터 확인', {
      location: templateData.location,
      detailedAddress: templateData.location?.detailedAddress,
      postingType: templateData.postingType,
      title: templateData.title,
    });

    // Firebase는 undefined 값을 허용하지 않으므로 조건부로 필드 추가
    const template: Record<string, unknown> = {
      name: input.name,
      createdBy: userId,
      createdAt: serverTimestamp(),
      templateData,
      usageCount: 0,
    };

    // description이 있을 때만 추가
    if (input.description) {
      template.description = input.description;
    }

    await setDoc(newDocRef, template);

    logger.info('템플릿 저장 완료', { templateId: newDocRef.id });

    return newDocRef.id;
  }

  /**
   * 템플릿 불러오기
   *
   * @description 사용 통계 업데이트 포함
   * @param templateId 템플릿 ID
   * @returns 템플릿 데이터
   */
  async loadTemplate(templateId: string): Promise<JobPostingTemplate> {
    logger.info('템플릿 불러오기', { templateId });

    const docRef = doc(getFirebaseDb(), COLLECTIONS.TEMPLATES, templateId);
    const docSnapshot = await getDoc(docRef);

    if (!docSnapshot.exists()) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '존재하지 않는 템플릿입니다',
      });
    }

    // 사용 통계 업데이트 (비동기, 에러 무시)
    updateDoc(docRef, {
      usageCount: increment(1),
      lastUsedAt: serverTimestamp(),
    }).catch((err) => {
      logger.warn('템플릿 사용 통계 업데이트 실패', { templateId, error: err });
    });

    const template: JobPostingTemplate = {
      id: docSnapshot.id,
      ...docSnapshot.data(),
    } as JobPostingTemplate;

    logger.info('템플릿 불러오기 완료', { templateId, name: template.name });

    return template;
  }

  /**
   * 템플릿 삭제
   *
   * @param templateId 템플릿 ID
   * @param userId 사용자 ID (권한 확인용)
   */
  async deleteTemplate(templateId: string, userId: string): Promise<void> {
    logger.info('템플릿 삭제 시작', { templateId, userId });

    const docRef = doc(getFirebaseDb(), COLLECTIONS.TEMPLATES, templateId);
    const docSnapshot = await getDoc(docRef);

    if (!docSnapshot.exists()) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '존재하지 않는 템플릿입니다',
      });
    }

    const template = docSnapshot.data() as Omit<JobPostingTemplate, 'id'>;

    // 본인 확인
    if (template.createdBy !== userId) {
      throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
        userMessage: '본인의 템플릿만 삭제할 수 있습니다',
      });
    }

    await deleteDoc(docRef);

    logger.info('템플릿 삭제 완료', { templateId });
  }

  /**
   * 템플릿 업데이트
   *
   * @param templateId 템플릿 ID
   * @param input 업데이트할 데이터
   * @param userId 사용자 ID (권한 확인용)
   */
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
    logger.info('템플릿 업데이트 시작', { templateId, userId });

    const docRef = doc(getFirebaseDb(), COLLECTIONS.TEMPLATES, templateId);
    const docSnapshot = await getDoc(docRef);

    if (!docSnapshot.exists()) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '존재하지 않는 템플릿입니다',
      });
    }

    const template = docSnapshot.data() as Omit<JobPostingTemplate, 'id'>;

    // 본인 확인
    if (template.createdBy !== userId) {
      throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
        userMessage: '본인의 템플릿만 수정할 수 있습니다',
      });
    }

    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) {
      updateData.name = input.name;
    }

    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    const draft = input.draft ?? (input.formData ? formDataToDraft(input.formData) : undefined);
    if (draft !== undefined) {
      updateData.templateData = extractTemplateData(draft);
    }

    await updateDoc(docRef, updateData);

    logger.info('템플릿 업데이트 완료', { templateId });
  }
}
