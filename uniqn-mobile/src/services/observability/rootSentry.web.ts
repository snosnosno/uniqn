interface RootSentryOptions {
  dsn: string;
  enabled: boolean;
  environment: string;
}

export function initializeRootSentry(_options: RootSentryOptions): void {
  // Web builds use the lightweight sentryService.web fallback instead of the native SDK.
}

export default initializeRootSentry;
