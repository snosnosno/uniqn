#!/usr/bin/env node
/**
 * T-HOLDEM Git Hooks 설정 스크립트
 * 
 * 기능:
 * - pre-commit: 문서 일관성 검사
 * - post-commit: 자동 문서 업데이트
 * - pre-push: 최종 품질 검사
 * 
 * 사용법: node scripts/setup-git-hooks.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Git hooks 디렉토리
const hooksDir = path.join(__dirname, '../.git/hooks');

// Hook 스크립트들
const hooks = {
  'pre-commit': `#!/bin/sh
# T-HOLDEM Pre-commit Hook
# 문서 일관성 검사 및 자동 포맷

echo "🔍 문서 일관성 검사 중..."

# 스테이징된 마크다운 파일 확인
STAGED_MD_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\\.md$' || true)

if [ -n "$STAGED_MD_FILES" ]; then
  echo "📝 스테이징된 마크다운 파일:"
  echo "$STAGED_MD_FILES"
  
  # 문서 검사 실행
  cd app2
  npm run docs:check
  
  if [ $? -ne 0 ]; then
    echo "❌ 문서 품질 검사 실패. 커밋을 중단합니다."
    echo "💡 'npm run docs:check'를 실행하여 문제를 확인하세요."
    exit 1
  fi
  
  # 문서 자동 업데이트
  echo "🔧 문서 자동 업데이트 중..."
  npm run docs:update
  
  # 업데이트된 파일이 있으면 스테이징에 추가
  cd ..
  git add README.md ROADMAP.md TODO.md CONTRIBUTING.md CLAUDE.md docs/
  
  echo "✅ 문서 검사 및 업데이트 완료"
fi

echo "🎉 Pre-commit 검사 통과!"
`,

  'post-commit': `#!/bin/sh
# T-HOLDEM Post-commit Hook
# 커밋 후 문서 일관성 유지

echo "📋 커밋 후 문서 상태 확인 중..."

# 최신 커밋 정보 출력
COMMIT_MSG=$(git log -1 --pretty=format:"%s")
COMMIT_HASH=$(git log -1 --pretty=format:"%h")

echo "✅ 커밋 완료: [$COMMIT_HASH] $COMMIT_MSG"

# TODO.md의 스프린트 날짜가 과거인지 확인
cd app2
node ../scripts/check-docs.js --silent

echo "🎉 Post-commit 처리 완료!"
`,

  'pre-push': `#!/bin/sh
# T-HOLDEM Pre-push Hook  
# 푸시 전 최종 품질 검사

echo "🚀 푸시 전 최종 품질 검사 중..."

# 문서 품질 검사
cd app2
echo "📋 문서 품질 검사..."
npm run docs:check

if [ $? -ne 0 ]; then
  echo "❌ 문서 품질 검사 실패"
  echo "💡 'npm run docs:check'를 실행하여 문제를 해결하세요."
  exit 1
fi

# TypeScript 타입 검사
echo "🔍 TypeScript 타입 검사..."
npm run type-check

if [ $? -ne 0 ]; then
  echo "❌ TypeScript 타입 검사 실패"
  echo "💡 'npm run type-check'를 실행하여 타입 오류를 수정하세요."
  exit 1
fi

# 린팅 검사
echo "📏 ESLint 검사..."
npm run lint

if [ $? -ne 0 ]; then
  echo "❌ ESLint 검사 실패"
  echo "💡 'npm run lint:fix'를 실행하여 린트 오류를 수정하세요."
  exit 1
fi

echo "✅ 모든 품질 검사 통과!"
echo "🚀 푸시를 진행합니다..."
`
};

// Hook 설치 함수
function installHook(hookName, content) {
  const hookPath = path.join(hooksDir, hookName);
  
  try {
    fs.writeFileSync(hookPath, content, { mode: 0o755 });
    console.log(`✅ ${hookName} hook 설치 완료`);
    return true;
  } catch (error) {
    console.error(`❌ ${hookName} hook 설치 실패:`, error.message);
    return false;
  }
}

// 기존 hook 백업
function backupExistingHook(hookName) {
  const hookPath = path.join(hooksDir, hookName);
  const backupPath = path.join(hooksDir, `${hookName}.backup`);
  
  if (fs.existsSync(hookPath)) {
    try {
      fs.copyFileSync(hookPath, backupPath);
      console.log(`📋 기존 ${hookName} hook을 ${hookName}.backup으로 백업했습니다.`);
      return true;
    } catch (error) {
      console.warn(`⚠️ ${hookName} hook 백업 실패:`, error.message);
      return false;
    }
  }
  return true;
}

// Git repository 확인
function checkGitRepository() {
  try {
    execSync('git rev-parse --git-dir', { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// hooks 디렉토리 생성
function ensureHooksDirectory() {
  if (!fs.existsSync(hooksDir)) {
    try {
      fs.mkdirSync(hooksDir, { recursive: true });
      console.log('📁 .git/hooks 디렉토리 생성');
      return true;
    } catch (error) {
      console.error('❌ hooks 디렉토리 생성 실패:', error.message);
      return false;
    }
  }
  return true;
}

// Hook 제거 함수
function removeHooks() {
  console.log('🗑️ 기존 T-HOLDEM Git hooks 제거 중...');
  
  Object.keys(hooks).forEach(hookName => {
    const hookPath = path.join(hooksDir, hookName);
    const backupPath = path.join(hooksDir, `${hookName}.backup`);
    
    if (fs.existsSync(hookPath)) {
      fs.unlinkSync(hookPath);
      console.log(`🗑️ ${hookName} hook 제거됨`);
    }
    
    if (fs.existsSync(backupPath)) {
      fs.renameSync(backupPath, hookPath);
      console.log(`♻️ ${hookName} hook 백업 복원됨`);
    }
  });
  
  console.log('✅ Hook 제거 완료');
}

// 메인 실행 함수
async function main() {
  const args = process.argv.slice(2);
  
  // 도움말 표시
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
T-HOLDEM Git Hooks 설정 도구

사용법:
  node scripts/setup-git-hooks.js [옵션]

옵션:
  --remove, -r    기존 hooks 제거 및 백업 복원
  --help, -h      이 도움말 표시

기능:
  - pre-commit: 문서 일관성 검사 및 자동 업데이트
  - post-commit: 커밋 정보 출력 및 상태 확인
  - pre-push: TypeScript/ESLint/문서 품질 최종 검사

설치 후 사용법:
  - 커밋할 때 자동으로 문서 검사 및 업데이트
  - 푸시할 때 자동으로 전체 품질 검사
    `);
    return;
  }
  
  // Hook 제거 모드
  if (args.includes('--remove') || args.includes('-r')) {
    removeHooks();
    return;
  }
  
  console.log('🔧 T-HOLDEM Git Hooks 설정 시작');
  console.log('=' .repeat(50));
  
  // Git repository 확인
  if (!checkGitRepository()) {
    console.error('❌ Git repository가 아닙니다. Git이 초기화된 프로젝트에서 실행하세요.');
    process.exit(1);
  }
  
  // hooks 디렉토리 확인/생성
  if (!ensureHooksDirectory()) {
    console.error('❌ hooks 디렉토리 생성 실패');
    process.exit(1);
  }
  
  console.log('📋 설치할 hooks:');
  Object.keys(hooks).forEach(hookName => {
    console.log(`   - ${hookName}: 품질 검사 및 자동화`);
  });
  console.log('');
  
  // 기존 hooks 백업 및 새 hooks 설치
  let installCount = 0;
  
  Object.entries(hooks).forEach(([hookName, content]) => {
    console.log(`🔧 ${hookName} hook 설치 중...`);
    
    // 기존 hook 백업
    backupExistingHook(hookName);
    
    // 새 hook 설치
    if (installHook(hookName, content)) {
      installCount++;
    }
  });
  
  console.log('');
  console.log('📋 설치 결과:');
  console.log(`   - 성공: ${installCount}/${Object.keys(hooks).length}개 hooks`);
  
  if (installCount === Object.keys(hooks).length) {
    console.log('✅ 모든 Git hooks 설치 완료!');
    console.log('');
    console.log('🎯 이제 다음과 같이 동작합니다:');
    console.log('   - git commit: 문서 검사 및 자동 업데이트');
    console.log('   - git push: TypeScript, ESLint, 문서 품질 검사');
    console.log('');
    console.log('💡 Hook 제거: npm run setup-hooks -- --remove');
    
  } else {
    console.log('⚠️ 일부 hooks 설치에 실패했습니다.');
    console.log('💡 수동으로 .git/hooks/ 디렉토리를 확인해보세요.');
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 스크립트 실행 실패:', error.message);
    process.exit(1);
  });
}

module.exports = {
  installHook,
  backupExistingHook,
  checkGitRepository
};