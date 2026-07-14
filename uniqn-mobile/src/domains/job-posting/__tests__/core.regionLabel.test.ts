/**
 * A2/A3: location.region → 카드/상세 표시 라벨(regionLabel) 흐름 검증
 *
 * getPostingLocationLabels 가 region slug 를 표시 라벨로 변환하고, projectPostingCard/
 * projectPostingDetail 이 이를 view model 로 전달하는지 확인한다. 미설정/미지정 slug 는
 * undefined(미노출)여야 한다.
 */

import type { JobPosting } from '@/types';
import { getPostingLocationLabels } from '@/domains/job-posting/core';
import { projectPostingCard, projectPostingDetail, buildPostingFacts } from '@/domains/job-posting';

function createPosting(region?: string): JobPosting {
  return {
    id: 'job-1',
    schemaVersion: 3,
    title: 'Region label test',
    status: 'active',
    ownerId: 'owner-1',
    ownerName: 'Owner',
    workDate: '2025-01-15',
    workDates: ['2025-01-15'],
    totalPositions: 1,
    filledPositions: 0,
    location: {
      name: '강남 홀덤펍',
      district: '서울 강남구 역삼동',
      detailedAddress: '3층',
      ...(region ? { region } : {}),
    },
    schedule: {
      kind: 'dated',
      primaryDate: '2025-01-15',
      allDates: ['2025-01-15'],
      requirements: [
        {
          date: '2025-01-15',
          timeSlots: [
            { id: 'slot-1', startTime: '09:00', roles: [{ id: 'd-1', role: 'dealer', count: 1 }] },
          ],
        },
      ],
    },
    roleCatalog: [{ role: 'dealer', salary: { type: 'hourly', amount: 12000 } }],
    compensation: { mode: 'shared', defaultSalary: { type: 'hourly', amount: 12000 } },
    questions: { items: [] },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('region label 표시 흐름 (A2/A3)', () => {
  it('region slug 가 설정되면 표시 라벨(label)로 변환한다', () => {
    const labels = getPostingLocationLabels(createPosting('서울 강남구'));
    expect(labels.regionLabel).toBe('강남구');
  });

  it('카드/상세 view model 에 regionLabel 이 전달된다', () => {
    // 전국 3단계 택소노미부터 광역시 라벨은 축약("부산광역시"→"부산")
    const facts = buildPostingFacts(createPosting('부산'));
    expect(projectPostingCard(facts).regionLabel).toBe('부산');
    expect(projectPostingDetail(facts).regionLabel).toBe('부산');
  });

  it('region 미설정 시 regionLabel 은 undefined(미노출)', () => {
    const facts = buildPostingFacts(createPosting());
    expect(getPostingLocationLabels(createPosting()).regionLabel).toBeUndefined();
    expect(projectPostingCard(facts).regionLabel).toBeUndefined();
  });

  it('알 수 없는 slug 는 regionLabel 미노출(read 증발 방지: 표시만 생략)', () => {
    const labels = getPostingLocationLabels(createPosting('알수없는지역'));
    expect(labels.regionLabel).toBeUndefined();
  });
});
