/**
 * migrate-semantic-tokens.js
 *
 * Tailwind 클래스 문자열에서 dark: 페어 및 단독 secondary 클래스를
 * 시멘틱 토큰으로 일괄 치환.
 *
 * 사용: node scripts/migrate-semantic-tokens.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

// 순서 중요: 페어를 먼저, 단독을 나중에 처리해야 함
const CLASS_MAP = [
  ['text-secondary-900 dark:text-secondary-50', 'text-content-primary'],
  ['text-secondary-700 dark:text-secondary-300', 'text-content-secondary'],
  ['text-secondary-600 dark:text-secondary-500', 'text-content-muted'],
  ['text-secondary-400 dark:text-secondary-500', 'text-content-placeholder'],
  ['bg-white dark:bg-surface-elevated', 'bg-surface-card'],
  ['bg-secondary-50 dark:bg-surface', 'bg-surface-page'],
  ['bg-secondary-100 dark:bg-surface-elevated', 'bg-surface-card'],
  ['border-secondary-200 dark:border-surface-overlay', 'border-divider'],
  ['text-secondary-900', 'text-content-primary'],
  ['text-secondary-700', 'text-content-secondary'],
  ['text-secondary-600', 'text-content-muted'],
  ['text-secondary-400', 'text-content-placeholder'],
  ['bg-secondary-50', 'bg-surface-page'],
  ['bg-secondary-100', 'bg-surface-card'],
];

function transformContent(content) {
  let result = content;
  let modified = false;

  for (const [from, to] of CLASS_MAP) {
    // 중간에 있는 경우: 공백으로 감싸진 경우
    const paddedFrom = ' ' + from + ' ';
    const paddedTo = ' ' + to + ' ';
    if (result.includes(paddedFrom)) {
      result = result.split(paddedFrom).join(paddedTo);
      modified = true;
    }
    // className 값 시작에 있는 경우: " 다음에 바로 오는 경우
    const startFrom = '"' + from + ' ';
    const startTo = '"' + to + ' ';
    if (result.includes(startFrom)) {
      result = result.split(startFrom).join(startTo);
      modified = true;
    }
    // className 값 끝에 있는 경우: " 바로 앞에 있는 경우
    const endFrom = ' ' + from + '"';
    const endTo = ' ' + to + '"';
    if (result.includes(endFrom)) {
      result = result.split(endFrom).join(endTo);
      modified = true;
    }
    // className 값 전체인 경우
    const exactFrom = '"' + from + '"';
    const exactTo = '"' + to + '"';
    if (result.includes(exactFrom)) {
      result = result.split(exactFrom).join(exactTo);
      modified = true;
    }
  }

  return { content: result, modified };
}

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'dist', '.expo'].includes(entry.name)) {
        results.push(...walk(fp));
      }
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(fp);
    }
  }
  return results;
}

if (require.main === module) {
  const base = path.resolve(__dirname, '..');
  const EXCLUDE = new Set([path.join(base, 'src/constants/colors.ts')]);
  const targetDirs = ['app', 'src'].map((d) => path.join(base, d));
  const files = targetDirs.flatMap((d) => (fs.existsSync(d) ? walk(d) : []));

  let count = 0;
  for (const file of files) {
    if (EXCLUDE.has(file)) continue;
    const original = fs.readFileSync(file, 'utf8');
    const { content, modified } = transformContent(original);
    if (!modified) continue;
    fs.writeFileSync(file, content, 'utf8');
    console.log('  ✓', path.relative(base, file));
    count++;
  }
  console.log(`\n완료: ${count}개 파일 변환`);
}

module.exports = { transformContent };
