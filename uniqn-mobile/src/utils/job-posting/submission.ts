import type { JobPosting } from '@/types';
import type { JobPostingDraft } from '@/types/jobPostingDraft';
import { jobPostingToDraft } from './draftAdapter';

/** 공고 엔티티 → 편집/프리셋용 draft (읽기 하이드레이션 단일 진입점 — edit.tsx·create.tsx 프리셋) */
export function buildJobPostingDraft(posting: JobPosting): JobPostingDraft {
  return jobPostingToDraft(posting);
}
