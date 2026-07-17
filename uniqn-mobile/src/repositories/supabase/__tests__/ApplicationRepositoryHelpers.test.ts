/**
 * ApplicationRepositoryHelpers 테스트
 *
 * Supabase null → undefined 변환 검증:
 * Supabase는 DB의 빈 optional 필드를 null로 반환하지만 Zod optional은 undefined를 기대함.
 */

import { toApplication, toJobPosting, JOB_POSTING_COLUMNS } from '../ApplicationRepositoryHelpers';
import { TABLE_COLUMNS } from '../JobPostingRepositoryHelpers';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const mockParseApplication = jest.fn();
const mockParseJobPosting = jest.fn();

jest.mock('@/schemas', () => ({
  parseApplicationDocument: (...args: unknown[]) => mockParseApplication(...args),
  parseJobPostingDocument: (...args: unknown[]) => mockParseJobPosting(...args),
}));

jest.mock('@/utils/supabase', () => ({
  toCamelCase: <T>(x: T) => x,
}));

describe('toApplication — null → undefined 변환', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParseApplication.mockImplementation((data) => (data.id ? data : null));
  });

  it('null 필드를 undefined로 변환한 뒤 Zod parse에 전달', () => {
    toApplication({ id: 'app-1', status: 'applied', notes: null, message: null });
    const arg = mockParseApplication.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.notes).toBeUndefined();
    expect(arg.message).toBeUndefined();
  });

  it('id는 row.id로 유지 (camelCase 변환 후에도 덮어쓰기)', () => {
    toApplication({ id: 'app-2', status: 'applied' });
    const arg = mockParseApplication.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.id).toBe('app-2');
  });

  it('null이 아닌 값은 보존', () => {
    toApplication({ id: 'app-3', status: 'confirmed', notes: '메모' });
    const arg = mockParseApplication.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.notes).toBe('메모');
  });

  it('parseApplicationDocument가 null 반환 시 null 그대로 반환', () => {
    mockParseApplication.mockReturnValueOnce(null);
    const result = toApplication({ id: 'app-4', status: 'applied' });
    expect(result).toBeNull();
  });
});

describe('toJobPosting — null → undefined 변환', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParseJobPosting.mockImplementation((data) => (data.id ? data : null));
  });

  it('null JSONB 필드를 undefined로 변환', () => {
    toJobPosting({ id: 'jp-1', title: '테스트', dates: null, requirements: null });
    const arg = mockParseJobPosting.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.dates).toBeUndefined();
    expect(arg.requirements).toBeUndefined();
  });

  it('id 보존', () => {
    toJobPosting({ id: 'jp-2', title: '테스트' });
    const arg = mockParseJobPosting.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.id).toBe('jp-2');
  });
});

describe('JOB_POSTING_COLUMNS — 정본 TABLE_COLUMNS 동기화 가드 (whitelist-silent-drop 재발 방지)', () => {
  it('정본 TABLE_COLUMNS 와 동일한 컬럼 화이트리스트를 참조한다 (드리프트 금지)', () => {
    expect(JOB_POSTING_COLUMNS).toBe(TABLE_COLUMNS);
  });

  it('conditions·venue_id 를 SELECT 화이트리스트에 포함한다 (읽기 증발 방지)', () => {
    const cols = JOB_POSTING_COLUMNS.split(',');
    expect(cols).toContain('conditions');
    expect(cols).toContain('venue_id');
  });

  it('정본에서 제거된 컬럼(last_work_date·og_image_url·rejection_reason)을 SELECT 하지 않는다', () => {
    const cols = JOB_POSTING_COLUMNS.split(',');
    expect(cols).not.toContain('last_work_date');
    expect(cols).not.toContain('og_image_url');
    expect(cols).not.toContain('rejection_reason');
  });
});
