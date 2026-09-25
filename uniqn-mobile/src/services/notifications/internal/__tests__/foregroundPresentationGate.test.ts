/**
 * foregroundPresentationGate (M3) 테스트
 *
 * @description 전체/카테고리 설정에 따른 포그라운드 표시 억제와 fail-open 계약을 잠근다.
 */

import { resolveForegroundPresentation } from '../foregroundPresentationGate';
import { NotificationCategory } from '@/types/notification';
import type { NotificationSettings } from '@/types/notification';

function makeSettings(overrides: Partial<NotificationSettings> = {}): NotificationSettings {
  const categories = Object.fromEntries(
    Object.values(NotificationCategory).map((category) => [
      category,
      { enabled: true, pushEnabled: true },
    ])
  ) as NotificationSettings['categories'];

  return {
    enabled: true,
    pushEnabled: true,
    categories,
    ...overrides,
  };
}

describe('resolveForegroundPresentation', () => {
  it('설정이 없으면 표시한다 (fail-open)', () => {
    expect(resolveForegroundPresentation('new_application', null).shouldShowBanner).toBe(true);
    expect(resolveForegroundPresentation('new_application', undefined).shouldShowAlert).toBe(true);
  });

  it('전체 알림(enabled)이 꺼져 있으면 배너/사운드를 억제하고 목록·뱃지는 유지한다', () => {
    const result = resolveForegroundPresentation(
      'new_application',
      makeSettings({ enabled: false })
    );

    expect(result.shouldShowAlert).toBe(false);
    expect(result.shouldPlaySound).toBe(false);
    expect(result.shouldShowBanner).toBe(false);
    expect(result.shouldShowList).toBe(true);
    expect(result.shouldSetBadge).toBe(true);
  });

  it('해당 카테고리가 꺼져 있으면 억제한다', () => {
    const settings = makeSettings();
    settings.categories[NotificationCategory.APPLICATION] = {
      enabled: false,
      pushEnabled: false,
    };

    // new_application → application 카테고리
    const result = resolveForegroundPresentation('new_application', settings);
    expect(result.shouldShowBanner).toBe(false);
    expect(result.shouldShowList).toBe(true);
  });

  it('다른 카테고리 알림은 억제하지 않는다', () => {
    const settings = makeSettings();
    settings.categories[NotificationCategory.APPLICATION] = {
      enabled: false,
      pushEnabled: false,
    };

    // settlement_completed → settlement 카테고리 (application 아님)
    expect(resolveForegroundPresentation('settlement_completed', settings).shouldShowBanner).toBe(
      true
    );
  });

  it('타입 부재/미매핑이면 표시한다 (fail-open)', () => {
    const settings = makeSettings();
    expect(resolveForegroundPresentation(undefined, settings).shouldShowBanner).toBe(true);
    expect(resolveForegroundPresentation(123, settings).shouldShowBanner).toBe(true);
    expect(resolveForegroundPresentation('unknown_future_type', settings).shouldShowBanner).toBe(
      true
    );
  });
});

describe('resolveForegroundPresentation — 보고 있는 채팅방 (S3)', () => {
  const CONV = '11111111-1111-4111-8111-111111111111';
  const OTHER = '33333333-3333-4333-8333-333333333333';
  const viewing = (id: string) => id.toLowerCase() === CONV;

  it('지금 보고 있는 방의 채팅 푸시는 배너·소리·목록·배지 모두 끈다', () => {
    const result = resolveForegroundPresentation('chat_message', makeSettings(), {
      conversationId: CONV,
      isViewingConversation: viewing,
    });
    expect(result).toEqual({
      shouldShowAlert: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: false,
    });
  });

  it('대소문자만 다른 같은 방도 삼킨다(술어가 정규화)', () => {
    expect(
      resolveForegroundPresentation('chat_message', makeSettings(), {
        conversationId: CONV.toUpperCase(),
        isViewingConversation: viewing,
      }).shouldShowBanner
    ).toBe(false);
  });

  it('다른 방의 채팅 푸시는 표시한다', () => {
    expect(
      resolveForegroundPresentation('chat_message', makeSettings(), {
        conversationId: OTHER,
        isViewingConversation: viewing,
      }).shouldShowBanner
    ).toBe(true);
  });

  it('방 id 가 없거나 술어가 없으면 표시한다(fail-open)', () => {
    expect(
      resolveForegroundPresentation('chat_message', makeSettings(), {
        conversationId: undefined,
        isViewingConversation: viewing,
      }).shouldShowBanner
    ).toBe(true);
    expect(
      resolveForegroundPresentation('chat_message', makeSettings(), { conversationId: CONV })
        .shouldShowBanner
    ).toBe(true);
  });

  it('채팅이 아닌 알림은 방 id 가 같아도 삼키지 않는다', () => {
    expect(
      resolveForegroundPresentation('new_application', makeSettings(), {
        conversationId: CONV,
        isViewingConversation: viewing,
      }).shouldShowBanner
    ).toBe(true);
  });
});
