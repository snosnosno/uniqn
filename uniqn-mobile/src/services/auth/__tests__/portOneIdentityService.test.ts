/**
 * callVerifyAndSavePortOneProfile 의 Edge Function 에러 매핑 회귀 테스트.
 *
 * 회원가입 주 경로(verify-and-save)는 그동안 PROFILE_ALREADY_COMPLETED 만 typed
 * 에러로 변환하고, 그 외 IdP code 는 raw FunctionsHttpError 를 throw → "Edge Function
 * returned a non-2xx status code" 영문 메시지가 UI 노출. A-1 이 서버에 code 필드를
 * 추가했으므로, 클라이언트도 verify-identity 경로와 동일하게 code 를 한글 메시지로 변환해야 한다.
 */
import { ValidationError } from '@/errors';
import { invokeEdgeFunction } from '@/lib/supabaseFunctions';
import { callVerifyAndSavePortOneProfile } from '../portOneIdentityService';

// jest.mock 는 babel-plugin-jest-hoist 로 import 위로 호이스팅된다.
jest.mock('@/lib/supabaseFunctions', () => ({
  invokeEdgeFunction: jest.fn(),
}));

const mockInvoke = invokeEdgeFunction as jest.Mock;

const VALID_TOKEN = 'a'.repeat(64); // 64-hex caller binding token

function makeHttpError(body: { code?: string; error?: string }) {
  // Supabase FunctionsHttpError 형태: context 는 fetch Response (json() 보유)
  return {
    name: 'FunctionsHttpError',
    message: 'Edge Function returned a non-2xx status code',
    context: { json: async () => body },
  };
}

describe('callVerifyAndSavePortOneProfile — Edge Function 에러 매핑', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('PORTONE_CONFIG_MISSING code → 영문 generic 이 아닌 한글 ValidationError 로 변환한다', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: makeHttpError({
        code: 'PORTONE_CONFIG_MISSING',
        error: '본인인증 서비스에 일시적인 문제가 발생했어요. 잠시 후 다시 시도해주세요.',
      }),
    });

    const promise = callVerifyAndSavePortOneProfile({
      identityVerificationId: 'iv-test-1',
      mode: 'signup',
      expectedBindingToken: VALID_TOKEN,
    } as Parameters<typeof callVerifyAndSavePortOneProfile>[0]);

    await expect(promise).rejects.toBeInstanceOf(ValidationError);
    await expect(promise).rejects.toMatchObject({
      userMessage: expect.stringContaining('본인인증 서비스'),
    });
    // 영문 generic 이 사용자에게 노출되면 안 된다.
    await expect(promise).rejects.not.toMatchObject({
      userMessage: expect.stringContaining('non-2xx'),
    });
    // code 매핑은 즉시 변환 — 재시도 없이 1회만 호출.
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
});
