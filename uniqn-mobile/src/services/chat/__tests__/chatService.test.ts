/**
 * chatService — 채팅 쓰기 오케스트레이션
 *
 * 핵심 계약:
 * - 본문 검증에 실패하면 RPC 를 한 번도 부르지 않는다
 * - clientMessageId 는 호출자가 준 것을 **그대로** 쓴다(재전송 멱등의 전제 — 서비스가 새로 만들지 않는다)
 * - 방 열기와 보내기는 분리돼 있다(열기 성공·보내기 실패 후 재전송이 방을 다시 열지 않도록)
 */
import { ValidationError } from '@/errors/AppError';
import { chatService } from '../chatService';

const mockOpen = jest.fn();
const mockSend = jest.fn();
const mockMarkRead = jest.fn();
const mockHide = jest.fn();

jest.mock('@/repositories/chat', () => ({
  chatRepository: {
    openConversation: (...a: unknown[]) => mockOpen(...a),
    sendMessage: (...a: unknown[]) => mockSend(...a),
    markRead: (...a: unknown[]) => mockMarkRead(...a),
    hideConversation: (...a: unknown[]) => mockHide(...a),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const CONV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const CLIENT = '16fd2706-8baf-433b-82eb-8c7fada847da';

beforeEach(() => {
  jest.clearAllMocks();
  mockSend.mockResolvedValue({
    messageId: 'm1',
    createdAt: '2026-09-25T09:00:00Z',
    deduped: false,
  });
});

describe('chatService.sendText', () => {
  it('trim 한 본문과 호출자의 clientMessageId 를 그대로 보낸다', async () => {
    const result = await chatService.sendText({
      conversationId: CONV,
      clientMessageId: CLIENT,
      body: '  안녕하세요 ',
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith({
      conversationId: CONV,
      kind: 'text',
      body: '안녕하세요',
      clientMessageId: CLIENT,
    });
    expect(result.messageId).toBe('m1');
  });

  it.each([['   '], ['가'.repeat(1001)], ['<script>alert(1)</script>']])(
    '본문 %p 은 거부하고 RPC 를 부르지 않는다',
    async (body) => {
      await expect(
        chatService.sendText({ conversationId: CONV, clientMessageId: CLIENT, body })
      ).rejects.toBeInstanceOf(ValidationError);
      expect(mockSend).not.toHaveBeenCalled();
    }
  );

  it('같은 clientMessageId 로 두 번 보내면 두 호출의 id 가 같다(재전송)', async () => {
    mockSend.mockRejectedValueOnce(new Error('network'));
    await expect(
      chatService.sendText({ conversationId: CONV, clientMessageId: CLIENT, body: 'a' })
    ).rejects.toThrow('network');
    await chatService.sendText({ conversationId: CONV, clientMessageId: CLIENT, body: 'a' });

    expect(mockSend.mock.calls[0]?.[0].clientMessageId).toBe(CLIENT);
    expect(mockSend.mock.calls[1]?.[0].clientMessageId).toBe(CLIENT);
  });
});

describe('chatService.openConversation', () => {
  it('구직자 본인이면 seekerId 없이 연다', async () => {
    mockOpen.mockResolvedValue(CONV);
    await expect(chatService.openConversation({ jobPostingId: 'p1' })).resolves.toBe(CONV);
    expect(mockOpen).toHaveBeenCalledWith('p1', null);
  });

  it('구인자가 지원자에게 걸면 seekerId 를 넘긴다', async () => {
    mockOpen.mockResolvedValue(CONV);
    await chatService.openConversation({ jobPostingId: 'p1', seekerId: 's1' });
    expect(mockOpen).toHaveBeenCalledWith('p1', 's1');
  });
});

describe('chatService 읽음·나가기', () => {
  it('markRead·hide 는 Repository 로 그대로', async () => {
    await chatService.markRead(CONV, 'm1');
    await chatService.hide(CONV);
    expect(mockMarkRead).toHaveBeenCalledWith(CONV, 'm1');
    expect(mockHide).toHaveBeenCalledWith(CONV);
  });
});

describe('sendImage (S2b)', () => {
  it('kind=image · 빈 본문 · 경로와 크기를 그대로 보낸다', async () => {
    const path = `${CONV}/a3bb189e-8bf9-3888-9912-ace4e6543002/${CLIENT}.jpg`;
    await chatService.sendImage({
      conversationId: CONV,
      clientMessageId: CLIENT,
      imagePath: path,
      width: 1600,
      height: 1200,
    });
    expect(mockSend).toHaveBeenCalledWith({
      conversationId: CONV,
      kind: 'image',
      body: '',
      clientMessageId: CLIENT,
      imagePath: path,
      imageWidth: 1600,
      imageHeight: 1200,
    });
    expect(mockOpen).not.toHaveBeenCalled();
  });
});
