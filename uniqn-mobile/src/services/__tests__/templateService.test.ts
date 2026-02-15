/**
 * UNIQN Mobile - TemplateService Tests
 *
 * @description templateService 단위 테스트
 * @version 1.0.0
 */

import {
  getTemplates,
  saveTemplate,
  loadTemplate,
  deleteTemplate,
  updateTemplate,
} from '../templateService';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@/lib/firebase');

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/errors', () => ({
  ...jest.requireActual('@/errors'),
  isAppError: jest.fn(),
  normalizeError: jest.fn((err: unknown) => {
    if (err instanceof Error) return err;
    return new Error(String(err));
  }),
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) => {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }),
}));

jest.mock('@/types', () => ({
  extractTemplateData: jest.fn((formData: Record<string, unknown>) => ({
    title: formData.title || '',
    location: formData.location || '',
    detailedAddress: formData.detailedAddress || '',
    postingType: formData.postingType || 'general',
  })),
}));

// ============================================================================
// Import mocked modules
// ============================================================================

import { getDocs, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { isAppError, AppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';

const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
const mockSetDoc = setDoc as jest.MockedFunction<typeof setDoc>;
const mockDeleteDoc = deleteDoc as jest.MockedFunction<typeof deleteDoc>;
const mockUpdateDoc = updateDoc as jest.MockedFunction<typeof updateDoc>;
const mockIsAppError = isAppError as jest.MockedFunction<typeof isAppError>;
const mockHandleServiceError = handleServiceError as jest.MockedFunction<typeof handleServiceError>;

// ============================================================================
// Tests
// ============================================================================

describe('templateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAppError.mockReturnValue(false);
  });

  // --------------------------------------------------------------------------
  // getTemplates
  // --------------------------------------------------------------------------

  describe('getTemplates', () => {
    it('사용자의 템플릿 목록을 조회해야 한다', async () => {
      const mockTemplates = [
        { id: 'tmpl-1', name: '템플릿1', createdBy: 'user-1' },
        { id: 'tmpl-2', name: '템플릿2', createdBy: 'user-1' },
      ];

      mockGetDocs.mockResolvedValue({
        docs: mockTemplates.map((t) => ({
          id: t.id,
          data: () => ({ name: t.name, createdBy: t.createdBy }),
        })),
      } as never);

      const result = await getTemplates('user-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'tmpl-1', name: '템플릿1' });
    });

    it('템플릿이 없으면 빈 배열을 반환해야 한다', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [],
      } as never);

      const result = await getTemplates('user-1');

      expect(result).toEqual([]);
    });

    it('권한 에러 시 빈 배열을 반환해야 한다', async () => {
      const permissionError = new Error('permission denied') as Error & { code?: string };
      permissionError.code = 'permission-denied';
      mockGetDocs.mockRejectedValue(permissionError);

      const result = await getTemplates('new-user');

      expect(result).toEqual([]);
    });

    it('기타 에러 시 handleServiceError를 호출해야 한다', async () => {
      const genericError = new Error('Unknown error');
      mockGetDocs.mockRejectedValue(genericError);
      mockHandleServiceError.mockReturnValue(genericError as unknown as AppError);

      await expect(getTemplates('user-1')).rejects.toThrow('Unknown error');
      expect(mockHandleServiceError).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // saveTemplate
  // --------------------------------------------------------------------------

  describe('saveTemplate', () => {
    const mockInput = {
      name: '새 템플릿',
      description: '설명',
      formData: {
        title: '공고 제목',
        location: '서울',
      },
    };

    it('템플릿을 저장하고 ID를 반환해야 한다', async () => {
      mockSetDoc.mockResolvedValue(undefined as never);

      const result = await saveTemplate(mockInput as never, 'user-1');

      expect(typeof result).toBe('string');
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('description이 없어도 저장해야 한다', async () => {
      mockSetDoc.mockResolvedValue(undefined as never);

      const inputWithoutDesc = {
        name: '새 템플릿',
        formData: { title: '공고 제목' },
      };

      const result = await saveTemplate(inputWithoutDesc as never, 'user-1');

      expect(typeof result).toBe('string');
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('description이 있으면 저장 데이터에 포함되어야 한다', async () => {
      mockSetDoc.mockResolvedValue(undefined as never);

      await saveTemplate(mockInput as never, 'user-1');

      const savedData = mockSetDoc.mock.calls[0][1] as Record<string, unknown>;
      expect(savedData.description).toBe('설명');
    });

    it('Firestore 에러 시 handleServiceError를 호출해야 한다', async () => {
      const error = new Error('저장 실패');
      mockSetDoc.mockRejectedValue(error);
      mockHandleServiceError.mockReturnValue(error as unknown as AppError);

      await expect(saveTemplate(mockInput as never, 'user-1')).rejects.toThrow('저장 실패');
      expect(mockHandleServiceError).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // loadTemplate
  // --------------------------------------------------------------------------

  describe('loadTemplate', () => {
    const mockTemplateData = {
      name: '테스트 템플릿',
      createdBy: 'user-1',
      templateData: { title: '공고' },
      usageCount: 3,
    };

    it('템플릿을 불러오고 사용 통계를 업데이트해야 한다', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'tmpl-1',
        data: () => mockTemplateData,
      } as never);
      mockUpdateDoc.mockResolvedValue(undefined as never);

      const result = await loadTemplate('tmpl-1');

      expect(result).toMatchObject({
        id: 'tmpl-1',
        name: '테스트 템플릿',
      });
      // updateDoc is called asynchronously for usage stats
      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('존재하지 않는 템플릿이면 BusinessError를 던져야 한다', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        id: 'non-existent',
        data: () => undefined,
      } as never);

      await expect(loadTemplate('non-existent')).rejects.toThrow();
    });

    it('사용 통계 업데이트 실패 시에도 템플릿은 반환되어야 한다', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'tmpl-1',
        data: () => mockTemplateData,
      } as never);
      mockUpdateDoc.mockRejectedValue(new Error('통계 업데이트 실패'));

      const result = await loadTemplate('tmpl-1');

      // Should still return the template despite stats update failure
      expect(result).toMatchObject({
        id: 'tmpl-1',
        name: '테스트 템플릿',
      });
    });

    it('AppError는 그대로 다시 던져야 한다', async () => {
      const appError = new Error('앱 에러');
      mockGetDoc.mockRejectedValue(appError);
      mockIsAppError.mockReturnValue(true);

      await expect(loadTemplate('tmpl-1')).rejects.toThrow('앱 에러');
    });

    it('비 AppError는 handleServiceError를 호출해야 한다', async () => {
      const genericError = new Error('일반 에러');
      mockGetDoc.mockRejectedValue(genericError);
      mockIsAppError.mockReturnValue(false);
      mockHandleServiceError.mockReturnValue(genericError as unknown as AppError);

      await expect(loadTemplate('tmpl-1')).rejects.toThrow('일반 에러');
      expect(mockHandleServiceError).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // deleteTemplate
  // --------------------------------------------------------------------------

  describe('deleteTemplate', () => {
    it('본인의 템플릿을 삭제해야 한다', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'tmpl-1',
        data: () => ({ createdBy: 'user-1', name: '템플릿' }),
      } as never);
      mockDeleteDoc.mockResolvedValue(undefined as never);

      await deleteTemplate('tmpl-1', 'user-1');

      expect(mockDeleteDoc).toHaveBeenCalled();
    });

    it('존재하지 않는 템플릿이면 BusinessError를 던져야 한다', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        id: 'non-existent',
        data: () => undefined,
      } as never);

      await expect(deleteTemplate('non-existent', 'user-1')).rejects.toThrow();
    });

    it('다른 사용자의 템플릿이면 PermissionError를 던져야 한다', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'tmpl-1',
        data: () => ({ createdBy: 'other-user', name: '템플릿' }),
      } as never);

      mockIsAppError.mockReturnValue(true);

      await expect(deleteTemplate('tmpl-1', 'user-1')).rejects.toThrow();
    });

    it('AppError는 그대로 다시 던져야 한다', async () => {
      const appError = new Error('앱 에러');
      mockGetDoc.mockRejectedValue(appError);
      mockIsAppError.mockReturnValue(true);

      await expect(deleteTemplate('tmpl-1', 'user-1')).rejects.toThrow('앱 에러');
    });

    it('비 AppError는 handleServiceError를 호출해야 한다', async () => {
      const genericError = new Error('일반 에러');
      mockGetDoc.mockRejectedValue(genericError);
      mockIsAppError.mockReturnValue(false);
      mockHandleServiceError.mockReturnValue(genericError as unknown as AppError);

      await expect(deleteTemplate('tmpl-1', 'user-1')).rejects.toThrow('일반 에러');
      expect(mockHandleServiceError).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // updateTemplate
  // --------------------------------------------------------------------------

  describe('updateTemplate', () => {
    it('본인의 템플릿 이름을 수정해야 한다', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'tmpl-1',
        data: () => ({ createdBy: 'user-1', name: '기존 템플릿' }),
      } as never);
      mockUpdateDoc.mockResolvedValue(undefined as never);

      await updateTemplate('tmpl-1', { name: '수정된 템플릿' }, 'user-1');

      expect(mockUpdateDoc).toHaveBeenCalled();
      const updateData = mockUpdateDoc.mock.calls[0][1] as unknown as Record<string, unknown>;
      expect(updateData.name).toBe('수정된 템플릿');
    });

    it('description을 수정할 수 있어야 한다', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'tmpl-1',
        data: () => ({ createdBy: 'user-1', name: '템플릿' }),
      } as never);
      mockUpdateDoc.mockResolvedValue(undefined as never);

      await updateTemplate('tmpl-1', { description: '새 설명' }, 'user-1');

      expect(mockUpdateDoc).toHaveBeenCalled();
      const updateData = mockUpdateDoc.mock.calls[0][1] as unknown as Record<string, unknown>;
      expect(updateData.description).toBe('새 설명');
    });

    it('formData를 수정하면 extractTemplateData가 호출되어야 한다', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'tmpl-1',
        data: () => ({ createdBy: 'user-1', name: '템플릿' }),
      } as never);
      mockUpdateDoc.mockResolvedValue(undefined as never);

      await updateTemplate('tmpl-1', { formData: { title: '새 제목' } as never }, 'user-1');

      expect(mockUpdateDoc).toHaveBeenCalled();
      const updateData = mockUpdateDoc.mock.calls[0][1] as unknown as Record<string, unknown>;
      expect(updateData.templateData).toBeDefined();
    });

    it('존재하지 않는 템플릿이면 BusinessError를 던져야 한다', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        id: 'non-existent',
        data: () => undefined,
      } as never);

      await expect(updateTemplate('non-existent', { name: '수정' }, 'user-1')).rejects.toThrow();
    });

    it('다른 사용자의 템플릿이면 PermissionError를 던져야 한다', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'tmpl-1',
        data: () => ({ createdBy: 'other-user', name: '템플릿' }),
      } as never);

      mockIsAppError.mockReturnValue(true);

      await expect(updateTemplate('tmpl-1', { name: '수정' }, 'user-1')).rejects.toThrow();
    });

    it('AppError는 그대로 다시 던져야 한다', async () => {
      const appError = new Error('앱 에러');
      mockGetDoc.mockRejectedValue(appError);
      mockIsAppError.mockReturnValue(true);

      await expect(updateTemplate('tmpl-1', { name: '수정' }, 'user-1')).rejects.toThrow('앱 에러');
    });

    it('비 AppError는 handleServiceError를 호출해야 한다', async () => {
      const genericError = new Error('일반 에러');
      mockGetDoc.mockRejectedValue(genericError);
      mockIsAppError.mockReturnValue(false);
      mockHandleServiceError.mockReturnValue(genericError as unknown as AppError);

      await expect(updateTemplate('tmpl-1', { name: '수정' }, 'user-1')).rejects.toThrow(
        '일반 에러'
      );
      expect(mockHandleServiceError).toHaveBeenCalled();
    });
  });
});
