import * as Sentry from '@sentry/react-native';
import {
  applyRedactToBreadcrumb,
  applyRedactToEvent,
  applyRedactToTransaction,
} from './sentryRedact';

interface RootSentryOptions {
  dsn: string;
  enabled: boolean;
  environment: string;
}

export function initializeRootSentry({ dsn, enabled, environment }: RootSentryOptions): void {
  Sentry.init({
    dsn,
    enabled,
    environment,
    tracesSampleRate: 0.2,
    enableNativeCrashHandling: enabled,
    enableNative: enabled,
    beforeSend: applyRedactToEvent,
    beforeSendTransaction: applyRedactToTransaction,
    beforeBreadcrumb: applyRedactToBreadcrumb,
  });
}
