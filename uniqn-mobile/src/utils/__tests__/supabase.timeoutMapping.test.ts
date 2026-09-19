/**
 * 타임아웃이 E1002 로 도달하는가 (감사 err-01)
 *
 * @description 요청을 끊는 것만으로는 절반이다. 끊긴 요청이 사용자에게 "알 수 없는
 *   오류"로 보이면 무한 스피너를 정체불명 토스트로 바꾼 것에 지나지 않는다.
 *
 * 🔑 이 파일이 존재하는 진짜 이유는 postgrest-js 의 실측 동작이다 —
 *    fetch 예외를 `{ message, details, hint, code }` 로 바꾸면서 **`code` 를 항상
 *    빈 문자열로 버린다**. 그래서 우리가 심은 에러 코드는 리포지토리까지 살아오지 못하고,
 *    판별은 메시지 마커로만 가능하다. 그 전제가 깨지면 여기서 잡힌다.
 */

import { handleSupabaseError } from '../supabase';
import { SUPABASE_TIMEOUT_MARKER } from '@/lib/supabaseFetch';
import { ERROR_CODES, isAppError } from '@/errors';

const CONTEXT = { operation: '근무 기록 조회', table: 'work_logs' };

function captureThrown(run: () => never): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('예외가 발생하지 않았다');
}

describe('handleSupabaseError — 타임아웃 매핑', () => {
  it('클라이언트가 끊은 요청을 E1002 로 매핑한다 (Error 인스턴스 경로)', () => {
    const raw = new Error(`${SUPABASE_TIMEOUT_MARKER}: 요청이 15000ms 안에 끝나지 않았습니다.`);
    raw.name = 'UniqnTimeoutError';

    const thrown = captureThrown(() => handleSupabaseError(raw, CONTEXT));

    expect(isAppError(thrown)).toBe(true);
    expect((thrown as { code: string }).code).toBe(ERROR_CODES.NETWORK_TIMEOUT);
  });

  it('postgrest-js 가 code 를 버리고 message 만 남겨도 E1002 로 매핑한다', () => {
    // postgrest-js 실측 형태 — code 가 빈 문자열이다.
    // 이 분기가 없으면 매핑 없는 PostgrestError 로 떨어져 '알 수 없는 오류'가 된다.
    const postgrestShaped = {
      message: `UniqnTimeoutError: ${SUPABASE_TIMEOUT_MARKER}: 요청이 15000ms 안에 끝나지 않았습니다.`,
      details: '',
      hint: 'Request was aborted (timeout or manual cancellation)',
      code: '',
    };

    const thrown = captureThrown(() => handleSupabaseError(postgrestShaped, CONTEXT));

    expect(isAppError(thrown)).toBe(true);
    expect((thrown as { code: string }).code).toBe(ERROR_CODES.NETWORK_TIMEOUT);
  });

  it('사용자에게 시간 초과라고 말한다 (정체불명 문구 아님)', () => {
    const raw = new Error(`${SUPABASE_TIMEOUT_MARKER}: 중단`);

    const thrown = captureThrown(() => handleSupabaseError(raw, CONTEXT));

    expect((thrown as { userMessage: string }).userMessage).toContain('시간이 초과');
  });

  it('재시도 가능 에러로 표시된다 (일시 장애이므로)', () => {
    const raw = new Error(`${SUPABASE_TIMEOUT_MARKER}: 중단`);

    const thrown = captureThrown(() => handleSupabaseError(raw, CONTEXT));

    expect((thrown as { isRetryable: boolean }).isRetryable).toBe(true);
  });

  it('마커가 없는 평범한 PostgrestError 는 기존 매핑을 그대로 탄다', () => {
    const notFound = { message: 'row not found', details: '', hint: '', code: 'PGRST116' };

    const thrown = captureThrown(() => handleSupabaseError(notFound, CONTEXT));

    expect((thrown as { code: string }).code).not.toBe(ERROR_CODES.NETWORK_TIMEOUT);
  });
});
