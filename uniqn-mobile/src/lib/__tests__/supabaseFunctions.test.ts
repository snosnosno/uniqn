import { invokeEdgeFunction } from '../supabaseFunctions';

const mockGetSession = jest.fn();
const mockRefreshSession = jest.fn();
const mockInvoke = jest.fn();

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
    },
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

const nowSec = () => Math.floor(Date.now() / 1000);

describe('invokeEdgeFunction', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRefreshSession.mockReset();
    mockInvoke.mockReset();
  });

  it('fresh session: preflight refresh 없이 invoke 1회 호출', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token', expires_at: nowSec() + 3600 } },
    });
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });

    const result = await invokeEdgeFunction('foo', { body: { x: 1 } });

    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('foo', { body: { x: 1 } });
    expect(result.data).toEqual({ ok: true });
    expect(result.error).toBeNull();
  });

  it('만료 임박 세션: preflight refreshSession 실행 후 invoke', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token', expires_at: nowSec() + 10 } },
    });
    mockRefreshSession.mockResolvedValue({ data: {}, error: null });
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });

    await invokeEdgeFunction('foo');

    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('401 수신: refreshSession 후 1회 재시도', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token', expires_at: nowSec() + 3600 } },
    });
    const authError = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      context: { status: 401 },
    });
    mockInvoke
      .mockResolvedValueOnce({ data: null, error: authError })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });
    mockRefreshSession.mockResolvedValue({ data: {}, error: null });

    const result = await invokeEdgeFunction('foo');

    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual({ ok: true });
    expect(result.error).toBeNull();
  });

  it('401 재시도도 실패: 두번째 에러 반환', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token', expires_at: nowSec() + 3600 } },
    });
    const authError = Object.assign(new Error('401 unauthorized'), { status: 401 });
    const secondError = Object.assign(new Error('401 again'), { status: 401 });
    mockInvoke
      .mockResolvedValueOnce({ data: null, error: authError })
      .mockResolvedValueOnce({ data: null, error: secondError });
    mockRefreshSession.mockResolvedValue({ data: {}, error: null });

    const result = await invokeEdgeFunction('foo');

    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(result.error).toBe(secondError);
  });

  it('refreshSession 실패 시 재시도 생략하고 원 에러 반환', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token', expires_at: nowSec() + 3600 } },
    });
    const authError = Object.assign(new Error('401'), { status: 401 });
    mockInvoke.mockResolvedValueOnce({ data: null, error: authError });
    mockRefreshSession.mockResolvedValue({
      data: {},
      error: new Error('refresh token invalid'),
    });

    const result = await invokeEdgeFunction('foo');

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result.error).toBe(authError);
  });

  it('401 이 아닌 에러: 재시도 없이 바로 반환', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token', expires_at: nowSec() + 3600 } },
    });
    const serverError = Object.assign(new Error('500 internal'), { status: 500 });
    mockInvoke.mockResolvedValueOnce({ data: null, error: serverError });

    const result = await invokeEdgeFunction('foo');

    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result.error).toBe(serverError);
  });

  it('명시적 Authorization 헤더: preflight/refresh/재시도 모두 스킵', async () => {
    const authError = Object.assign(new Error('401'), { status: 401 });
    mockInvoke.mockResolvedValueOnce({ data: null, error: authError });

    const result = await invokeEdgeFunction('foo', {
      headers: { Authorization: 'Bearer explicit-token' },
    });

    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result.error).toBe(authError);
  });

  it('세션 없음: preflight refresh 생략, invoke 단순 전달', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });

    await invokeEdgeFunction('foo');

    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
});
