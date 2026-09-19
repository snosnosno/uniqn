/**
 * SupabaseReportRepository — 증빙(evidence) 경계 테스트
 *
 * 잠그는 것:
 *  (1) 🔑 `evidence_urls` 캐멀 변환 린치핀 — `toCamelCase` 는 KNOWN_ACRONYMS 규칙 때문에
 *      `evidenceURLs` 를 만든다. `Report.evidenceUrls` 로 정규화하지 않으면 증빙이 영원히
 *      undefined 라 화면에 안 뜬다. 캐스팅이라 tsc 는 못 잡는다 → 여기서 값으로 확인한다.
 *  (2) 업로드 경로 첫 세그먼트가 업로더 uid (Storage RLS `foldername(name)[1] = auth.uid()` 축)
 *  (3) 한 번의 제출은 한 폴더에 모인다
 *  (4) 부분 업로드 실패 시 **삭제 롤백을 하지 않는다**(증빙 버킷 DELETE 는 관리자 전용)
 */

import { supabase } from '@/lib/supabase';
import { SupabaseReportRepository } from '../ReportRepository';

jest.mock('@/utils/generateId', () => ({
  generateId: jest.fn(() => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'),
}));

const UPLOADER_UID = '11111111-2222-3333-4444-555555555555';
const SUBMISSION_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const mockUpload = jest.fn();
const mockRemove = jest.fn();
const mockCreateSignedUrl = jest.fn();

/** jest.setup.js 의 supabase mock 에는 storage 가 없다 — 이 스위트에서 주입한다. */
function installStorageMock() {
  (supabase as unknown as { storage: unknown }).storage = {
    from: jest.fn(() => ({
      upload: mockUpload,
      remove: mockRemove,
      createSignedUrl: mockCreateSignedUrl,
    })),
  };
}

function installRowMock(row: Record<string, unknown> | null) {
  (supabase.from as unknown as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: row, error: null }),
  });
}

const BASE_ROW = {
  id: 'report-1',
  type: 'no_show',
  reporter_type: 'employer',
  reporter_id: 'user-1',
  reporter_name: '사장님',
  target_id: 'staff-1',
  target_name: '홍길동',
  job_posting_id: 'job-1',
  description: '연락 없이 결근',
  severity: 'critical',
  status: 'pending',
  created_at: '2026-08-02T00:00:00.000Z',
  updated_at: '2026-08-02T00:00:00.000Z',
};

describe('SupabaseReportRepository — 증빙', () => {
  let repository: SupabaseReportRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new SupabaseReportRepository();
    installStorageMock();
    global.fetch = jest.fn().mockResolvedValue({
      blob: jest.fn().mockResolvedValue({ size: 1024 }),
    }) as unknown as typeof fetch;
  });

  describe('getById — evidence_urls 캐멀 정규화 (린치핀)', () => {
    it('evidence_urls 를 evidenceUrls 로 읽어낸다 (evidenceURLs 로 새지 않는다)', async () => {
      const paths = [`${UPLOADER_UID}/${SUBMISSION_ID}/1700000000000-abcd1234.jpg`];
      installRowMock({ ...BASE_ROW, evidence_urls: paths });

      const report = await repository.getById('report-1');

      expect(report?.evidenceUrls).toEqual(paths);
      expect(report as unknown as Record<string, unknown>).not.toHaveProperty('evidenceURLs');
    });

    it('증빙이 null 이면 evidenceUrls 를 만들지 않는다', async () => {
      installRowMock({ ...BASE_ROW, evidence_urls: null });

      const report = await repository.getById('report-1');

      expect(report?.evidenceUrls).toBeUndefined();
    });
  });

  describe('uploadEvidence', () => {
    it('경로 첫 세그먼트는 업로더 uid, 한 제출은 한 폴더에 모인다', async () => {
      mockUpload.mockResolvedValue({ error: null });

      const paths = await repository.uploadEvidence(UPLOADER_UID, [
        { uri: 'file:///a.jpg', mime: 'image/jpeg', size: 1024 },
        { uri: 'file:///b.png', mime: 'image/png', size: 2048 },
      ]);

      expect(paths).toHaveLength(2);
      for (const path of paths) {
        expect(path.startsWith(`${UPLOADER_UID}/${SUBMISSION_ID}/`)).toBe(true);
      }
      expect(paths[0].endsWith('.jpg')).toBe(true);
      expect(paths[1].endsWith('.png')).toBe(true);
    });

    it('빈 배열이면 Storage 를 건드리지 않는다', async () => {
      const paths = await repository.uploadEvidence(UPLOADER_UID, []);

      expect(paths).toEqual([]);
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('부분 실패 시 던지고, 이미 올린 파일을 지우지 않는다 (증빙 삭제는 관리자 전용)', async () => {
      mockUpload
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: { message: 'quota exceeded' } });

      await expect(
        repository.uploadEvidence(UPLOADER_UID, [
          { uri: 'file:///a.jpg', mime: 'image/jpeg', size: 1024 },
          { uri: 'file:///b.jpg', mime: 'image/jpeg', size: 1024 },
        ])
      ).rejects.toThrow();

      expect(mockRemove).not.toHaveBeenCalled();
    });
  });

  describe('getSignedEvidenceUrl', () => {
    it('서명 URL 을 반환한다', async () => {
      mockCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://signed.example/x.jpg?token=1' },
        error: null,
      });

      await expect(repository.getSignedEvidenceUrl('p/a/b.jpg')).resolves.toBe(
        'https://signed.example/x.jpg?token=1'
      );
    });

    it('발급 실패 시 던진다 (조용히 빈 값 반환 금지)', async () => {
      mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: 'not found' } });

      await expect(repository.getSignedEvidenceUrl('p/a/b.jpg')).rejects.toThrow();
    });
  });
});
