/**
 * 공고 일괄 공지 Repository 계약 테스트 (S3-2)
 *
 * 🚨 `supabase` 클라이언트는 `Database` 제네릭 없이 만들어져 있어 `rpc()` 이름·인자를
 *    타입이 검사하지 않는다. 오타가 나도 tsc 는 통과하고, 런타임에만 실패한다.
 *    발송은 fail-open 이 아니라 throw 하므로 최소한 조용하진 않지만, 사용자에게는
 *    "알 수 없는 오류"로 보인다 — 계약을 문자 그대로 고정해 그 상황 자체를 없앤다.
 *
 * 그리고 서버는 `'CODE: 문장'` 형태로 던지는데 postgrest 는 **에러 `code` 를 버리고
 * message 만 남긴다.** 그래서 판별이 문자열 마커에 의존한다 — 마커가 바뀌면 조용히
 * 일반 오류로 떨어지므로 여기서 고정한다.
 */
import { jobPostingAnnouncementRepository } from '../JobPostingAnnouncementRepository';

const mockRpc = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
    channel: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('JobPostingAnnouncementRepository.send', () => {
  beforeEach(() => jest.clearAllMocks());

  it('마이그 시그니처와 같은 RPC 이름·인자 키로 호출한다', async () => {
    mockRpc.mockResolvedValue({ data: 3, error: null });

    const count = await jobPostingAnnouncementRepository.send('job-1', '제목', '내용');

    // 마이그: send_job_posting_announcement(p_job_posting_id uuid, p_title text, p_body text)
    expect(mockRpc).toHaveBeenCalledWith('send_job_posting_announcement', {
      p_job_posting_id: 'job-1',
      p_title: '제목',
      p_body: '내용',
    });
    expect(count).toBe(3);
  });

  it('수신자 0명도 성공이다 — 실패로 처리하면 사장이 같은 공지를 반복해서 보낸다', async () => {
    mockRpc.mockResolvedValue({ data: 0, error: null });

    await expect(jobPostingAnnouncementRepository.send('job-1', '제목', '내용')).resolves.toBe(0);
  });

  it('RATE_LIMITED 마커를 사람이 읽을 문장으로 바꾼다', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'RATE_LIMITED: 방금 공지를 보냈어요. 잠시 후 다시 시도해주세요' },
    });

    await expect(jobPostingAnnouncementRepository.send('job-1', 'a', 'b')).rejects.toMatchObject({
      userMessage: '방금 공지를 보냈어요. 잠시 후 다시 시도해주세요.',
    });
  });

  it('PERMISSION_DENIED 마커도 사용자 문구로 바꾼다', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'PERMISSION_DENIED: 이 공고에 공지를 보낼 권한이 없습니다' },
    });

    await expect(jobPostingAnnouncementRepository.send('job-1', 'a', 'b')).rejects.toMatchObject({
      userMessage: '이 공고에 공지를 보낼 권한이 없습니다.',
    });
  });

  it('VALIDATION_FAILED 는 서버 문장을 쓰되 코드 접두사는 벗긴다', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'VALIDATION_FAILED: 제목은 50자 이내로 입력해주세요' },
    });

    await expect(jobPostingAnnouncementRepository.send('job-1', 'a', 'b')).rejects.toMatchObject({
      userMessage: '제목은 50자 이내로 입력해주세요',
    });
  });
});
