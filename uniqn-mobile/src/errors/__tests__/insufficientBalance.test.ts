// src/errors/__tests__/insufficientBalance.test.ts
import { ERROR_CODES, ERROR_MESSAGES, BusinessError } from '@/errors/AppError';

describe('BUSINESS_INSUFFICIENT_BALANCE', () => {
  it('코드가 정의되어 있다', () => {
    expect(ERROR_CODES.BUSINESS_INSUFFICIENT_BALANCE).toBe('E6080');
  });

  it('ERROR_MESSAGES 맵에 메시지가 등록돼 있다', () => {
    expect(ERROR_MESSAGES[ERROR_CODES.BUSINESS_INSUFFICIENT_BALANCE]).toContain('잔액');
  });

  it('userMessage 없이 BusinessError 생성 시 맵 메시지로 채워진다', () => {
    const err = new BusinessError(ERROR_CODES.BUSINESS_INSUFFICIENT_BALANCE);
    expect(err.userMessage).toContain('잔액');
  });
});
