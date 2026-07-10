/**
 * gridPrefill — 그리드 "부족 N명 → 공고 열기" 프리필 draft 조립(P2-1) 테스트
 *
 * (1) venueId+date+count → dated 일정·역할 인원이 채워진 초기 draft,
 * (2) 잘못된/누락 date → 일정 프리필 없이 기존(venueId만) 동작,
 * (3) count 경계(미지정/0/소수) → 1 이상 정수로 클램프,
 * (4) 불변성: INITIAL 원본 비변형 + requirements/template 슬롯 참조 분리.
 */
import { buildGridPrefillDraft } from '../gridPrefill';
import { INITIAL_JOB_POSTING_DRAFT } from '@/types/jobPostingDraft';

it('venueId+date+count → dated 일정·역할 인원 프리필', () => {
  const draft = buildGridPrefillDraft({ venueId: 'venue-1', date: '2026-07-05', count: 3 });

  expect(draft.venueId).toBe('venue-1');
  expect(draft.schedule.kind).toBe('dated');
  if (draft.schedule.kind !== 'dated') throw new Error('unreachable');
  expect(draft.schedule.primaryDate).toBe('2026-07-05');
  expect(draft.schedule.allDates).toEqual(['2026-07-05']);
  expect(draft.schedule.requirements).toHaveLength(1);
  expect(draft.schedule.requirements[0]!.date).toBe('2026-07-05');
  const roles = draft.schedule.requirements[0]!.timeSlots[0]!.roles;
  expect(roles[0]!.role).toBe('dealer');
  expect(roles[0]!.count).toBe(3);
  // 날짜 추가 시 복제될 템플릿에도 같은 인원 반영
  expect(draft.schedule.templateTimeSlots[0]!.roles[0]!.count).toBe(3);
});

it('date 가 잘못되면 일정 프리필 없이 venueId 만 반영', () => {
  const draft = buildGridPrefillDraft({ venueId: 'venue-1', date: 'not-a-date', count: 3 });

  expect(draft.venueId).toBe('venue-1');
  expect(draft.schedule).toEqual(INITIAL_JOB_POSTING_DRAFT.schedule);
});

it('파라미터 없음 → INITIAL 그대로(무회귀)', () => {
  const draft = buildGridPrefillDraft({});
  expect(draft).toBe(INITIAL_JOB_POSTING_DRAFT);
});

it('count 미지정/0/소수/NaN/과대 → 1~999 정수 클램프', () => {
  const noCount = buildGridPrefillDraft({ date: '2026-07-05' });
  const zero = buildGridPrefillDraft({ date: '2026-07-05', count: 0 });
  const frac = buildGridPrefillDraft({ date: '2026-07-05', count: 2.7 });
  // create.tsx 가 Number.parseInt(비숫자 문자열)로 NaN 을 넘길 수 있는 경로 고정
  const nan = buildGridPrefillDraft({ date: '2026-07-05', count: Number.NaN });
  // 딥링크 ?count=999999 남용 방어 상한
  const huge = buildGridPrefillDraft({ date: '2026-07-05', count: 999999 });

  const countOf = (d: ReturnType<typeof buildGridPrefillDraft>) =>
    d.schedule.kind === 'dated' ? d.schedule.requirements[0]!.timeSlots[0]!.roles[0]!.count : -1;

  expect(countOf(noCount)).toBe(1);
  expect(countOf(zero)).toBe(1);
  expect(countOf(frac)).toBe(2);
  expect(countOf(nan)).toBe(1);
  expect(countOf(huge)).toBe(999);
});

it('불변성: INITIAL 비변형 + requirements/템플릿 슬롯 참조 분리', () => {
  const draft = buildGridPrefillDraft({ date: '2026-07-05', count: 2 });

  expect(INITIAL_JOB_POSTING_DRAFT.schedule.kind).toBe('dated');
  if (INITIAL_JOB_POSTING_DRAFT.schedule.kind !== 'dated') throw new Error('unreachable');
  expect(INITIAL_JOB_POSTING_DRAFT.schedule.requirements).toEqual([]);
  expect(INITIAL_JOB_POSTING_DRAFT.schedule.primaryDate).toBe('');

  if (draft.schedule.kind !== 'dated') throw new Error('unreachable');
  expect(draft.schedule.requirements[0]!.timeSlots[0]).not.toBe(
    draft.schedule.templateTimeSlots[0]
  );
});
