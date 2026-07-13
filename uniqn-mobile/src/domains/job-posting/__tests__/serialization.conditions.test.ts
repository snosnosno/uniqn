import {
  serializeJobPostingV3,
  deserializeJobPostingDocument,
  toCreateJobPostingInput,
} from '../serialization';
import { draftToCreateJobPostingInput, jobPostingToDraft } from '@/utils/job-posting/draftAdapter';
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
