/**
 * UNIQN Mobile - 공고 템플릿 서비스
 *
 * @description 공고 작성 템플릿 CRUD 서비스
 * @version 1.0.0
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
  Timestamp,
  query,
  where,
  orderBy,
  increment,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { mapFirebaseError } from '@/errors';
import type {
  JobPostingTemplate,
  CreateTemplateInput,
  JobPostingFormData,
} from '@/types';
import { extractTemplateData } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const COLLECTION_NAME = 'mobileJobPostingTemplates';

// ============================================================================
// Template Service
// ============================================================================

/**
 * 사용자의 템플릿 목록 조회
 *
 * @param userId 사용자 ID
 * @returns 템플릿 목록 (최신순)
 */
export async function getTemplates(userId: string): Promise<JobPostingTemplate[]> {
  try {
    logger.info('템플릿 목록 조회', { userId });

    const templatesRef = collection(getFirebaseDb(), COLLECTION_NAME);
    const q = query(
      templatesRef,
      where('createdBy', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);

    const templates = snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data(),
    })) as JobPostingTemplate[];

    logger.info('템플릿 목록 조회 완료', { userId, count: templates.length });

    return templates;
  } catch (error) {
    // 권한 에러는 빈 배열 반환 (사용자 경험 개선)
    const firebaseError = error as { code?: string };
    if (firebaseError.code === 'permission-denied') {
      logger.info('템플릿 조회 권한 없음 (새 사용자)', { userId });
      return [];
    }
    logger.error('템플릿 목록 조회 실패', error as Error, { userId });
    throw mapFirebaseError(error);
  }
}

/**
 * 템플릿 저장
 *
 * @param input 템플릿 생성 입력
 * @param userId 사용자 ID
 * @returns 생성된 템플릿 ID
 */
export async function saveTemplate(
  input: CreateTemplateInput,
  userId: string
): Promise<string> {
  try {
    logger.info('템플릿 저장 시작', { userId, name: input.name });

    const templatesRef = collection(getFirebaseDb(), COLLECTION_NAME);
    const newDocRef = doc(templatesRef);

    // 날짜/일정 관련 필드 제외한 템플릿 데이터 추출
    const templateData = extractTemplateData(input.formData);

    const template: Omit<JobPostingTemplate, 'id'> = {
      name: input.name,
      description: input.description,
      createdBy: userId,
      createdAt: serverTimestamp() as Timestamp,
      templateData,
      usageCount: 0,
    };

    await setDoc(newDocRef, template);

    logger.info('템플릿 저장 완료', { templateId: newDocRef.id });

    return newDocRef.id;
  } catch (error) {
    logger.error('템플릿 저장 실패', error as Error, { userId });
    throw mapFirebaseError(error);
  }
}

/**
 * 템플릿 불러오기
 *
 * @description 사용 통계 업데이트 포함
 * @param templateId 템플릿 ID
 * @returns 템플릿 데이터
 */
export async function loadTemplate(templateId: string): Promise<JobPostingTemplate> {
  try {
    logger.info('템플릿 불러오기', { templateId });

    const docRef = doc(getFirebaseDb(), COLLECTION_NAME, templateId);
    const docSnapshot = await getDoc(docRef);

    if (!docSnapshot.exists()) {
      throw new Error('존재하지 않는 템플릿입니다');
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
  } catch (error) {
    logger.error('템플릿 불러오기 실패', error as Error, { templateId });
    throw error instanceof Error ? error : mapFirebaseError(error);
  }
}

/**
 * 템플릿 삭제
 *
 * @param templateId 템플릿 ID
 * @param userId 사용자 ID (권한 확인용)
 */
export async function deleteTemplate(
  templateId: string,
  userId: string
): Promise<void> {
  try {
    logger.info('템플릿 삭제 시작', { templateId, userId });

    const docRef = doc(getFirebaseDb(), COLLECTION_NAME, templateId);
    const docSnapshot = await getDoc(docRef);

    if (!docSnapshot.exists()) {
      throw new Error('존재하지 않는 템플릿입니다');
    }

    const template = docSnapshot.data() as Omit<JobPostingTemplate, 'id'>;

    // 본인 확인
    if (template.createdBy !== userId) {
      throw new Error('본인의 템플릿만 삭제할 수 있습니다');
    }

    await deleteDoc(docRef);

    logger.info('템플릿 삭제 완료', { templateId });
  } catch (error) {
    logger.error('템플릿 삭제 실패', error as Error, { templateId });
    throw error instanceof Error ? error : mapFirebaseError(error);
  }
}

/**
 * 템플릿 업데이트
 *
 * @param templateId 템플릿 ID
 * @param input 업데이트할 데이터
 * @param userId 사용자 ID (권한 확인용)
 */
export async function updateTemplate(
  templateId: string,
  input: Partial<Pick<CreateTemplateInput, 'name' | 'description'> & { formData?: JobPostingFormData }>,
  userId: string
): Promise<void> {
  try {
    logger.info('템플릿 업데이트 시작', { templateId, userId });

    const docRef = doc(getFirebaseDb(), COLLECTION_NAME, templateId);
    const docSnapshot = await getDoc(docRef);

    if (!docSnapshot.exists()) {
      throw new Error('존재하지 않는 템플릿입니다');
    }

    const template = docSnapshot.data() as Omit<JobPostingTemplate, 'id'>;

    // 본인 확인
    if (template.createdBy !== userId) {
      throw new Error('본인의 템플릿만 수정할 수 있습니다');
    }

    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) {
      updateData.name = input.name;
    }

    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    if (input.formData !== undefined) {
      updateData.templateData = extractTemplateData(input.formData);
    }

    await updateDoc(docRef, updateData);

    logger.info('템플릿 업데이트 완료', { templateId });
  } catch (error) {
    logger.error('템플릿 업데이트 실패', error as Error, { templateId });
    throw error instanceof Error ? error : mapFirebaseError(error);
  }
}
