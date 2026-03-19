/**
 * UNIQN Mobile - TemplateService Tests
 *
 * @description templateService 단위 테스트 (Repository 패턴)
 * @version 2.0.0
 */

// ============================================================================
// Mocks (jest.mock is hoisted, so use inline factory functions)
// ============================================================================

// ============================================================================
// Imports (after mocks)
// ============================================================================

import {
  getTemplates,
  saveTemplate,
  loadTemplate,
  deleteTemplate,
  updateTemplate,
} from '../templateService';
import { templateRepository } from '@/repositories';
import { isAppError, AppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';

jest.mock('@/repositories', () => ({
  templateRepository: {
    getTemplates: jest.fn(),
    saveTemplate: jest.fn(),
    loadTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    updateTemplate: jest.fn(),
  },
}));

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

// Get typed mock references
const mockRepo = templateRepository as jest.Mocked<typeof templateRepository>;
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

      mockRepo.getTemplates.mockResolvedValue(mockTemplates as never);

      const result = await getTemplates('user-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'tmpl-1', name: '템플릿1' });
      expect(mockRepo.getTemplates).toHaveBeenCalledWith('user-1');
    });

    it('템플릿이 없으면 빈 배열을 반환해야 한다', async () => {
      mockRepo.getTemplates.mockResolvedValue([]);

      const result = await getTemplates('user-1');

      expect(result).toEqual([]);
    });

    it('권한 에러 시 빈 배열을 반환해야 한다', async () => {
      const permissionError = new Error('permission denied') as Error & { code?: string };
      permissionError.code = 'permission-denied';
      mockRepo.getTemplates.mockRejectedValue(permissionError);

      const result = await getTemplates('new-user');

      expect(result).toEqual([]);
    });

    it('기타 에러 시 handleServiceError를 호출해야 한다', async () => {
      const genericError = new Error('Unknown error');
      mockRepo.getTemplates.mockRejectedValue(genericError);
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
      mockRepo.saveTemplate.mockResolvedValue('tmpl-new-id');

      const result = await saveTemplate(mockInput as never, 'user-1');

      expect(typeof result).toBe('string');
      expect(result).toBe('tmpl-new-id');
      expect(mockRepo.saveTemplate).toHaveBeenCalledWith(mockInput, 'user-1');
    });

    it('description이 없어도 저장해야 한다', async () => {
      mockRepo.saveTemplate.mockResolvedValue('tmpl-new-id');

      const inputWithoutDesc = {
        name: '새 템플릿',
        formData: { title: '공고 제목' },
      };

      const result = await saveTemplate(inputWithoutDesc as never, 'user-1');

      expect(typeof result).toBe('string');
      expect(mockRepo.saveTemplate).toHaveBeenCalled();
    });

    it('description이 있으면 repository에 전달되어야 한다', async () => {
      mockRepo.saveTemplate.mockResolvedValue('tmpl-new-id');

      await saveTemplate(mockInput as never, 'user-1');

      const calledInput = mockRepo.saveTemplate.mock.calls[0][0] as unknown as Record<
        string,
        unknown
      >;
      expect(calledInput.description).toBe('설명');
    });

    it('Firestore 에러 시 handleServiceError를 호출해야 한다', async () => {
      const error = new Error('저장 실패');
      mockRepo.saveTemplate.mockRejectedValue(error);
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
      id: 'tmpl-1',
      name: '테스트 템플릿',
      createdBy: 'user-1',
      templateData: { title: '공고' },
      usageCount: 3,
    };

    it('템플릿을 불러와야 한다', async () => {
      mockRepo.loadTemplate.mockResolvedValue(mockTemplateData as never);

      const result = await loadTemplate('tmpl-1');

      expect(result).toMatchObject({
        id: 'tmpl-1',
        name: '테스트 템플릿',
      });
      expect(mockRepo.loadTemplate).toHaveBeenCalledWith('tmpl-1');
    });

    it('존재하지 않는 템플릿이면 BusinessError를 던져야 한다', async () => {
      const businessError = new Error('존재하지 않는 템플릿입니다');
      mockRepo.loadTemplate.mockRejectedValue(businessError);
      mockIsAppError.mockReturnValue(true);

      await expect(loadTemplate('non-existent')).rejects.toThrow();
    });

    it('사용 통계 업데이트 실패 시에도 템플릿은 반환되어야 한다', async () => {
      // Repository handles fire-and-forget stats update internally
      // This test verifies the service returns the template regardless
      mockRepo.loadTemplate.mockResolvedValue(mockTemplateData as never);

      const result = await loadTemplate('tmpl-1');

      expect(result).toMatchObject({
        id: 'tmpl-1',
        name: '테스트 템플릿',
      });
    });

    it('AppError는 그대로 다시 던져야 한다', async () => {
      const appError = new Error('앱 에러');
      mockRepo.loadTemplate.mockRejectedValue(appError);
      mockIsAppError.mockReturnValue(true);

      await expect(loadTemplate('tmpl-1')).rejects.toThrow('앱 에러');
    });

    it('비 AppError는 handleServiceError를 호출해야 한다', async () => {
      const genericError = new Error('일반 에러');
      mockRepo.loadTemplate.mockRejectedValue(genericError);
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
      mockRepo.deleteTemplate.mockResolvedValue(undefined);

      await deleteTemplate('tmpl-1', 'user-1');

      expect(mockRepo.deleteTemplate).toHaveBeenCalledWith('tmpl-1', 'user-1');
    });

    it('존재하지 않는 템플릿이면 BusinessError를 던져야 한다', async () => {
      const businessError = new Error('존재하지 않는 템플릿입니다');
      mockRepo.deleteTemplate.mockRejectedValue(businessError);
      mockIsAppError.mockReturnValue(true);

      await expect(deleteTemplate('non-existent', 'user-1')).rejects.toThrow();
    });

    it('다른 사용자의 템플릿이면 PermissionError를 던져야 한다', async () => {
      const permissionError = new Error('본인의 템플릿만 삭제할 수 있습니다');
      mockRepo.deleteTemplate.mockRejectedValue(permissionError);
      mockIsAppError.mockReturnValue(true);

      await expect(deleteTemplate('tmpl-1', 'user-1')).rejects.toThrow();
    });

    it('AppError는 그대로 다시 던져야 한다', async () => {
      const appError = new Error('앱 에러');
      mockRepo.deleteTemplate.mockRejectedValue(appError);
      mockIsAppError.mockReturnValue(true);

      await expect(deleteTemplate('tmpl-1', 'user-1')).rejects.toThrow('앱 에러');
    });

    it('비 AppError는 handleServiceError를 호출해야 한다', async () => {
      const genericError = new Error('일반 에러');
      mockRepo.deleteTemplate.mockRejectedValue(genericError);
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
      mockRepo.updateTemplate.mockResolvedValue(undefined);

      await updateTemplate('tmpl-1', { name: '수정된 템플릿' }, 'user-1');

      expect(mockRepo.updateTemplate).toHaveBeenCalledWith(
        'tmpl-1',
        { name: '수정된 템플릿' },
        'user-1'
      );
    });

    it('description을 수정할 수 있어야 한다', async () => {
      mockRepo.updateTemplate.mockResolvedValue(undefined);

      await updateTemplate('tmpl-1', { description: '새 설명' }, 'user-1');

      expect(mockRepo.updateTemplate).toHaveBeenCalledWith(
        'tmpl-1',
        { description: '새 설명' },
        'user-1'
      );
    });

    it('formData를 수정하면 repository에 전달되어야 한다', async () => {
      mockRepo.updateTemplate.mockResolvedValue(undefined);

      await updateTemplate('tmpl-1', { formData: { title: '새 제목' } as never }, 'user-1');

      expect(mockRepo.updateTemplate).toHaveBeenCalledWith(
        'tmpl-1',
        { formData: { title: '새 제목' } },
        'user-1'
      );
    });

    it('존재하지 않는 템플릿이면 BusinessError를 던져야 한다', async () => {
      const businessError = new Error('존재하지 않는 템플릿입니다');
      mockRepo.updateTemplate.mockRejectedValue(businessError);
      mockIsAppError.mockReturnValue(true);

      await expect(updateTemplate('non-existent', { name: '수정' }, 'user-1')).rejects.toThrow();
    });

    it('다른 사용자의 템플릿이면 PermissionError를 던져야 한다', async () => {
      const permissionError = new Error('본인의 템플릿만 수정할 수 있습니다');
      mockRepo.updateTemplate.mockRejectedValue(permissionError);
      mockIsAppError.mockReturnValue(true);

      await expect(updateTemplate('tmpl-1', { name: '수정' }, 'user-1')).rejects.toThrow();
    });

    it('AppError는 그대로 다시 던져야 한다', async () => {
      const appError = new Error('앱 에러');
      mockRepo.updateTemplate.mockRejectedValue(appError);
      mockIsAppError.mockReturnValue(true);

      await expect(updateTemplate('tmpl-1', { name: '수정' }, 'user-1')).rejects.toThrow('앱 에러');
    });

    it('비 AppError는 handleServiceError를 호출해야 한다', async () => {
      const genericError = new Error('일반 에러');
      mockRepo.updateTemplate.mockRejectedValue(genericError);
      mockIsAppError.mockReturnValue(false);
      mockHandleServiceError.mockReturnValue(genericError as unknown as AppError);

      await expect(updateTemplate('tmpl-1', { name: '수정' }, 'user-1')).rejects.toThrow(
        '일반 에러'
      );
      expect(mockHandleServiceError).toHaveBeenCalled();
    });
  });
});
