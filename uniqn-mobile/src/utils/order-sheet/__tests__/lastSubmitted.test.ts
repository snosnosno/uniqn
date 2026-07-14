import {
  clearLastSubmittedDraft,
  getLastSubmittedDraft,
  setLastSubmittedDraft,
} from '../lastSubmitted';
import type { JobPostingDraft } from '@/types/jobPostingDraft';

const makeDraft = (title: string): JobPostingDraft => ({ title }) as unknown as JobPostingDraft;

describe('lastSubmitted 캐시', () => {
  afterEach(() => {
    clearLastSubmittedDraft();
  });

  it('초기값은 null 이다', () => {
    expect(getLastSubmittedDraft()).toBeNull();
  });

  it('set 한 draft 를 get 으로 그대로 돌려준다', () => {
    const draft = makeDraft('딜러 모집');
    setLastSubmittedDraft(draft);
    expect(getLastSubmittedDraft()).toBe(draft);
  });

  it('clear 후에는 다시 null 이다', () => {
    setLastSubmittedDraft(makeDraft('플로어 모집'));
    clearLastSubmittedDraft();
    expect(getLastSubmittedDraft()).toBeNull();
  });

  it('set(null) 로도 비울 수 있다', () => {
    setLastSubmittedDraft(makeDraft('서빙 모집'));
    setLastSubmittedDraft(null);
    expect(getLastSubmittedDraft()).toBeNull();
  });
});
