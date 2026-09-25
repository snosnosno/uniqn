/**
 * SupabaseReportRepository — (S4) 채팅 신고 증거 스냅샷 경계
 *
 * 스냅샷은 서버 RPC 가 채워 deny-all 테이블 `chat_report_evidence` 에 둔다. 신고자가 탈퇴자 원문을 계속
 * 읽지 못하게(DB 리뷰 M1 — D5) 관리자만 `admin_get_report_evidence` RPC 로 받는다. 경계에서 zod 로 검증한다: 아는 모양이면 evidenceSnapshot 으로 싣고,
 * 모르는 모양·null·RPC 실패면 **싣지 않는다**(섹션 숨김 — 신고 상세 자체는 뜬다).
 */
import { supabase } from '@/lib/supabase';
import { SupabaseReportRepository } from '../ReportRepository';

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const selectSpy = jest.fn();

function installRowMock(
  row: Record<string, unknown> | null,
  rpcResult: { data: unknown; error: unknown } = { data: null, error: null }
) {
  (supabase.rpc as unknown as jest.Mock).mockResolvedValue(rpcResult);
  (supabase.from as unknown as jest.Mock).mockReturnValue({
    select: (...args: unknown[]) => {
      selectSpy(...args);
      return {
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: row, error: null }),
      };
    },
  });
}

const BASE_ROW = {
  id: 'report-1',
  type: 'inappropriate_behavior',
  reporter_type: 'employee',
  reporter_id: 'user-1',
  reporter_name: '구직자',
  target_id: 'user-2',
  target_name: '홀덤펍 담당자',
  job_posting_id: 'job-1',
  description: '채팅 신고',
  severity: 'high',
  status: 'pending',
  created_at: '2026-09-25T00:00:00.000Z',
  updated_at: '2026-09-25T00:00:00.000Z',
};

const SNAPSHOT = {
  source: 'chat',
  version: 1,
  conversationId: '0f8fad5b-d9cb-469f-a165-70867728950e',
  jobPostingId: 'job-1',
  postingTitle: '주말 딜러 구합니다',
  reason: 'scam',
  reportedMessageId: 'm2',
  messages: [
    {
      id: 'm1',
      senderSide: 'seeker',
      senderDisplayName: '구직자 a3bb',
      kind: 'text',
      body: '안녕하세요',
      imagePath: null,
      createdAt: '2026-09-25T09:00:00Z',
      reported: false,
    },
    {
      id: 'm2',
      senderSide: 'employer',
      senderDisplayName: '홀덤펍 담당자',
      kind: 'image',
      body: '',
      imagePath: 'conv/u/x.jpg',
      createdAt: '2026-09-25T09:01:00Z',
      reported: true,
    },
  ],
  imagePaths: ['conv/u/x.jpg'],
};

describe('SupabaseReportRepository — 채팅 신고 증거 스냅샷', () => {
  const repository = new SupabaseReportRepository();

  beforeEach(() => jest.clearAllMocks());

  it('행 조회 컬럼에 evidence_snapshot 이 없다 — 스냅샷은 reports 에 없고 RPC 로만 받는다', async () => {
    installRowMock({ ...BASE_ROW });
    await repository.getById('report-1');
    expect(String(selectSpy.mock.calls[0]?.[0]).split(',')).not.toContain('evidence_snapshot');
    expect(supabase.rpc).toHaveBeenCalledWith('admin_get_report_evidence', {
      p_report_id: 'report-1',
    });
  });

  it('채팅 스냅샷은 evidenceSnapshot 으로 싣는다', async () => {
    installRowMock({ ...BASE_ROW }, { data: SNAPSHOT, error: null });

    const report = await repository.getById('report-1');

    expect(report?.evidenceSnapshot).toEqual(SNAPSHOT);
  });

  it('null 이면 evidenceSnapshot 을 만들지 않는다', async () => {
    installRowMock({ ...BASE_ROW });
    const report = await repository.getById('report-1');
    expect(report?.evidenceSnapshot).toBeUndefined();
  });

  it('스냅샷 RPC 가 실패해도 신고 상세는 뜬다(섹션만 숨김)', async () => {
    installRowMock({ ...BASE_ROW }, { data: null, error: { message: 'boom', code: 'P0001' } });
    const report = await repository.getById('report-1');
    expect(report?.id).toBe('report-1');
    expect(report?.evidenceSnapshot).toBeUndefined();
  });

  it.each([
    ['다른 source', { ...SNAPSHOT, source: 'board' }],
    ['모르는 version', { ...SNAPSHOT, version: 2 }],
    ['messages 가 배열 아님', { ...SNAPSHOT, messages: 'x' }],
    [
      '모르는 senderSide',
      { ...SNAPSHOT, messages: [{ ...SNAPSHOT.messages[0], senderSide: 'x' }] },
    ],
    ['문자열', 'garbage'],
  ])('모르는 모양(%s)이면 싣지 않는다 — 조회 자체는 성공', async (_label, snapshot) => {
    installRowMock({ ...BASE_ROW }, { data: snapshot, error: null });

    const report = await repository.getById('report-1');

    expect(report?.id).toBe('report-1');
    expect(report?.evidenceSnapshot).toBeUndefined();
  });
});
