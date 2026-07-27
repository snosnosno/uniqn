import {
  serializeJobPostingV3,
  deserializeJobPostingDocument,
  toCreateJobPostingInput,
  mergeJobPostingInput,
} from '../serialization';
import {
  draftToCreateJobPostingInput,
  draftToUpdateJobPostingInput,
  jobPostingToDraft,
} from '@/utils/job-posting/draftAdapter';
import { TABLE_COLUMNS } from '@/repositories/supabase/JobPostingRepositoryHelpers';
import { INITIAL_JOB_POSTING_DRAFT } from '@/types/jobPostingDraft';

describe('conditions 직렬화 왕복', () => {
  const draftWithConditions = {
    ...INITIAL_JOB_POSTING_DRAFT,
    title: '주말 딜러 구합니다',
    location: { name: '라운더스 홀덤펍', address: '서울 강남구' },
    conditions: { dressCode: '검정셔츠/슬랙스', experience: 'TDA 숙지자' },
  };

  it('draft→input→document에서 conditions가 보존된다', () => {
    const input = draftToCreateJobPostingInput(draftWithConditions);
    expect(input.conditions).toEqual({ dressCode: '검정셔츠/슬랙스', experience: 'TDA 숙지자' });
    const doc = serializeJobPostingV3(input, { ownerId: 'u1', ownerName: 't' });
    expect(doc.conditions).toEqual({ dressCode: '검정셔츠/슬랙스', experience: 'TDA 숙지자' });
  });

  it('conditions 미설정 draft는 필드 자체가 생기지 않는다 (own-property 가드)', () => {
    const input = draftToCreateJobPostingInput({
      ...INITIAL_JOB_POSTING_DRAFT,
      title: 't',
      location: { name: 'x' },
    });
    expect('conditions' in input).toBe(false);
  });

  it('읽기 방향: document→deserialize→entity→수정 base에서 conditions가 보존된다', () => {
    const input = draftToCreateJobPostingInput(draftWithConditions);
    const doc = serializeJobPostingV3(input, { ownerId: 'u1', ownerName: 't' });
    const entity = deserializeJobPostingDocument({ ...doc, id: 'p1' });
    expect(entity.conditions).toEqual(draftWithConditions.conditions); // ⑥ 읽기 조립부
    expect(toCreateJobPostingInput(entity).conditions).toEqual(draftWithConditions.conditions); // ⑦ 수정 base
    expect(jobPostingToDraft(entity).conditions).toEqual(draftWithConditions.conditions); // edit 진입
  });

  it('TABLE_COLUMNS SELECT 화이트리스트에 conditions가 등록된다 (읽기 증발 가드)', () => {
    expect(TABLE_COLUMNS.split(',')).toContain('conditions');
  });
});

describe('conditions 해제 왕복(update 경로 — S3 리뷰 I-2/I-1)', () => {
  const draftWithConditions = {
    ...INITIAL_JOB_POSTING_DRAFT,
    title: '주말 딜러 구합니다',
    location: { name: '라운더스 홀덤펍', address: '서울 강남구' },
    conditions: { dressCode: '검정셔츠/슬랙스', experience: 'TDA 숙지자' },
  };

  // 기존 conditions 가 저장된 엔티티(읽기 하이드레이션 base) — merge base 로 사용.
  const entityWithConditions = () => {
    const input = draftToCreateJobPostingInput(draftWithConditions);
    const doc = serializeJobPostingV3(input, { ownerId: 'u1', ownerName: 't' });
    return deserializeJobPostingDocument({ ...doc, id: 'p1' });
  };

  it('전량 해제 draft(conditions 키 부재) → update patch→merge→serialize에서 문서 conditions가 빈 {}로 반영된다', () => {
    // ConditionsSheet 전량 해제 시 valuesToDraft 는 conditions 키를 생략한다(draft.conditions=undefined).
    const { conditions: _omit, ...clearedDraft } = draftWithConditions;
    const patch = draftToUpdateJobPostingInput(clearedDraft);
    const entity = entityWithConditions();
    expect(entity.conditions).toEqual({ dressCode: '검정셔츠/슬랙스', experience: 'TDA 숙지자' });
    const doc = serializeJobPostingV3(mergeJobPostingInput(entity, patch), {
      ownerId: 'u1',
      ownerName: 't',
      current: entity,
    });
    // 해제가 문서에 반영 — current-폴백으로 기존 conditions 가 부활하지 않는다(I-2).
    expect(doc.conditions).toEqual({});
  });

  it('patch(conditions:{})는 merge→serialize에서 base conditions를 wholesale 덮는다(Step1 계약 그라운딩)', () => {
    const entity = entityWithConditions();
    const merged = mergeJobPostingInput(entity, { conditions: {} });
    expect(merged.conditions).toEqual({}); // patch 가 base 를 덮음(explicit override 아님, 스프레드 순서)
    const doc = serializeJobPostingV3(merged, { ownerId: 'u1', ownerName: 't', current: entity });
    expect(doc.conditions).toEqual({}); // serialize 의 `!== undefined` 통과 → 빈 {} wholesale 기록
  });

  it('update patch 가 conditions 변경을 문서에 반영한다(I-1)', () => {
    const editedDraft = { ...draftWithConditions, conditions: { dressCode: '유니폼 지급' } };
    const patch = draftToUpdateJobPostingInput(editedDraft);
    const entity = entityWithConditions();
    const doc = serializeJobPostingV3(mergeJobPostingInput(entity, patch), {
      ownerId: 'u1',
      ownerName: 't',
      current: entity,
    });
    expect(doc.conditions).toEqual({ dressCode: '유니폼 지급' });
  });
});
