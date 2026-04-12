/**
 * replace-hardcoded-colors.js
 *
 * Secondary 팔레트 hex 값을 SECONDARY_PALETTE 상수 참조로 일괄 변환.
 * app/ 와 src/ 내 .ts .tsx 파일 대상 (colors.ts 제외).
 *
 * 사용: node scripts/replace-hardcoded-colors.js
 */

const fs = require('fs');
const path = require('path');

// hex → SECONDARY_PALETTE 단계 매핑 (대문자)
const COLOR_MAP = {
  '#A8A8B0': 400,
  '#9898A0': 500,
  '#C0C0C8': 300,
  '#707078': 600,
  '#4A4A52': 700,
  '#DCDCE0': 200,
  '#EBEBED': 100,
  '#2A2A30': 800,
  '#18181E': 900,
  '#F5F5F7': 50,
};

function transformContent(content) {
  let result = content;
  let modified = false;

  for (const [hex, step] of Object.entries(COLOR_MAP)) {
    const upper = hex.toUpperCase();
    const lower = hex.toLowerCase();
    const ref = `SECONDARY_PALETTE[${step}]`;

    // 1) JSX string attr:  someAttr="#HEX"  →  someAttr={SECONDARY_PALETTE[N]}
    const jsxRe = new RegExp(`="(${upper}|${lower})"`, 'g');
    if (jsxRe.test(result)) {
      result = result.replace(jsxRe, `={${ref}}`);
      modified = true;
    }

    // 2) Single-quoted string:  '#HEX'  →  SECONDARY_PALETTE[N]
    const sqRe = new RegExp(`'(${upper}|${lower})'`, 'g');
    if (sqRe.test(result)) {
      result = result.replace(sqRe, ref);
      modified = true;
    }

    // 3) Remaining double-quoted (ternary 등):  "#HEX"  →  SECONDARY_PALETTE[N]
    const dqRe = new RegExp(`"(${upper}|${lower})"`, 'g');
    if (dqRe.test(result)) {
      result = result.replace(dqRe, ref);
      modified = true;
    }
  }

  return { content: result, modified };
}

function addImport(content) {
  const CONST = 'SECONDARY_PALETTE';
  const FROM = "'@/constants/colors'";

  if (content.includes(FROM)) {
    // 기존 import에 SECONDARY_PALETTE 추가
    return content.replace(
      /import\s*\{([^}]+)\}\s*from\s*'@\/constants\/colors'/,
      (match, inner) => {
        if (inner.includes(CONST)) return match;
        return match.replace(/\}(\s*from)/, `, ${CONST} }$1`);
      }
    );
  }

  // 새 import 행 — 첫 번째 import 앞에 삽입
  const newLine = `import { ${CONST} } from '@/constants/colors';`;
  const firstImport = content.search(/^import /m);
  if (firstImport >= 0) {
    return content.slice(0, firstImport) + newLine + '\n' + content.slice(firstImport);
  }
  return newLine + '\n' + content;
}

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'dist', '.expo'].includes(entry.name)) {
        // __tests__ 포함 — 테스트도 상수 참조로 바꿔야 함
        results.push(...walk(fp));
      }
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(fp);
    }
  }
  return results;
}

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
  const final = addImport(content);
  fs.writeFileSync(file, final, 'utf8');
  console.log('  ✓', path.relative(base, file));
  count++;
}

console.log(`\n완료: ${count}개 파일 변환`);
