import { formatBulkSettlementFailures } from '@/utils/settlementFailureMessage';

const failure = (workLogId: string) => ({
  success: false,
  workLogId,
  amount: 0,
  message: '정산 실패',
});
const success = (workLogId: string) => ({
  success: true,
  workLogId,
  amount: 100000,
  message: 'ok',
});

describe('formatBulkSettlementFailures', () => {
  it('실패가 없으면 null을 반환한다', () => {
    expect(
      formatBulkSettlementFailures({ failedCount: 0, results: [success('w1')] }, new Map())
    ).toBeNull();
  });

  it('이름을 찾으면 실패자 이름을 나열한다', () => {
    const names = new Map([
      ['w1', '김딜러'],
      ['w2', '이서빙'],
    ]);
    expect(
      formatBulkSettlementFailures(
        { failedCount: 2, results: [failure('w1'), failure('w2'), success('w3')] },
        names
      )
    ).toBe('2건 정산 실패 — 김딜러, 이서빙');
  });

  it('이름은 최대 3명까지 표시하고 나머지는 외 N건으로 줄인다', () => {
    const names = new Map([
      ['w1', '가'],
      ['w2', '나'],
      ['w3', '다'],
      ['w4', '라'],
    ]);
    expect(
      formatBulkSettlementFailures(
        {
          failedCount: 4,
          results: [failure('w1'), failure('w2'), failure('w3'), failure('w4')],
        },
        names
      )
    ).toBe('4건 정산 실패 — 가, 나, 다 외 1건');
  });

  it('이름을 하나도 못 찾으면 건수만 표시한다 (results가 비어도 동일)', () => {
    expect(formatBulkSettlementFailures({ failedCount: 1, results: [] }, new Map())).toBe(
      '1건 정산 실패'
    );
    expect(
      formatBulkSettlementFailures({ failedCount: 1, results: [failure('w1')] }, new Map())
    ).toBe('1건 정산 실패');
  });
});
