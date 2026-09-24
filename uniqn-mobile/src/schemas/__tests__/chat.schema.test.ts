/**
 * chat.schema — 채팅 입력 검증 + 서버 행 파서
 */
import {
  chatListRowSchema,
  chatMessageRowSchema,
  chatSendResultSchema,
  chatTextBodySchema,
  chatUuidSchema,
} from '../chat.schema';

const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('chatTextBodySchema', () => {
  it('앞뒤 공백을 자르고 통과시킨다', () => {
    expect(chatTextBodySchema.parse('  안녕하세요  ')).toBe('안녕하세요');
  });

  it('1000자는 통과, 1001자는 거부', () => {
    expect(chatTextBodySchema.safeParse('가'.repeat(1000)).success).toBe(true);
    expect(chatTextBodySchema.safeParse('가'.repeat(1001)).success).toBe(false);
  });

  it('공백만이면 거부', () => {
    expect(chatTextBodySchema.safeParse('   ').success).toBe(false);
  });

  it('XSS 패턴을 거부하고 사용자용 문구를 준다', () => {
    const result = chatTextBodySchema.safeParse('<script>alert(1)</script>');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/보낼 수 없는/);
  });
});

describe('chatUuidSchema', () => {
  it('대문자 uuid 를 소문자로 정규화한다(사진 경로 완전 일치 조건)', () => {
    expect(chatUuidSchema.parse(UUID.toUpperCase())).toBe(UUID);
  });

  it('uuid 가 아니면 거부', () => {
    expect(chatUuidSchema.safeParse('not-a-uuid').success).toBe(false);
  });
});

describe('서버 행 파서', () => {
  it('목록 행을 camelCase 로 바꾼다', () => {
    const parsed = chatListRowSchema.parse({
      conversation_id: UUID,
      job_posting_id: UUID,
      posting_title: '주말 딜러',
      posting_status: 'active',
      counterpart_name: '구직자 abcd',
      my_side: 'employer',
      last_message_at: '2026-09-25T09:00:00+00:00',
      last_message_preview: '안녕하세요',
      unread_count: 3,
      blocked: false,
    });
    expect(parsed).toEqual({
      conversationId: UUID,
      jobPostingId: UUID,
      postingTitle: '주말 딜러',
      postingStatus: 'active',
      counterpartName: '구직자 abcd',
      mySide: 'employer',
      lastMessageAt: '2026-09-25T09:00:00+00:00',
      lastMessagePreview: '안녕하세요',
      unreadCount: 3,
      blocked: false,
    });
  });

  it('공고가 사라져 posting_status 가 null 이어도 통과', () => {
    const parsed = chatListRowSchema.parse({
      conversation_id: UUID,
      job_posting_id: UUID,
      posting_title: 't',
      posting_status: null,
      counterpart_name: 'n',
      my_side: 'seeker',
      last_message_at: '2026-09-25T09:00:00+00:00',
      last_message_preview: null,
      unread_count: 0,
      blocked: false,
    });
    expect(parsed.postingStatus).toBeNull();
  });

  it('메시지 행 — 알 수 없는 kind 는 거부', () => {
    const base = {
      id: UUID,
      conversation_id: UUID,
      sender_id: null,
      sender_side: 'system',
      sender_display_name: '시스템',
      kind: 'text',
      body: 'x',
      image_path: null,
      image_width: null,
      image_height: null,
      client_message_id: UUID,
      created_at: '2026-09-25T09:00:00+00:00',
      deleted_at: null,
    };
    expect(chatMessageRowSchema.parse(base).senderSide).toBe('system');
    expect(chatMessageRowSchema.safeParse({ ...base, kind: 'video' }).success).toBe(false);
  });

  it('전송 결과 jsonb 를 검증한다', () => {
    expect(
      chatSendResultSchema.parse({
        messageId: UUID,
        createdAt: '2026-09-25T09:00:00Z',
        deduped: true,
      })
    ).toEqual({ messageId: UUID, createdAt: '2026-09-25T09:00:00Z', deduped: true });
    expect(chatSendResultSchema.safeParse({ messageId: UUID }).success).toBe(false);
  });
});
