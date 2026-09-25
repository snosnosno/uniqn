/**
 * 채팅 안전 상태 판정 (S4) — 뮤트·차단 쪽
 */
import { chatBlockState, isChatMuted, isReportableMessage } from '../safety';
import type { ChatMessage } from '@/types/chat';

const NOW = Date.parse('2026-09-25T09:00:00Z');

describe('isChatMuted', () => {
  it("'infinity' 는 뮤트", () => {
    expect(isChatMuted('infinity', NOW)).toBe(true);
  });

  it('미래 시각은 뮤트, 지난 시각·null·해석 불가는 아님', () => {
    expect(isChatMuted('2026-09-26T00:00:00Z', NOW)).toBe(true);
    expect(isChatMuted('2026-09-24T00:00:00Z', NOW)).toBe(false);
    expect(isChatMuted(null, NOW)).toBe(false);
    expect(isChatMuted('garbage', NOW)).toBe(false);
  });
});

describe('chatBlockState', () => {
  it('차단 행이 없으면 none', () => {
    expect(chatBlockState([], 'seeker')).toBe('none');
  });

  it('내 쪽이 막았으면 mine, 상대 쪽만 막았으면 theirs', () => {
    expect(chatBlockState(['seeker'], 'seeker')).toBe('mine');
    expect(chatBlockState(['employer'], 'seeker')).toBe('theirs');
  });

  it('양쪽이 모두 막았으면 mine — 내 것은 풀 수 있고, 풀어도 상대 차단이 남는다(서버 쪽별 행)', () => {
    expect(chatBlockState(['employer', 'seeker'], 'seeker')).toBe('mine');
  });

  it('내 쪽을 모르면(메타 로딩 전) 해제 버튼을 보이지 않도록 theirs', () => {
    expect(chatBlockState(['employer'], null)).toBe('theirs');
  });
});

describe('isReportableMessage', () => {
  const base: ChatMessage = {
    id: '9b2d6f3e-1c4a-4e8b-9f1a-2b3c4d5e6f70',
    conversationId: 'c',
    senderId: 'other',
    senderSide: 'employer',
    senderDisplayName: '담당자',
    kind: 'text',
    body: '안녕하세요',
    imagePath: null,
    imageWidth: null,
    imageHeight: null,
    clientMessageId: 'x',
    createdAt: '2026-09-25T09:00:00Z',
    deletedAt: null,
  };

  it('상대 쪽의 텍스트·사진은 신고 가능', () => {
    expect(isReportableMessage(base, 'seeker')).toBe(true);
    expect(isReportableMessage({ ...base, kind: 'image', imagePath: 'p' }, 'seeker')).toBe(true);
  });

  it('내 쪽(같은 업장의 다른 담당자 포함) 메시지는 신고 불가', () => {
    expect(isReportableMessage(base, 'employer')).toBe(false);
  });

  it('삭제된 메시지·system·공지는 신고 불가', () => {
    expect(isReportableMessage({ ...base, deletedAt: '2026-09-25T10:00:00Z' }, 'seeker')).toBe(
      false
    );
    expect(isReportableMessage({ ...base, senderSide: 'system', kind: 'system' }, 'seeker')).toBe(
      false
    );
    expect(isReportableMessage({ ...base, kind: 'announcement' }, 'seeker')).toBe(false);
  });

  it('탈퇴자(발신자 없음) 메시지는 신고 불가', () => {
    expect(isReportableMessage({ ...base, senderId: null }, 'seeker')).toBe(false);
  });

  it('내 쪽을 모르면 신고 불가', () => {
    expect(isReportableMessage(base, null)).toBe(false);
  });
});
