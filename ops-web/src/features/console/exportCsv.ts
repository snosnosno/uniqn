/**
 * 결과·명단 CSV — 현장에서 엑셀로 옮겨 적던 일을 대신한다(조사 문서 §2).
 * 엑셀이 한글을 깨뜨리지 않게 UTF-8 BOM 을 붙이고, 수식 주입(CSV injection)을 막으려
 * `= + - @` 탭·CR 로 시작하는 칸은 앞에 `'` 를 붙인다(OWASP 권고).
 * 개인정보 최소화 — 연락처·국적·메모는 넣지 않는다.
 */
import type { OpsParticipant } from '@/core/types/ops';
import { PARTICIPANT_STATUS_LABEL } from './format';

const HEADERS = [
  '엔트리',
  '이름',
  '상태',
  '좌석',
  '칩',
  '리바이',
  '애드온',
  '재진입',
  'KO',
  '순위',
  '상금',
  '지급 완료',
] as const;

/** 한 칸 — 수식 주입 차단 후 따옴표·쉼표·줄바꿈이 있으면 감싼다. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 순위 있는 사람 먼저(1위부터), 나머지는 엔트리 순. */
function sortForExport(list: readonly OpsParticipant[]): OpsParticipant[] {
  return [...list].sort((a, b) => {
    const ra = a.finishPosition ?? Infinity;
    const rb = b.finishPosition ?? Infinity;
    return ra !== rb ? ra - rb : a.entryNumber - b.entryNumber;
  });
}

export function buildParticipantsCsv(
  participants: readonly OpsParticipant[],
  seatOf: (id: string) => string | null
): string {
  const rows = sortForExport(participants).map((p) =>
    [
      p.entryNumber,
      p.name,
      PARTICIPANT_STATUS_LABEL[p.status],
      seatOf(p.id),
      p.status === 'busted' ? null : p.chips,
      p.rebuys,
      p.addOns,
      p.reentries,
      p.knockouts,
      p.finishPosition ?? null,
      p.prizeAmount ?? null,
      p.prizePaidAt ? 'O' : null,
    ]
      .map(csvCell)
      .join(',')
  );
  return '﻿' + [HEADERS.join(','), ...rows].join('\r\n') + '\r\n';
}

/** 파일명에 쓸 수 없는 문자를 걷어 낸다. */
export function csvFileName(tournamentName: string, date = new Date()): string {
  const safe = tournamentName.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60) || '대회';
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `${safe}_명단_${ymd}.csv`;
}

export function downloadCsv(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  // 바로 회수하면 브라우저가 내려받기를 시작하기 전에 URL 이 사라져 실패한다(Chromium 실측) — 넉넉히 둔다.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
