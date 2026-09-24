/**
 * 채팅 상수 ↔ S1 마이그 정합 가드
 *
 * 클라 상수를 숫자로만 고정하면 서버 값이 바뀔 때 같이 초록으로 남는다.
 * 마이그 원문을 읽어 버킷 id·용량 한도·본문 상한을 대조한다.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CHAT_MAX_UPLOAD_BYTES,
  CHAT_MEDIA_BUCKET,
  CHAT_MESSAGE_MAX_LENGTH,
  CHAT_SIGNED_URL_TTL_SEC,
} from '@/constants/chat';

const MIGRATION = readFileSync(
  join(__dirname, '../../../supabase/migrations/20260925100000_chat_schema_and_rpcs.sql'),
  'utf8'
);

describe('채팅 상수', () => {
  it('버킷 id 는 chat-media 이고 구 chat 버킷이 아니다', () => {
    expect(CHAT_MEDIA_BUCKET).toBe('chat-media');
    expect(CHAT_MEDIA_BUCKET).not.toBe('chat');
  });

  it('버킷 id·용량 한도가 S1 마이그의 storage.buckets INSERT 와 같다', () => {
    const match = MIGRATION.match(
      /INSERT INTO storage\.buckets[^;]*VALUES \('([^']+)', '[^']+', false, (\d+),/
    );
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe(CHAT_MEDIA_BUCKET);
    expect(Number(match?.[2])).toBe(CHAT_MAX_UPLOAD_BYTES);
  });

  it('본문 상한이 서버 CHECK(1~1000자)와 같다', () => {
    expect(MIGRATION).toContain(`char_length(body) BETWEEN 1 AND ${CHAT_MESSAGE_MAX_LENGTH}`);
  });

  it('서명 URL TTL 은 5분이다(보안 리뷰 L9)', () => {
    expect(CHAT_SIGNED_URL_TTL_SEC).toBe(300);
  });
});
