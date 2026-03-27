const {
  classifyFailedRequestEntry,
  finalizeDiagnosticsBucket,
} = require('../live-verify-diagnostics');

describe('live verify diagnostics helpers', () => {
  it('ignores known aborted requests and keeps unexpected failures actionable', () => {
    const bucket = {
      console: [
        { text: 'Auth store hydration timed out', count: 2 },
        { text: '원격 버전 설정 문서 없음', count: 1 },
      ],
      failedRequests: [
        {
          url: 'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?t=1',
          method: 'GET',
          failure: { errorText: 'net::ERR_ABORTED' },
          count: 3,
        },
        {
          url: 'https://www.google-analytics.com/g/collect?v=2',
          method: 'POST',
          failure: { errorText: 'net::ERR_ABORTED' },
          count: 1,
        },
        {
          url: 'https://example.com/api/jobs',
          method: 'GET',
          failure: { errorText: 'net::ERR_FAILED' },
          count: 1,
        },
      ],
    };

    const finalized = finalizeDiagnosticsBucket(bucket);

    expect(finalized.ignoredAbortedRequests).toHaveLength(2);
    expect(finalized.actionableFailedRequests).toHaveLength(1);
    expect(finalized.actionableFailedRequests[0].host).toBe('example.com');
    expect(finalized.summary).toMatchObject({
      hydrationTimeoutCount: 2,
      versionWarningCount: 1,
      ignoredAbortedRequestCount: 2,
      actionableFailedRequestCount: 1,
    });
  });

  it('classifies securetoken aborts as ignored', () => {
    expect(
      classifyFailedRequestEntry({
        url: 'https://securetoken.googleapis.com/v1/token?key=test',
        method: 'POST',
        failure: { errorText: 'net::ERR_ABORTED' },
      })
    ).toMatchObject({
      classification: 'ignored',
      reason: 'securetoken-refresh-aborted',
      host: 'securetoken.googleapis.com',
    });
  });
});
