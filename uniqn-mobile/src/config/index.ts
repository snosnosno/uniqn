/**
 * UNIQN Mobile - 설정 배럴 Export
 *
 * @description 앱 설정 및 환경 변수
 * @version 1.0.0
 */

export {
  env,
  isFeatureEnabled,
  isEnvironment,
  runInDevelopment,
  runInProduction,
  type Environment,
  type EnvironmentConfig,
  type FirebaseConfig,
  type ApiConfig,
  type FeatureFlags,
  type LoggingConfig,
} from './env';

export {
  getNotificationConfig,
  generateDeepLink,
  isValidNotificationType,
  parseNotificationType,
  getFCMOptions,
  NOTIFICATION_CONFIG_MAP,
  type NotificationTypeConfig,
  type NotificationLinkData,
} from './notificationConfig';

export { default } from './env';
