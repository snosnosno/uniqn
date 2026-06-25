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
  'docs/archive', // 70개 아카이브 — 토큰 낭비 주범
  'docs/superpowers', // 25개 외부 스킬 문서
];

const MAX_PER_DIR = 60; // 영역별 안전 상한(폴더 비대화 방지)
const TITLE_MAX = 70; // 제목 잘림 길이

function toPosix(p) {
  return p.split(sep).join('/');
}

function isExcluded(relPosix) {
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
  const memChars = readFileSync(memPath, 'utf8').length;
  const BUDGET = 14000; // 항상-로딩 인덱스 예산(자)
  if (memChars > BUDGET) {
    lines.push(
      `- ⚠️ MEMORY.md ${memChars}자 (예산 ${BUDGET} 초과) — 졸업 규칙 적용 권장(냉이력 → MEMORY-archive.md).`,
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
