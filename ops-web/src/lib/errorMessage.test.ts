import { describe, expect, it } from 'vitest';
import { BusinessError, ERROR_CODES } from '@/core/errors/AppError';
import { toUserMessage } from './errorMessage';

describe('toUserMessage', () => {
  it('AppError 는 한글 userMessage', () => {
    expect(toUserMessage(new BusinessError(ERROR_CODES.OPS_SEAT_TAKEN))).toBe(
      '이미 사용 중인 좌석입니다'
    );
  });

  it('그 외 에러는 원문(영어 서버 메시지)을 노출하지 않는다', () => {
    expect(toUserMessage(new Error('duplicate key value violates'))).toBe(
      '문제가 발생했어요. 잠시 후 다시 시도해 주세요.'
    );
  });
});
