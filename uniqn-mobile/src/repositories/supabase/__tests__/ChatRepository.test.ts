/**
 * ChatRepository 계약 테스트 (S2a C2)
 *
 * 🚨 supabase 클라이언트는 Database 제네릭 없이 만들어져 rpc 이름·인자를 tsc 가 검사하지 않는다.
 *    S1 마이그 시그니처를 문자 그대로 고정한다.
 * 🔑 에러는 채팅 매퍼가 먼저 잡고, 못 잡은 것만 handleSupabaseError 로 간다.
 */
import { ERROR_CODES } from '@/errors/AppError';
import { CHAT_ERROR_CODES } from '@/errors/chat';
import { chatRepository } from '../../chat';

const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockStorageFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
    storage: { from: (...args: unknown[]) => mockStorageFrom(...args) },
    channel: jest.fn(),
  },
}));

const mockInvoke = jest.fn();
jest.mock('@/lib/supabaseFunctions', () => ({
  invokeEdgeFunction: (...args: unknown[]) => mockInvoke(...args),
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const CONV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const POST = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const USER = 'a3bb189e-8bf9-3888-9912-ace4e6543002';
const CLIENT = '16fd2706-8baf-433b-82eb-8c7fada847da';

/** 호출을 기록하는 체인형 쿼리 빌더 — await 하면 result 로 풀린다 */
function queryBuilder(result: { data: unknown; error: unknown }) {
  const calls: [string, unknown[]][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'gt', 'lt', 'or', 'order', 'limit']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    };
  }
  builder.maybeSingle = () => {
    calls.push(['maybeSingle', []]);
    return Promise.resolve(result);
  };
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return { builder, calls };
}

function messageRow(id: string, createdAt: string) {
  return {
    id,
    conversation_id: CONV,
    sender_id: USER,
    sender_side: 'seeker',
    sender_display_name: '구직자 a3bb',
    kind: 'text',
    body: 'hi',
    image_path: null,
    image_width: null,
    image_height: null,
    client_message_id: CLIENT,
    created_at: createdAt,
    deleted_at: null,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('RPC 시그니처', () => {
  it('openConversation — p_job_posting_id·p_seeker_id(소문자), 구직자 본인이면 null', async () => {
    mockRpc.mockResolvedValue({ data: CONV, error: null });

    await expect(chatRepository.openConversation(POST.toUpperCase(), null)).resolves.toBe(CONV);
    expect(mockRpc).toHaveBeenCalledWith('chat_open_conversation', {
      p_job_posting_id: POST,
      p_seeker_id: null,
    });

    await chatRepository.openConversation(POST, USER.toUpperCase());
    expect(mockRpc).toHaveBeenLastCalledWith('chat_open_conversation', {
      p_job_posting_id: POST,
      p_seeker_id: USER,
    });
  });

  it('sendMessage — 7개 인자 키가 마이그와 같다', async () => {
    mockRpc.mockResolvedValue({
      data: { messageId: 'm1', createdAt: '2026-09-25T09:00:00Z', deduped: false },
      error: null,
    });

    const result = await chatRepository.sendMessage({
      conversationId: CONV,
      kind: 'text',
      body: '안녕하세요',
      clientMessageId: CLIENT.toUpperCase(),
    });

    expect(mockRpc).toHaveBeenCalledWith('chat_send_message', {
      p_conversation_id: CONV,
      p_kind: 'text',
      p_body: '안녕하세요',
      p_image_path: null,
      p_image_width: null,
      p_image_height: null,
      p_client_message_id: CLIENT,
    });
    expect(result).toEqual({ messageId: 'm1', createdAt: '2026-09-25T09:00:00Z', deduped: false });
  });

  it('sendMessage — 반환 모양이 틀리면 조용히 넘기지 않는다', async () => {
    mockRpc.mockResolvedValue({ data: { messageId: 'm1' }, error: null });
    await expect(
      chatRepository.sendMessage({
        conversationId: CONV,
        kind: 'text',
        body: 'x',
        clientMessageId: CLIENT,
      })
    ).rejects.toBeDefined();
  });

  it('markRead·hideConversation·getUnreadTotal', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await chatRepository.markRead(CONV, 'm1');
    expect(mockRpc).toHaveBeenCalledWith('chat_mark_read', {
      p_conversation_id: CONV,
      p_last_message_id: 'm1',
    });

    await chatRepository.hideConversation(CONV);
    expect(mockRpc).toHaveBeenLastCalledWith('chat_hide_conversation', { p_conversation_id: CONV });

    mockRpc.mockResolvedValue({ data: 7, error: null });
    await expect(chatRepository.getUnreadTotal()).resolves.toBe(7);
    expect(mockRpc).toHaveBeenLastCalledWith('chat_unread_total');
  });

  it('listConversations — p_limit·p_before 를 넘기고 camelCase 로 바꾼다', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          conversation_id: CONV,
          job_posting_id: POST,
          posting_title: '주말 딜러',
          posting_status: 'closed',
          counterpart_name: '홀덤펍 담당자',
          my_side: 'seeker',
          last_message_at: '2026-09-25T09:00:00+00:00',
          last_message_preview: '네',
          unread_count: 2,
          blocked: false,
        },
      ],
      error: null,
    });

    const rows = await chatRepository.listConversations({
      limit: 30,
      before: '2026-09-25T10:00:00Z',
    });

    expect(mockRpc).toHaveBeenCalledWith('chat_list_conversations', {
      p_limit: 30,
      p_before: '2026-09-25T10:00:00Z',
    });
    expect(rows[0]).toMatchObject({
      conversationId: CONV,
      postingStatus: 'closed',
      unreadCount: 2,
    });
  });
});

describe('에러 매핑 순서', () => {
  it('CHAT_RATE_LIMITED → 채팅 매퍼의 E6152(재시도 가능)', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'CHAT_RATE_LIMITED: 메시지를 너무 빨리 보내고 있습니다', code: 'P0001' },
    });
    await expect(
      chatRepository.sendMessage({
        conversationId: CONV,
        kind: 'text',
        body: 'x',
        clientMessageId: CLIENT,
      })
    ).rejects.toMatchObject({ code: CHAT_ERROR_CODES.CHAT_RATE_LIMITED, isRetryable: true });
  });

  it('서버 다크 42501 → E6156', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'permission denied for function chat_open_conversation', code: '42501' },
    });
    await expect(chatRepository.openConversation(POST, null)).rejects.toMatchObject({
      code: CHAT_ERROR_CODES.CHAT_UNAVAILABLE,
    });
  });

  it('채팅 매퍼가 모르는 P0001 은 handleSupabaseError 폴백(E7000)', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'SOMETHING_ELSE: x', code: 'P0001', details: null, hint: null },
    });
    await expect(chatRepository.markRead(CONV, 'm1')).rejects.toMatchObject({
      code: ERROR_CODES.UNKNOWN,
    });
  });
});

describe('RLS SELECT', () => {
  it('getMessagesPage — 첫 페이지는 최신순 limit, 커서가 있으면 (created_at, id) keyset', async () => {
    const first = queryBuilder({ data: [messageRow('b', '2026-09-25T09:02:00Z')], error: null });
    mockFrom.mockReturnValueOnce(first.builder);

    const page = await chatRepository.getMessagesPage(CONV, null, 30);

    expect(mockFrom).toHaveBeenCalledWith('chat_messages');
    expect(first.calls).toEqual(
      expect.arrayContaining([
        ['eq', ['conversation_id', CONV]],
        ['order', ['created_at', { ascending: false }]],
        ['order', ['id', { ascending: false }]],
        ['limit', [30]],
      ])
    );
    expect(first.calls.some(([m]) => m === 'or')).toBe(false);
    expect(page[0]?.id).toBe('b');

    const next = queryBuilder({ data: [], error: null });
    mockFrom.mockReturnValueOnce(next.builder);
    await chatRepository.getMessagesPage(CONV, { createdAt: '2026-09-25T09:02:00Z', id: 'b' }, 30);
    expect(next.calls).toContainEqual([
      'or',
      ['created_at.lt.2026-09-25T09:02:00Z,and(created_at.eq.2026-09-25T09:02:00Z,id.lt.b)'],
    ]);
  });

  it('getMessagesAfter — anchor 이후를 오름차순으로', async () => {
    const tail = queryBuilder({ data: [], error: null });
    mockFrom.mockReturnValueOnce(tail.builder);

    await chatRepository.getMessagesAfter(CONV, '2026-09-25T09:02:00Z', 200);

    expect(tail.calls).toEqual(
      expect.arrayContaining([
        ['eq', ['conversation_id', CONV]],
        ['gt', ['created_at', '2026-09-25T09:02:00Z']],
        ['order', ['created_at', { ascending: true }]],
        ['limit', [200]],
      ])
    );
  });

  it('getReadCursor — "-infinity" 는 읽은 적 없음(null)', async () => {
    const q = queryBuilder({ data: { last_read_at: '-infinity' }, error: null });
    mockFrom.mockReturnValueOnce(q.builder);
    await expect(chatRepository.getReadCursor(CONV)).resolves.toBeNull();

    const q2 = queryBuilder({ data: { last_read_at: '2026-09-25T09:00:00+00:00' }, error: null });
    mockFrom.mockReturnValueOnce(q2.builder);
    await expect(chatRepository.getReadCursor(CONV)).resolves.toBe('2026-09-25T09:00:00+00:00');
  });

  it('findConversation — (공고, 구직자) 로 기존 방 id', async () => {
    const q = queryBuilder({ data: { id: CONV }, error: null });
    mockFrom.mockReturnValueOnce(q.builder);

    await expect(chatRepository.findConversation(POST, USER)).resolves.toBe(CONV);
    expect(q.calls).toEqual(
      expect.arrayContaining([
        ['eq', ['job_posting_id', POST]],
        ['eq', ['seeker_id', USER]],
      ])
    );
  });
});

describe('사진 storage (S2b)', () => {
  const PATH = `${CONV}/${USER}/${CLIENT}.jpg`;

  function bucket(overrides: Record<string, jest.Mock>) {
    const api = { upload: jest.fn(), createSignedUrl: jest.fn(), ...overrides };
    mockStorageFrom.mockReturnValueOnce(api);
    return api;
  }

  it('uploadImage — (M1) chat-media-inbox 버킷에 JPEG · upsert:false 로 올린다', async () => {
    const api = bucket({
      upload: jest.fn().mockResolvedValue({ data: { path: PATH }, error: null }),
    });
    const bytes = new Uint8Array([1, 2, 3]).buffer;

    await chatRepository.uploadImage(PATH, bytes);

    // chat-media 는 직접 쓰기가 봉쇄됐다 — 접수 창구(inbox)에만 올린다
    expect(mockStorageFrom).toHaveBeenCalledWith('chat-media-inbox');
    expect(mockStorageFrom).not.toHaveBeenCalledWith('chat-media');
    expect(api.upload).toHaveBeenCalledWith(PATH, bytes, {
      contentType: 'image/jpeg',
      upsert: false,
    });
  });

  it('uploadImage — 이미 있는 객체(재전송)는 성공으로 본다', async () => {
    bucket({
      upload: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'The resource already exists', statusCode: '409', status: 400 },
      }),
    });
    await expect(
      chatRepository.uploadImage(PATH, new Uint8Array([1]).buffer)
    ).resolves.toBeUndefined();
  });

  it('uploadImage — storage 정책 거부는 사진 한도(E6157, 재시도 가능)로 매핑', async () => {
    bucket({
      upload: jest.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'new row violates row-level security policy',
          statusCode: '403',
          status: 400,
        },
      }),
    });
    await expect(
      chatRepository.uploadImage(PATH, new Uint8Array([1]).buffer)
    ).rejects.toMatchObject({ code: CHAT_ERROR_CODES.CHAT_IMAGE_LIMIT, isRetryable: true });
  });

  it('uploadImage — 용량 초과는 사진 거부(E6153)로 매핑', async () => {
    bucket({
      upload: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'The object exceeded the maximum allowed size', statusCode: '413' },
      }),
    });
    await expect(
      chatRepository.uploadImage(PATH, new Uint8Array([1]).buffer)
    ).rejects.toMatchObject({ code: CHAT_ERROR_CODES.CHAT_IMAGE_INVALID });
  });

  it('createSignedImageUrl — 주어진 TTL 로 서명 URL 을 받는다', async () => {
    const api = bucket({
      createSignedUrl: jest
        .fn()
        .mockResolvedValue({ data: { signedUrl: 'https://x/signed?token=t' }, error: null }),
    });

    await expect(chatRepository.createSignedImageUrl(PATH, 300)).resolves.toBe(
      'https://x/signed?token=t'
    );
    expect(mockStorageFrom).toHaveBeenCalledWith('chat-media');
    expect(api.createSignedUrl).toHaveBeenCalledWith(PATH, 300);
  });

  it('createSignedImageUrl — 실패는 던진다(빈 URL 로 조용히 넘어가지 않는다)', async () => {
    bucket({
      createSignedUrl: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Object not found', statusCode: '404' },
      }),
    });
    await expect(chatRepository.createSignedImageUrl(PATH, 300)).rejects.toBeDefined();
  });
});

describe('(S4 M1) 사진 정화 EF', () => {
  const PATH = `${CONV}/${USER}/${CLIENT}.jpg`;

  function httpError(status: number, body: unknown) {
    const response = {
      status,
      json: jest.fn().mockResolvedValue(body),
      clone() {
        return this;
      },
    };
    return Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      context: response,
    });
  }

  it('sanitizeImage — chat-media-sanitize 에 { path } 를 POST 하고 서버 width/height 를 돌려준다', async () => {
    mockInvoke.mockResolvedValue({ data: { path: PATH, width: 1600, height: 1200 }, error: null });

    await expect(chatRepository.sanitizeImage(PATH)).resolves.toEqual({
      path: PATH,
      width: 1600,
      height: 1200,
    });
    expect(mockInvoke).toHaveBeenCalledWith('chat-media-sanitize', { body: { path: PATH } });
  });

  it('sanitizeImage — 응답 모양이 틀리면 조용히 넘기지 않는다', async () => {
    mockInvoke.mockResolvedValue({ data: { path: PATH }, error: null });
    await expect(chatRepository.sanitizeImage(PATH)).rejects.toBeDefined();
  });

  it('sanitizeImage — 실패 본문의 code 로 매핑한다(INVALID → E6153)', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: httpError(400, { error: 'bad jpeg', code: 'CHAT_IMAGE_INVALID' }),
    });
    await expect(chatRepository.sanitizeImage(PATH)).rejects.toMatchObject({
      code: CHAT_ERROR_CODES.CHAT_IMAGE_INVALID,
    });
  });

  it('sanitizeImage — NOT_FOUND 는 다시 올려야 함(E6160)', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: httpError(404, { error: 'no object', code: 'CHAT_IMAGE_NOT_FOUND' }),
    });
    await expect(chatRepository.sanitizeImage(PATH)).rejects.toMatchObject({
      code: CHAT_ERROR_CODES.CHAT_IMAGE_MISSING,
    });
  });

  it('sanitizeImage — 본문을 못 읽는 실패(네트워크)는 재시도 가능한 요청 실패', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Failed to fetch') });
    await expect(chatRepository.sanitizeImage(PATH)).rejects.toMatchObject({
      code: ERROR_CODES.NETWORK_REQUEST_FAILED,
      isRetryable: true,
    });
  });
});

describe('(S4) 안전 — 뮤트·차단·신고', () => {
  const MSG = '9b2d6f3e-1c4a-4e8b-9f1a-2b3c4d5e6f70';

  it('setMuted — chat_set_muted(p_conversation_id, p_muted)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await chatRepository.setMuted(CONV.toUpperCase(), true);
    expect(mockRpc).toHaveBeenCalledWith('chat_set_muted', {
      p_conversation_id: CONV,
      p_muted: true,
    });
  });

  it('block / unblock — p_conversation_id 하나', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await chatRepository.block(CONV);
    expect(mockRpc).toHaveBeenLastCalledWith('chat_block', { p_conversation_id: CONV });
    await chatRepository.unblock(CONV);
    expect(mockRpc).toHaveBeenLastCalledWith('chat_unblock', { p_conversation_id: CONV });
  });

  it('unblock — 반대쪽 해제 시도(PERMISSION_DENIED)는 서버 문구로 던진다', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message: 'PERMISSION_DENIED: 상대가 차단한 대화는 해제할 수 없습니다',
        code: 'P0001',
      },
    });
    await expect(chatRepository.unblock(CONV)).rejects.toMatchObject({
      code: ERROR_CODES.INFRA_PERMISSION_DENIED,
      userMessage: '상대가 차단한 대화는 해제할 수 없습니다',
    });
  });

  it('reportMessage — chat_report_message(p_message_id, p_reason, p_detail) → report id', async () => {
    const REPORT = 'c56a4180-65aa-42ec-a945-5fd21dec0538';
    mockRpc.mockResolvedValue({ data: REPORT, error: null });

    await expect(
      chatRepository.reportMessage({ messageId: MSG.toUpperCase(), reason: 'scam', detail: null })
    ).resolves.toBe(REPORT);
    expect(mockRpc).toHaveBeenCalledWith('chat_report_message', {
      p_message_id: MSG,
      p_reason: 'scam',
      p_detail: null,
    });
  });

  it('reportMessage — 중복 신고는 E6158', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'DUPLICATE_REPORT: 이미 신고한 메시지입니다', code: 'P0001' },
    });
    await expect(
      chatRepository.reportMessage({ messageId: MSG, reason: 'abuse', detail: null })
    ).rejects.toMatchObject({ code: CHAT_ERROR_CODES.CHAT_REPORT_DUPLICATE });
  });

  it('getSafetyState — chat_blocks 의 쪽별 행 전부 + 내 muted_until', async () => {
    const blocks = queryBuilder({
      data: [{ blocked_by_side: 'employer' }, { blocked_by_side: 'seeker' }],
      error: null,
    });
    const reads = queryBuilder({ data: { muted_until: 'infinity' }, error: null });
    mockFrom.mockImplementation((table: string) =>
      table === 'chat_blocks' ? blocks.builder : reads.builder
    );

    await expect(chatRepository.getSafetyState(CONV.toUpperCase())).resolves.toEqual({
      blockedBySides: ['employer', 'seeker'],
      mutedUntil: 'infinity',
    });
    expect(blocks.calls).toEqual(
      expect.arrayContaining([
        ['select', ['blocked_by_side']],
        ['eq', ['conversation_id', CONV]],
      ])
    );
    expect(reads.calls).toEqual(
      expect.arrayContaining([
        ['select', ['muted_until']],
        ['eq', ['conversation_id', CONV]],
      ])
    );
    mockFrom.mockReset();
  });

  it('getSafetyState — 행이 없으면 차단 없음·뮤트 없음', async () => {
    const empty = queryBuilder({ data: null, error: null });
    mockFrom.mockImplementation(() => empty.builder);
    await expect(chatRepository.getSafetyState(CONV)).resolves.toEqual({
      blockedBySides: [],
      mutedUntil: null,
    });
    mockFrom.mockReset();
  });
});
