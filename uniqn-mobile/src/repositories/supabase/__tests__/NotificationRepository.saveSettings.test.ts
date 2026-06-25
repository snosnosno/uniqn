/**
 * 회귀 가드 — 알림 설정 저장(푸시 알림 토글) upsert onConflict
 *
 * @description notification_settings 는 PK(id) + UNIQUE(user_id) 구조다.
 *   saveSettings 의 upsert 가 onConflict 를 지정하지 않으면 PostgREST 는 PK(id)
 *   기준으로 충돌을 해소한다. payload 에 id 가 없어 매번 새 id 가 생성되므로
 *   id 충돌은 절대 발생하지 않고, 대신 UNIQUE(user_id) 제약을 위반해 23505
 *   (duplicate key value violates "notification_settings_user_id_key") 로 INSERT
 *   가 실패한다. 결과적으로 설정 행이 한 번 생긴 뒤로는 모든 저장이 실패하고,
 *   설정 화면의 '푸시 알림' 토글이 되돌아간다(작동 안 함).
 *
 *   따라서 upsert 는 반드시 { onConflict: 'user_id' } 로 호출되어 기존 행을
 *   UPDATE 병합해야 한다. 이 테스트는 그 계약을 고정한다.
 */

import { SupabaseNotificationRepository } from '../NotificationRepository';
import { createDefaultNotificationSettings } from '@/types/notification';

// ── Mock Supabase ────────────────────────────────────────────────────────────
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    channel: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/utils/supabase', () => {
  const actual = jest.requireActual('@/utils/supabase');
  return {
    ...actual,
    handleSupabaseError: (error: { message?: string } | null) => {
      if (error) throw new Error(`supabase: ${error.message ?? 'unknown'}`);
    },
  };
});

// ── Helpers ──────────────────────────────────────────────────────────────────
const USER_ID = '8d5d1990-054f-4f58-80df-dcc2bc3b3925';

function makeChain(returnValue: { error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.upsert = jest.fn(() => chain);
  (chain as { then?: unknown }).then = function then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(returnValue).then(onfulfilled, onrejected);
  };
  return chain as Record<string, jest.Mock> & PromiseLike<unknown>;
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe('SupabaseNotificationRepository.saveSettings — upsert onConflict 회귀 가드', () => {
  const repo = new SupabaseNotificationRepository();

  it('notification_settings 테이블에 upsert 한다', async () => {
    const chain = makeChain({ error: null });
    mockFrom.mockReturnValue(chain);

    await repo.saveSettings(USER_ID, {
      ...createDefaultNotificationSettings(),
      pushEnabled: false,
    });

    expect(mockFrom).toHaveBeenCalledWith('notification_settings');
    expect(chain.upsert).toHaveBeenCalledTimes(1);
  });

  it('user_id UNIQUE 충돌을 병합하도록 { onConflict: "user_id" } 로 upsert 한다', async () => {
    const chain = makeChain({ error: null });
    mockFrom.mockReturnValue(chain);

    await repo.saveSettings(USER_ID, {
      ...createDefaultNotificationSettings(),
      pushEnabled: false,
    });

    const [payload, options] = (chain.upsert as jest.Mock).mock.calls[0];
    // payload 에는 user_id + push_enabled(snake_case) 가 실려야 한다.
    expect(payload).toEqual(expect.objectContaining({ user_id: USER_ID, push_enabled: false }));
    // 회귀 핵심: onConflict 누락 시 PK(id) 기준 해소 → user_id 23505. user_id 병합 필수.
    expect(options).toEqual({ onConflict: 'user_id' });
  });
});
