/**
 * UNIQN Mobile - 딥링크 Shared 모듈
 *
 * @description 딥링크 관련 타입, 라우트, 매핑 유틸리티
 * @version 2.0.0
 */

// Types
export type { DeepLinkRoute, ParsedDeepLink, NavigationContext, RouteGroup } from './types';
export { ROUTE_GROUPS } from './types';

// Route Registry
export {
  EXPO_ROUTES,
  AUTH_REQUIRED_ROUTES,
  EMPLOYER_REQUIRED_ROUTES,
  ADMIN_REQUIRED_ROUTES,
  type ExpoRouteName,
} from './RouteRegistry';

// Chat Route (파서·알림 매핑 공용 규칙)
export { toChatRoute } from './chatRoute';

// Route Mapper
export { RouteMapper } from './RouteMapper';

// Notification Route Map
export {
  NOTIFICATION_ROUTE_MAP,
  getRouteForNotificationType,
  isAdminOnlyNotification,
  isEmployerOnlyNotification,
} from './NotificationRouteMap';
