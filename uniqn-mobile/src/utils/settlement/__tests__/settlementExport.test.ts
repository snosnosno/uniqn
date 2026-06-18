/**
 * buildSettlementCsv 단위 테스트
 *
 * 사업주 세무/정산 증빙용 CSV 생성. 금액은 GroupedSettlement.summary.totalAmount
 * (세후 canonical)를 그대로 사용하고, 쉼표/따옴표 이스케이프·기간 포맷·상태 라벨을 검증.
 */
import { buildSettlementCsv } from '../settlementExport';
import type { GroupedSettlement } from '@/types/settlement';

function makeGroup(overrides: Partial<GroupedSettlement> = {}): GroupedSettlement {
  return {
    id: 'grouped_settlement_s1',
    staffId: 's1',
    jobPostingId: 'jp1',
    staffProfile: { name: '홍길동' },
    dateRange: {
      start: '2026-06-01',
      end: '2026-06-03',
      dates: ['2026-06-01', '2026-06-02', '2026-06-03'],
      totalDays: 3,
      isConsecutive: true,
    },
    roles: ['딜러'],
    dateStatuses: [],
    originalWorkLogs: [],
    summary: {
      totalCount: 3,
      pendingCount: 0,
      completedCount: 3,
      totalAmount: 300000,
      pendingAmount: 0,
      completedAmount: 300000,
      settlableCount: 0,
    },
    overallStatus: 'all_completed',
    ...overrides,
  } as GroupedSettlement;
}

describe('buildSettlementCsv', () => {
  it('헤더 + 행을 CRLF 로 구성하고 BOM 을 앞에 붙인다', () => {
    const csv = buildSettlementCsv([makeGroup()]);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(lines[0]).toBe('스태프,근무기간,근무일수,역할,정산상태,총정산액(원)');
    expect(lines[1]).toBe('홍길동,2026-06-01~2026-06-03,3,딜러,정산완료,300000');
  });

  it('단일 날짜는 기간을 한 날짜로 표기한다', () => {
    const csv = buildSettlementCsv([
      makeGroup({
        dateRange: {
          start: '2026-06-01',
          end: '2026-06-01',
          dates: ['2026-06-01'],
          totalDays: 1,
          isConsecutive: true,
        },
      }),
    ]);
    expect(csv).toContain('2026-06-01,1,');
    expect(csv).not.toContain('2026-06-01~2026-06-01');
  });

  it('상태 라벨을 한글로 매핑한다', () => {
    expect(buildSettlementCsv([makeGroup({ overallStatus: 'all_pending' })])).toContain(',미정산,');
    expect(buildSettlementCsv([makeGroup({ overallStatus: 'partial' })])).toContain(',일부 정산,');
  });

  it('쉼표·따옴표가 든 이름은 CSV 이스케이프한다', () => {
    const csv = buildSettlementCsv([makeGroup({ staffProfile: { name: '김,"민수"' } })]);
    expect(csv).toContain('"김,""민수"""');
  });

  it('이름이 없으면 닉네임 → staffId 순으로 대체한다', () => {
    expect(buildSettlementCsv([makeGroup({ staffProfile: { nickname: '닉네임' } })])).toContain(
      '닉네임,'
    );
    expect(buildSettlementCsv([makeGroup({ staffProfile: {} })])).toContain('s1,');
  });

  it('여러 역할은 / 로 합친다', () => {
    expect(buildSettlementCsv([makeGroup({ roles: ['딜러', '플로어'] })])).toContain(
      '딜러 / 플로어'
    );
  });
});
