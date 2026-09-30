/** 참가 탭 비컴포넌트 헬퍼(컴포넌트 파일은 컴포넌트만 export — Fast Refresh). */
import { toast } from 'sonner';
import type { OpsParticipant } from '@/core/types/ops';
import type { ParticipantAction } from '../participantActions';

/** 단축키 — DESIGN.md: X 탈락 · R 리바이 · C 칩 (+ A 애드온 · E 수정). */
export const ACTION_KEYS: Partial<Record<ParticipantAction, string>> = {
  rebuy: 'R',
  addon: 'A',
  chips: 'C',
  bust: 'X',
  edit: 'E',
};

/** 검색어 필터 — 이름 부분 일치 또는 엔트리 번호 정확 일치(`#12` 도 허용). */
export function filterParticipants(
  list: readonly OpsParticipant[],
  query: string
): OpsParticipant[] {
  const q = query.trim().replace(/^#/, '');
  if (!q) return [...list];
  return list.filter((p) => p.name.includes(q) || String(p.entryNumber) === q);
}

/** 공개 플레이어뷰 URL — 이 ops 도메인(설계 §7 새 정본). */
export function playerViewUrl(viewToken: string): string {
  return `${window.location.origin}/live/${viewToken}`;
}

export async function copyToClipboard(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label}을(를) 복사했어요`);
  } catch {
    toast.error('복사하지 못했어요. 직접 선택해 복사해 주세요.');
  }
}
