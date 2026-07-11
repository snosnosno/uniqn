/**
 * 타입→카테고리 매핑 드리프트 가드 (M3)
 *
 * @description Edge Function(send-push-notification)의 서버 사본
 *              typeCategoryMap.ts 가 앱 SSOT(NOTIFICATION_TYPE_TO_CATEGORY)와
 *              완전히 일치하는지 강제한다. 알림 타입/카테고리 추가·변경 시
 *              양쪽을 함께 수정해야 이 테스트가 통과한다.
 */

import { NOTIFICATION_TYPE_TO_CATEGORY } from '@/types/notification';
import { TYPE_CATEGORY_MAP } from '../../../../../supabase/functions/send-push-notification/typeCategoryMap';

describe('typeCategoryMap 드리프트 가드', () => {
  it('서버 사본이 앱 SSOT와 완전히 일치한다', () => {
    expect(TYPE_CATEGORY_MAP).toEqual(NOTIFICATION_TYPE_TO_CATEGORY);
  });

  it('서버 사본에 SSOT에 없는 잉여 키가 없다', () => {
    const ssotKeys = new Set(Object.keys(NOTIFICATION_TYPE_TO_CATEGORY));
    const extraKeys = Object.keys(TYPE_CATEGORY_MAP).filter((key) => !ssotKeys.has(key));
    expect(extraKeys).toEqual([]);
  });
});
