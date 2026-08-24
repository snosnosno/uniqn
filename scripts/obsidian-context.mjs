#!/usr/bin/env node
// Obsidian 볼트 지식 색인 → SessionStart 훅이 매 세션 시작 시 Claude 컨텍스트에 주입.
// 노트 "본문"이 아니라 "경로 + 한 줄 제목"만 내보내서, 모델이 무엇이 있는지 알고
// 필요한 노트만 Read 하도록 한다(전체 로드 = 토큰 낭비 방지).
//
// 출력: {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"<색인>"}}
//
// 색인 범위 조정은 아래 INCLUDE_DIRS / EXCLUDE / MAX_PER_DIR 만 고치면 됨.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const VAULT = join(SCRIPT_DIR, '..'); // 프로젝트 루트 = 옵시디언 볼트

// 스캔할 지식 노트 폴더(볼트 루트 기준) + 루트 직속 .md 포함 여부
// specs/는 레거시 아카이브(specs/LEGACY_NOTICE.md)라 항상-로딩 색인에서 제외 — 필요시 Grep.
const INCLUDE_DIRS = ['wiki', 'docs'];
const INCLUDE_ROOT_MD = true;

// 색인에서 제외할 경로(posix relative path 기준 부분일치)
const EXCLUDE = [
  'node_modules',
  '.git',
  '.obsidian',
  '.claude',
  'docs/archive', // 122개 아카이브 — 토큰 낭비 주범
  'docs/superpowers', // 38개 외부 스킬 문서
];

// 날짜 접두(YYYY-MM-DD) 문서는 "그때의 기록"이라 항상-로딩 색인에서 제외한다.
// 아래 폴더에만 적용 — 상시 참조물(reference·guides·decisions·features·operations)은
// 날짜가 없어 그대로 남는다. 진행 중 원장 경로는 MEMORY.md 가 직접 들고 있고,
// 나머지는 Grep 으로 찾는다. (2026-08-25: docs 158개 중 60개만 노출돼 색인이
// 비싸면서 불완전했다 — 잘림을 없애는 쪽이 목록을 늘리는 것보다 낫다.)
const DATED_DIRS = ['docs/planning', 'docs/analysis'];
const DATED_RE = /(^|\/)\d{4}-\d{2}-\d{2}/;

// 영역별 안전 상한. 잘린 색인은 "없음"과 "안 보임"을 구별 못 해 오히려 해로우므로,
// 현재 최대 영역(wiki 73)보다 높게 잡아 잘림 0 을 유지한다. 넘기 시작하면 상한을
// 올리지 말고 DATED_DIRS/EXCLUDE 로 범위를 좁힐 것.
const MAX_PER_DIR = 80;
const TITLE_MAX = 70; // 제목 잘림 길이

function toPosix(p) {
  return p.split(sep).join('/');
}

function isExcluded(relPosix) {
  if (
    DATED_DIRS.some((d) => relPosix.startsWith(d + '/')) &&
    DATED_RE.test(relPosix)
  ) {
    return true;
  }
  return EXCLUDE.some(
    (e) => relPosix === e || relPosix.startsWith(e + '/') || relPosix.includes('/' + e + '/'),
  );
}

function walk(dir, acc) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = join(dir, ent.name);
    const relPosix = toPosix(relative(VAULT, full));
    if (isExcluded(relPosix)) continue;
    if (ent.isDirectory()) walk(full, acc);
    else if (ent.isFile() && ent.name.endsWith('.md')) acc.push(relPosix);
  }
}

function clean(s) {
  const out = s.replace(/["`*#>]/g, '').replace(/\s+/g, ' ').trim();
  return out.length > TITLE_MAX ? out.slice(0, TITLE_MAX - 1) + '…' : out;
}

function titleOf(relPosix) {
  let text;
  try {
    text = readFileSync(join(VAULT, relPosix), 'utf8');
  } catch {
    return '';
  }
  // 1) frontmatter title/description
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  if (fm) {
    const d = fm[1].match(/^(?:title|description):\s*(.+)$/m);
    if (d) return clean(d[1]);
  }
  // 2) 첫 번째 H1
  const h1 = text.match(/^#\s+(.+)$/m);
  if (h1) return clean(h1[1]);
  // 3) frontmatter 제외 첫 비어있지 않은 줄
  const body = text.replace(/^---\n[\s\S]*?\n---\n?/, '');
  const line = body
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  return line ? clean(line) : '';
}

// 파일 수집
const files = [];
if (INCLUDE_ROOT_MD) {
  for (const ent of readdirSync(VAULT, { withFileTypes: true })) {
    if (ent.isFile() && ent.name.endsWith('.md')) files.push(ent.name);
  }
}
for (const d of INCLUDE_DIRS) walk(join(VAULT, d), files);

// top-level 영역별 그룹화
const groups = new Map();
for (const f of [...new Set(files)].sort()) {
  const top = f.includes('/') ? f.split('/')[0] : '(root)';
  if (!groups.has(top)) groups.set(top, []);
  groups.get(top).push(f);
}

const lines = [];
lines.push('# 📚 Obsidian 볼트 지식 색인 (on-demand)');
lines.push(
  '이 프로젝트(옵시디언 볼트)의 지식 노트 목록이다. 관련 주제가 나오면 **해당 노트만 Read** 하라(전체를 읽지 말 것). ' +
    '목록에 없는 내용은 볼트를 Grep 으로 검색. node_modules/archive/superpowers 는 색인에서 제외됨.',
);
lines.push('');

let count = 0;
for (const [top, arr] of groups) {
  const shown = arr.slice(0, MAX_PER_DIR);
  lines.push(`## ${top}/ (${arr.length})`);
  for (const f of shown) {
    const t = titleOf(f);
    lines.push(`- \`${f}\`${t ? ' — ' + t : ''}`);
    count++;
  }
  if (arr.length > shown.length) {
    lines.push(`- … (+${arr.length - shown.length}개 더 있음, Grep 으로 검색)`);
  }
  lines.push('');
}
lines.push(`_총 ${count}개 노트 색인 · 생성: scripts/obsidian-context.mjs_`);

// 지식 운영 푸터 + MEMORY.md 예산 자가점검 (베스트에포트 — 절대 throw 금지)
lines.push('');
lines.push('## 🔄 지식 운영 (자동 리마인더)');
lines.push(
  '- 졸업 규칙: 머지·해결된 함정은 `/ingest`로 wiki 졸업 후 MEMORY.md 가지치기(냉이력은 MEMORY-archive.md).',
);
lines.push('- 세션 끝 `/session-wrap` · 월 1회 `/lint`+`/memory-audit` · 4계층 계약 `wiki/AGENTS.md §10`.');
try {
  // Claude Code 메모리 경로: ~/.claude/projects/<cwd를 -로 인코딩>/memory/MEMORY.md
  const encoded = VAULT.replace(/:/g, '-')
    .split(/[\\/]/)
    .join('-');
  const memPath = join(homedir(), '.claude', 'projects', encoded, 'memory', 'MEMORY.md');
  const memText = readFileSync(memPath, 'utf8');
  const memChars = memText.length;
  const BUDGET = 14000; // 항상-로딩 인덱스 예산(자)
  const WARN = Math.round(BUDGET * 0.85); // 조기 경보선 — "초과한 뒤 대응"은 6회 반복 실패했다
  if (memChars > WARN) {
    // 경고에 그치지 않고 원인을 지목한다: 최대 섹션 · 인덱스에 남은 완료(✅) 항목 · 과길이 줄
    const memLines = memText.split('\n');
    const secs = [];
    let cur = '(머리말)';
    let size = 0;
    for (const l of memLines) {
      if (l.startsWith('## ')) {
        secs.push([cur, size]);
        cur = l.slice(3).trim();
        size = 0;
      }
      size += l.length + 1;
    }
    secs.push([cur, size]);
    secs.sort((a, b) => b[1] - a[1]);
    const [topName, topSize] = secs[0];
    const doneCount = memLines.filter((l) => l.startsWith('- ✅')).length;
    const longCount = memLines.filter((l) => l.length > 250).length;
    const pct = Math.round((memChars / BUDGET) * 100);
    lines.push(
      `- ${memChars > BUDGET ? '🚨' : '⚠️'} MEMORY.md **${memChars}자** (예산 ${BUDGET} · ${pct}%)` +
        ` — 최대 섹션 「${topName}」 ${topSize}자` +
        (doneCount ? ` · 인덱스에 남은 완료(✅) ${doneCount}건` : '') +
        (longCount ? ` · 250자 초과 ${longCount}줄` : ''),
    );
    lines.push(
      '- 🔧 순서: ① `✅`·해결된 항목 → MEMORY-archive.md ② **최대 섹션을 토픽 파일로 분리**하고 인덱스엔 포인터 한 줄 ③ 교훈은 `/ingest` 로 wiki 졸업. 항목만 잘라내는 가지치기는 07-19~08-10 에 6회 반복 실패했다.',
    );
  }
} catch {
  /* MEMORY.md 미발견(타 머신/워크트리) → 조용히 스킵 */
}

const md = lines.join('\n');
process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: md },
  }),
);
