/**
 * 대회 편집 승인상태 보존(S3 — 설계 확정 ⑥) 통합 회귀.
 * update 경로(merge→serialize)가 current의 tournamentConfig를 그대로 보존해
 * 승인된(approved) 대회 수정이 pending 리셋을 유발하지 않음을 고정한다.
 * 보존 구현: serialization.ts update 조립부의 tournament 분기(current?.tournamentConfig 복사).
 * red-green: 해당 분기를 임시 무력화하면 이 스위트가 FAIL해야 한다(Task 5에서 실측).
 */
import {
  deserializeJobPostingDocument,
  mergeJobPostingInput,
  serializeJobPostingV3,
} from '../serialization';
import { draftToCreateJobPostingInput, jobPostingToDraft } from '@/utils/job-posting/draftAdapter';
import { draftToValues, valuesToUpdateInput } from '@/utils/order-sheet/mappers';
import { INITIAL_JOB_POSTING_DRAFT } from '@/types/jobPostingDraft';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';
import type { TournamentConfig } from '@/types/postingConfig';

const submittedAt = new Date('2026-07-10T09:00:00+09:00');
const approvedConfig: TournamentConfig = {
  approvalStatus: 'approved',
  submittedAt,
  approvedBy: 'admin-1',
  approvedAt: new Date('2026-07-11T10:00:00+09:00'),
};

/** approved 대회 엔티티 구성 — create 직렬화 → 문서에 승인 config 부여 → 역직렬화 */
function buildApprovedTournament() {
  const input = draftToCreateJobPostingInput({
    ...INITIAL_JOB_POSTING_DRAFT,
    postingType: 'tournament',
    title: 'WSOP 서울 딜러',
    location: { name: '강남 홀덤펍', address: '서울 강남구' },
  });
  const doc = serializeJobPostingV3(input, { ownerId: 'u1', ownerName: 't' });
  return deserializeJobPostingDocument({
    ...doc,
    id: 'p1',
    tournamentConfig: approvedConfig,
  });
}

describe('대회 편집 — approvalStatus 보존(merge→serialize 통합)', () => {
  it('부분 patch(제목 수정)로도 approved config가 그대로 보존된다', () => {
    const entity = buildApprovedTournament();
    const merged = mergeJobPostingInput(entity, { title: '수정된 대회 제목' });
    const updated = serializeJobPostingV3(merged, {
      ownerId: entity.ownerId,
      ownerName: entity.ownerName,
      status: entity.status,
      current: entity,
      createdAt: entity.createdAt,
      updatedAt: new Date('2026-07-16T12:00:00+09:00').toISOString(),
    });
    expect(updated.tournamentConfig?.approvalStatus).toBe('approved');
    expect(updated.tournamentConfig?.submittedAt).toEqual(submittedAt);
    expect(updated.title).toBe('수정된 대회 제목');
  });

  it('주문서 편집 전체 payload(valuesToUpdateInput)로도 approved가 보존된다', () => {
    const entity = buildApprovedTournament();
    // 편집 하이드레이션 → 재제출 시뮬레이션. draftToValues는 z.input을 반환하지만
    // 왕복 정규형 동등(기존 mappers 왕복 게이트)이 성립해 z.output으로 안전 단언.
    const values = draftToValues(jobPostingToDraft(entity)) as OrderSheetValues;
    const patch = valuesToUpdateInput({ ...values, title: '주문서에서 수정' });
    expect('tournamentConfig' in patch).toBe(false);
    const merged = mergeJobPostingInput(entity, patch);
    const updated = serializeJobPostingV3(merged, {
      ownerId: entity.ownerId,
      ownerName: entity.ownerName,
      status: entity.status,
      current: entity,
      createdAt: entity.createdAt,
      updatedAt: new Date('2026-07-16T12:00:00+09:00').toISOString(),
    });
    expect(updated.tournamentConfig?.approvalStatus).toBe('approved');
    expect(updated.title).toBe('주문서에서 수정');
  });

  it('pending 대회 편집도 pending 그대로다(재제출 트리거 없음)', () => {
    const entity = buildApprovedTournament();
    const pendingEntity = {
      ...entity,
      tournamentConfig: { approvalStatus: 'pending' as const, submittedAt },
    };
    const merged = mergeJobPostingInput(pendingEntity, { title: '수정' });
    const updated = serializeJobPostingV3(merged, {
      ownerId: pendingEntity.ownerId,
      ownerName: pendingEntity.ownerName,
      status: pendingEntity.status,
      current: pendingEntity,
      createdAt: pendingEntity.createdAt,
      updatedAt: new Date('2026-07-16T12:00:00+09:00').toISOString(),
    });
    expect(updated.tournamentConfig?.approvalStatus).toBe('pending');
    expect(updated.tournamentConfig?.resubmittedAt).toBeUndefined();
  });
});
