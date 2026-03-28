const MAX_DIAGNOSTIC_EVENTS = 120;

function normalizeText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function pushLimited(collection, item, key, limit = MAX_DIAGNOSTIC_EVENTS) {
  const existing = collection.find((entry) => entry.key === key);
  if (existing) {
    existing.count += 1;
    existing.lastSeenAt = new Date().toISOString();
    return;
  }

  if (collection.length >= limit) {
    return;
  }

  collection.push({
    ...item,
    key,
    count: 1,
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  });
}

function createDiagnosticsBucket(initial = {}) {
  return {
    console: [],
    failedRequests: [],
    ignoredAbortedRequests: [],
    actionableFailedRequests: [],
    summary: {
      consoleCount: 0,
      failedRequestCount: 0,
      ignoredAbortedRequestCount: 0,
      actionableFailedRequestCount: 0,
      hydrationTimeoutCount: 0,
      versionWarningCount: 0,
    },
    ...initial,
  };
}

function parseUrlParts(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.host,
      pathname: parsed.pathname,
    };
  } catch {
    return {
      host: 'unknown',
      pathname: '',
    };
  }
}

function classifyFailedRequestEntry(entry) {
  const errorText = entry?.failure?.errorText ?? 'unknown';
  const { host, pathname } = parseUrlParts(entry?.url ?? '');

  if (errorText === 'net::ERR_ABORTED') {
    if (
      host === 'firestore.googleapis.com' &&
      pathname.includes('/google.firestore.v1.Firestore/Listen/channel')
    ) {
      return {
        classification: 'ignored',
        reason: 'firestore-listen-aborted',
        host,
        pathname,
      };
    }

    if (
      host === 'firestore.googleapis.com' &&
      pathname.includes('/google.firestore.v1.Firestore/Write/channel')
    ) {
      return {
        classification: 'ignored',
        reason: 'firestore-write-aborted',
        host,
        pathname,
      };
    }

    if (host === 'www.google-analytics.com' && pathname === '/g/collect') {
      return {
        classification: 'ignored',
        reason: 'analytics-collect-aborted',
        host,
        pathname,
      };
    }

    if (host === 'securetoken.googleapis.com' && pathname === '/v1/token') {
      return {
        classification: 'ignored',
        reason: 'securetoken-refresh-aborted',
        host,
        pathname,
      };
    }

    if (host === 'firebase.googleapis.com' && pathname.includes('/webConfig')) {
      return {
        classification: 'ignored',
        reason: 'firebase-web-config-aborted',
        host,
        pathname,
      };
    }
  }

  return {
    classification: 'actionable',
    reason: 'unexpected-request-failure',
    host,
    pathname,
  };
}

function cloneFailedEntry(entry, classification) {
  return {
    ...entry,
    classification: classification.classification,
    classificationReason: classification.reason,
    host: classification.host,
    pathname: classification.pathname,
  };
}

function summarizeConsoleEntries(entries) {
  return {
    hydrationTimeoutCount: entries
      .filter((entry) => String(entry.text).includes('Auth store hydration timed out'))
      .reduce((total, entry) => total + (entry.count || 1), 0),
    versionWarningCount: entries
      .filter((entry) => String(entry.text).includes('원격 버전 설정 문서 없음'))
      .reduce((total, entry) => total + (entry.count || 1), 0),
  };
}

function finalizeDiagnosticsBucket(bucket) {
  const ignoredAbortedRequests = [];
  const actionableFailedRequests = [];

  for (const failedRequest of bucket.failedRequests || []) {
    const classification = classifyFailedRequestEntry(failedRequest);
    const classifiedEntry = cloneFailedEntry(failedRequest, classification);

    if (classification.classification === 'ignored') {
      ignoredAbortedRequests.push(classifiedEntry);
    } else {
      actionableFailedRequests.push(classifiedEntry);
    }
  }

  const consoleSummary = summarizeConsoleEntries(bucket.console || []);

  return {
    ...bucket,
    ignoredAbortedRequests,
    actionableFailedRequests,
    summary: {
      consoleCount: (bucket.console || []).length,
      failedRequestCount: (bucket.failedRequests || []).length,
      ignoredAbortedRequestCount: ignoredAbortedRequests.length,
      actionableFailedRequestCount: actionableFailedRequests.length,
      hydrationTimeoutCount: consoleSummary.hydrationTimeoutCount,
      versionWarningCount: consoleSummary.versionWarningCount,
    },
  };
}

function finalizeDiagnosticsReport(diagnostics) {
  const nextDiagnostics = {};
  const summary = {};

  for (const [section, bucket] of Object.entries(diagnostics)) {
    if (section === 'summary') {
      continue;
    }

    nextDiagnostics[section] = finalizeDiagnosticsBucket(bucket);
    summary[section] = nextDiagnostics[section].summary;
  }

  nextDiagnostics.summary = summary;
  return nextDiagnostics;
}

async function attachDiagnostics(page, bucket) {
  page.on('dialog', (dialog) => {
    pushLimited(
      bucket.console,
      {
        type: 'dialog',
        text: `${dialog.type()}: ${normalizeText(dialog.message())}`,
      },
      `dialog:${dialog.type()}:${normalizeText(dialog.message())}`
    );

    void dialog.accept().catch(() => {});
  });

  page.on('console', (message) => {
    const text = normalizeText(message.text());
    if (!text) {
      return;
    }

    pushLimited(
      bucket.console,
      {
        type: message.type(),
        text,
      },
      `${message.type()}:${text}`
    );
  });

  page.on('requestfailed', (request) => {
    const failure = request.failure();
    const key = `${request.method()}:${request.url()}:${failure?.errorText ?? 'unknown'}`;

    pushLimited(
      bucket.failedRequests,
      {
        url: request.url(),
        method: request.method(),
        failure,
      },
      key
    );
  });
}

module.exports = {
  MAX_DIAGNOSTIC_EVENTS,
  normalizeText,
  pushLimited,
  createDiagnosticsBucket,
  classifyFailedRequestEntry,
  finalizeDiagnosticsBucket,
  finalizeDiagnosticsReport,
  attachDiagnostics,
};
