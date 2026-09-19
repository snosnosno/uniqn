/**
 * 신고 스키마 — 증빙(evidenceUrls) 검증 테스트
 *
 * 증빙은 비공개 버킷의 Storage 경로로 저장된다. 여기서 잠그는 것:
 *  (1) 경로 첫 세그먼트가 업로더 uid(uuid) 여야 한다 — Storage RLS 와 같은 축
 *  (2) 장수 상한은 `REPORT_EVIDENCE_LIMITS.MAX_COUNT` 하나만 본다(로컬 복제 금지)
 *  (3) 경로 탈출(`..`)과 위험 스킴(javascript:)은 거부
 *  (4) 과거 데이터의 http(s) 절대 URL 은 계속 통과
 */

import {
  createReportInputSchema,
  reportEvidenceRefSchema,
  uploadReportEvidenceSchema,
} from '../report.schema';
import { REPORT_EVIDENCE_LIMITS } from '@/types/report';

const UPLOADER_UID = '11111111-2222-3333-4444-555555555555';
const VALID_PATH = `${UPLOADER_UID}/sub-1/1700000000000-abcd1234.jpg`;
const MAX_COUNT = REPORT_EVIDENCE_LIMITS.MAX_COUNT;

/** 증빙 참조 1건이 통과하는지 */
function refOk(value: string): boolean {
  return reportEvidenceRefSchema.safeParse(value).success;
}

function buildInput(evidenceUrls?: string[]) {
  return {
    type: 'no_show' as const,
    reporterType: 'employer' as const,
    targetId: 'staff-1',
    targetName: '홍길동',
    jobPostingId: 'job-1',
    description: '연락 없이 근무에 나오지 않았습니다.',
    ...(evidenceUrls ? { evidenceUrls } : {}),
  };
}

function parseInput(evidenceUrls?: string[]) {
  return createReportInputSchema.safeParse(buildInput(evidenceUrls));
}

function parseUpload(files: unknown[]) {
  return uploadReportEvidenceSchema.safeParse({ files });
}

/** n장의 유효한 증빙 경로 생성 */
function makePaths(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${UPLOADER_UID}/sub-1/17000000000${i}-aaaa.jpg`);
}

describe('reportEvidenceRefSchema', () => {
  it('업로더 uid 로 시작하는 Storage 경로를 통과시킨다', () => {
    expect(refOk(VALID_PATH)).toBe(true);
    expect(refOk(`${UPLOADER_UID}/sub-1/1700000000000-abcd1234.png`)).toBe(true);
    expect(refOk(`${UPLOADER_UID}/sub-1/1700000000000-abcd1234.webp`)).toBe(true);
  });

  it('첫 세그먼트가 uid 가 아니면 거부한다 (Storage RLS 축과 어긋남)', () => {
    expect(refOk('reports/sub-1/a.jpg')).toBe(false);
  });

  it('허용 확장자가 아니면 거부한다', () => {
    expect(refOk(`${UPLOADER_UID}/sub-1/a.pdf`)).toBe(false);
  });

  it('상위 디렉터리 참조(..)를 거부한다', () => {
    expect(refOk(`${UPLOADER_UID}/../other/a.jpg`)).toBe(false);
  });

  it('위험 스킴을 거부한다', () => {
    expect(refOk('javascript:alert(1)')).toBe(false);
  });

  it('과거 데이터의 http(s) 절대 URL 은 계속 통과시킨다', () => {
    expect(refOk('https://example.com/evidence.jpg')).toBe(true);
  });
});

describe('createReportInputSchema.evidenceUrls', () => {
  it('증빙이 없어도 통과한다 (선택 항목)', () => {
    expect(parseInput().success).toBe(true);
    expect(parseInput([]).success).toBe(true);
  });

  it('상한 장수까지 통과하고, 한 장 더 넘으면 거부한다', () => {
    expect(parseInput(makePaths(MAX_COUNT)).success).toBe(true);
    expect(parseInput(makePaths(MAX_COUNT + 1)).success).toBe(false);
  });

  it('잘못된 증빙 참조가 하나라도 섞이면 전체를 거부한다', () => {
    expect(parseInput([VALID_PATH, 'javascript:alert(1)']).success).toBe(false);
  });

  it('통과한 증빙 경로는 그대로 보존된다 (RPC 로 넘길 값)', () => {
    const result = parseInput([VALID_PATH]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.evidenceUrls).toEqual([VALID_PATH]);
    }
  });
});

describe('uploadReportEvidenceSchema', () => {
  const file = {
    uri: 'file:///evidence-1.jpg',
    mime: 'image/jpeg',
    size: 1024,
    fileName: 'evidence-1.jpg',
  };

  it('빈 배열은 거부한다 (올릴 것이 없으면 호출하면 안 된다)', () => {
    expect(parseUpload([]).success).toBe(false);
  });

  it('상한 장수를 넘기면 거부한다', () => {
    const overLimit = Array.from({ length: MAX_COUNT + 1 }, () => file);
    expect(parseUpload(overLimit).success).toBe(false);
  });

  it('허용 MIME 이 아니면 거부한다 (버킷 allowed_mime_types 와 같은 축)', () => {
    expect(parseUpload([{ ...file, mime: 'image/gif' }]).success).toBe(false);
  });

  it('장당 용량 상한을 넘기면 거부한다', () => {
    const tooBig = { ...file, size: REPORT_EVIDENCE_LIMITS.MAX_SIZE_BYTES + 1 };
    expect(parseUpload([tooBig]).success).toBe(false);
  });
});
