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

export {
  SENSITIVE_STORAGE_KEYS,
  KNOWN_STORAGE_KEYS,
  TOKEN_CONFIG,
  PASSWORD_POLICY,
  RATE_LIMIT_CONFIG,
  isSensitiveKey,
  type SensitiveStorageKey,
} from './securityConfig';

export { default } from './env';
