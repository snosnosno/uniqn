import { buildPostingFacts, projectPostingCard } from '@/domains/job-posting';
import { deserializeJobPostingDocument } from '@/domains/job-posting/serialization';
import type { JobPostingDocumentV3, PostingConditions } from '@/types/jobPosting';

/**
 * S3 카드 조건 표시 — facts.conditionLabels 파생 + projectCard 전사 (설계 §S3, §3c)
 *
 * conditions(dressCode/experience)는 쓰기·직렬화·상세 화면까지 완결(PR #246/#247),
 * 카드 뷰모델 파이프(facts→projections)만 갭이었다. 값 없으면 빈 배열(카드 줄 생략).
 */
const buildPosting = (conditions?: PostingConditions) => {
  const document = {
    id: 'job-conditions',
    schemaVersion: 3,
    title: '조건 표시 테스트',
    status: 'active',
    ownerId: 'owner-1',
    postingType: 'regular',
    workDate: '2026-05-01',
    workDates: ['2026-05-01'],
    roleKeys: ['dealer'],
    totalPositions: 1,
    filledPositions: 0,
    viewCount: 0,
    stats: {
      totalApplicants: 0,
      activeApplicants: 0,
      confirmedApplicants: 0,
      cancellationPendingApplicants: 0,
      filledPositions: 0,
    },
    location: { name: 'Seoul' },
    schedule: {
      kind: 'dated',
      primaryDate: '2026-05-01',
      allDates: ['2026-05-01'],
      requirements: [
        {
          date: '2026-05-01',
          timeSlots: [{ startTime: '10:00', roles: [{ role: 'dealer', count: 1 }] }],
        },
      ],
    },
    roleCatalog: [{ role: 'dealer' }],
    compensation: {
      mode: 'shared',
      defaultSalary: { type: 'hourly', amount: 20000 },
    },
    questions: { items: [] },
    ...(conditions ? { conditions } : {}),
  } as JobPostingDocumentV3;

  return deserializeJobPostingDocument(document);
};

describe('buildPostingFacts conditionLabels', () => {
  it('conditions 미설정이면 빈 배열', () => {
    const facts = buildPostingFacts(buildPosting());

    expect(facts.conditionLabels).toEqual([]);
  });

  it('dressCode만 있으면 복장 라벨 1개', () => {
    const facts = buildPostingFacts(buildPosting({ dressCode: '검정 셔츠' }));

    expect(facts.conditionLabels).toEqual(['복장 검정 셔츠']);
  });

  it('dressCode+experience면 복장·경력 순서로 2개', () => {
    const facts = buildPostingFacts(
      buildPosting({ dressCode: '검정 셔츠', experience: '6개월 이상' })
    );

    expect(facts.conditionLabels).toEqual(['복장 검정 셔츠', '경력 6개월 이상']);
  });

  it('공백 문자열 값은 라벨에서 제외', () => {
    const facts = buildPostingFacts(buildPosting({ dressCode: '  ', experience: '무관' }));

    expect(facts.conditionLabels).toEqual(['경력 무관']);
  });
});

describe('projectCard conditionLabels 전사', () => {
  it('카드 뷰모델에 conditionLabels가 전사된다', () => {
    const card = projectPostingCard(
      buildPostingFacts(buildPosting({ dressCode: '정장', experience: '1년 이상' }))
    );

    expect(card.conditionLabels).toEqual(['복장 정장', '경력 1년 이상']);
  });

  it('조건 없으면 카드 뷰모델도 빈 배열', () => {
    const card = projectPostingCard(buildPostingFacts(buildPosting()));

    expect(card.conditionLabels).toEqual([]);
  });
});
