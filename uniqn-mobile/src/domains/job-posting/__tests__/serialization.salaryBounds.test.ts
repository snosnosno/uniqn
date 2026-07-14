/**
 * 급여 필터(P3) 쓰기 경로 — getSalaryBounds / serializeJobPostingV3 salary_*_max 계산.
 * 마이그레이션 20260714100100 백필 SQL 과 동일 의미론(타입별 GREATEST, 'other' 무시,
 * 0 이하/비유한 값 제외)을 클라이언트 단일 지점에서 재현하는지 검증한다.
 */

import { getSalaryBounds, serializeJobPostingV3 } from '../serialization';
import { draftToCreateJobPostingInput } from '@/utils/job-posting/draftAdapter';
import { toSnakeCase } from '@/utils/supabase';
import { INITIAL_JOB_POSTING_DRAFT } from '@/types/jobPostingDraft';
import type { PostingCompensation, PostingRoleCatalogEntry } from '@/types/jobPosting';

describe('getSalaryBounds', () => {
  it('shared 모드: defaultSalary 타입에만 값, 나머지는 null', () => {
    const compensation: PostingCompensation = {
      mode: 'shared',
      defaultSalary: { type: 'hourly', amount: 12000 },
    };
    expect(getSalaryBounds(compensation, [])).toEqual({
      salaryHourlyMax: 12000,
      salaryDailyMax: null,
      salaryMonthlyMax: null,
    });
  });

  it('by_role 모드: 역할별 급여를 타입별 GREATEST 집계한다', () => {
    const catalog: PostingRoleCatalogEntry[] = [
      { role: 'dealer', salary: { type: 'hourly', amount: 15000 } },
      { role: 'floor', salary: { type: 'hourly', amount: 13000 } },
      { role: 'serving', salary: { type: 'daily', amount: 110000 } },
    ];
    expect(getSalaryBounds({ mode: 'by_role' }, catalog)).toEqual({
      salaryHourlyMax: 15000,
      salaryDailyMax: 110000,
      salaryMonthlyMax: null,
    });
  });

  it('default + 역할별 같은 타입이면 더 큰 값을 취한다', () => {
    const compensation: PostingCompensation = {
      mode: 'by_role',
      defaultSalary: { type: 'hourly', amount: 16000 },
    };
    const catalog: PostingRoleCatalogEntry[] = [
      { role: 'dealer', salary: { type: 'hourly', amount: 14000 } },
    ];
    expect(getSalaryBounds(compensation, catalog).salaryHourlyMax).toBe(16000);
  });

  it("협의('other')만 있으면 3필드 모두 null — 급여 필터에서 자연 제외", () => {
    const compensation: PostingCompensation = {
      mode: 'shared',
      defaultSalary: { type: 'other', amount: 0 },
    };
    expect(getSalaryBounds(compensation, [])).toEqual({
      salaryHourlyMax: null,
      salaryDailyMax: null,
      salaryMonthlyMax: null,
    });
  });

  it('문자열 amount 이력·0 이하·비유한 값을 방어한다(백필 SQL 과 동일)', () => {
    const catalog = [
      { role: 'dealer', salary: { type: 'hourly', amount: '13000' } },
      { role: 'floor', salary: { type: 'hourly', amount: 0 } },
      { role: 'serving', salary: { type: 'daily', amount: Number.NaN } },
    ] as unknown as PostingRoleCatalogEntry[];
    expect(getSalaryBounds({ mode: 'by_role' }, catalog)).toEqual({
      salaryHourlyMax: 13000,
      salaryDailyMax: null,
      salaryMonthlyMax: null,
    });
  });
});

describe('serializeJobPostingV3 salary bounds 통합', () => {
  it('신규 공고 직렬화 시 salary_*_max 3키가 항상 실린다(없는 타입은 null 명시)', () => {
    const input = draftToCreateJobPostingInput({
      ...INITIAL_JOB_POSTING_DRAFT,
      title: '주말 딜러',
      location: { name: '라운더스', address: '서울 강남구' },
      roleCatalog: [{ role: 'dealer', salary: { type: 'hourly', amount: 15000 } }],
    });
    const doc = serializeJobPostingV3(input, { ownerId: 'u1', ownerName: 't' });

    expect(doc.salaryHourlyMax).toBe(15000);
    // null 명시 — 편집으로 급여 타입이 사라졌을 때 UPDATE 가 stale 컬럼을 지우는 계약
    expect(doc.salaryDailyMax).toBeNull();
    expect(doc.salaryMonthlyMax).toBeNull();
    expect('salaryDailyMax' in doc).toBe(true);
    expect('salaryMonthlyMax' in doc).toBe(true);
  });

  it('insert payload(toSnakeCase)에 salary_*_max 컬럼 키가 실린다 — 신규 공고 자동 세팅 경로', () => {
    const input = draftToCreateJobPostingInput({
      ...INITIAL_JOB_POSTING_DRAFT,
      title: '주말 딜러',
      location: { name: '라운더스', address: '서울 강남구' },
      roleCatalog: [{ role: 'dealer', salary: { type: 'hourly', amount: 15000 } }],
    });
    const doc = serializeJobPostingV3(input, { ownerId: 'u1', ownerName: 't' });
    const row = toSnakeCase(doc as unknown as Record<string, unknown>);

    expect(row.salary_hourly_max).toBe(15000);
    expect(row.salary_daily_max).toBeNull();
    expect(row.salary_monthly_max).toBeNull();
  });
});
