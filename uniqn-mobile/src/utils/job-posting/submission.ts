import type { JobPosting, JobPostingFormData, UpdateJobPostingInput } from '@/types';
import { getDateString, type DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';

function getPrimaryWorkDate(
  dateSpecificRequirements?: DateSpecificRequirement[]
): string | undefined {
  const requirement = dateSpecificRequirements?.find((candidate) => {
    return getDateString(candidate.date).length > 0;
  });

  return requirement ? getDateString(requirement.date) : undefined;
}

export function shouldAllowLegacyScheduleFallback(
  jobPosting?: Pick<JobPosting, 'postingType' | 'dateSpecificRequirements'> | null
): boolean {
  if (!jobPosting || jobPosting.postingType === 'fixed') {
    return false;
  }

  return !jobPosting.dateSpecificRequirements?.length;
}

export function buildUpdateJobPostingInput(
  formData: JobPostingFormData,
  options?: {
    hasConfirmedApplicants?: boolean;
  }
): UpdateJobPostingInput {
  const hasConfirmedApplicants = options?.hasConfirmedApplicants ?? false;
  const firstRoleWithSalary = formData.roles.find((role) => role.salary);
  const defaultSalary =
    formData.useSameSalary && firstRoleWithSalary?.salary
      ? firstRoleWithSalary.salary
      : formData.defaultSalary;

  const baseInput: UpdateJobPostingInput = {
    postingType: formData.postingType,
    title: formData.title,
    description: formData.description || undefined,
    location: formData.location as NonNullable<JobPostingFormData['location']>,
    detailedAddress: formData.detailedAddress || undefined,
    contactPhone: formData.contactPhone || undefined,
    defaultSalary,
    useSameSalary: formData.useSameSalary,
    allowances: formData.allowances,
    taxSettings:
      formData.taxSettings?.type !== 'none' ? formData.taxSettings : { type: 'none', value: 0 },
    usesPreQuestions: formData.usesPreQuestions,
    preQuestions: formData.preQuestions,
    tags: formData.tags,
  };

  if (hasConfirmedApplicants) {
    return baseInput;
  }

  if (formData.postingType === 'fixed') {
    return {
      ...baseInput,
      startTime: formData.startTime,
      daysPerWeek: formData.daysPerWeek,
      isStartTimeNegotiable: formData.isStartTimeNegotiable,
      roles: formData.roles,
    };
  }

  return {
    ...baseInput,
    workDate: getPrimaryWorkDate(formData.dateSpecificRequirements) ?? formData.workDate,
    startTime: formData.startTime,
    dateSpecificRequirements:
      formData.dateSpecificRequirements as unknown as UpdateJobPostingInput['dateSpecificRequirements'],
    roles: formData.roles,
  };
}
