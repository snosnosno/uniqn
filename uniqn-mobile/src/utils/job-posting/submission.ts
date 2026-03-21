import type {
  CreateJobPostingInput,
  JobPosting,
  JobPostingFormData,
  UpdateJobPostingInput,
} from '@/types';
import type { JobPostingDraft } from '@/types/jobPostingDraft';
import {
  applyFormDataPatch,
  draftToCreateJobPostingInput,
  draftToFormData,
  draftToUpdateJobPostingInput,
  formDataToDraft,
  jobPostingToDraft,
} from './draftAdapter';

function isJobPostingDraft(value: JobPostingDraft | JobPostingFormData): value is JobPostingDraft {
  return 'schedule' in value && 'roleCatalog' in value && 'compensation' in value;
}

export function buildCreateJobPostingInput(
  draftOrFormData: JobPostingDraft | JobPostingFormData
): CreateJobPostingInput {
  return draftToCreateJobPostingInput(
    isJobPostingDraft(draftOrFormData) ? draftOrFormData : formDataToDraft(draftOrFormData)
  );
}

export function buildUpdateJobPostingInput(
  draftOrFormData: JobPostingDraft | JobPostingFormData,
  options?: {
    hasConfirmedApplicants?: boolean;
  }
): UpdateJobPostingInput {
  return draftToUpdateJobPostingInput(
    isJobPostingDraft(draftOrFormData) ? draftOrFormData : formDataToDraft(draftOrFormData),
    options
  );
}

export function buildJobPostingDraft(posting: JobPosting): JobPostingDraft {
  return jobPostingToDraft(posting);
}

export function buildJobPostingFormData(posting: JobPosting): JobPostingFormData {
  return draftToFormData(jobPostingToDraft(posting));
}

export function buildJobPostingDraftFromFormData(formData: JobPostingFormData): JobPostingDraft {
  return formDataToDraft(formData);
}

export function patchJobPostingDraft(
  draft: JobPostingDraft,
  patch: Partial<JobPostingFormData>
): JobPostingDraft {
  return applyFormDataPatch(draft, patch);
}

export { draftToFormData, formDataToDraft, jobPostingToDraft, applyFormDataPatch };
