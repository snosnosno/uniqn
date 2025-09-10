#!/usr/bin/env node
/**
 * T-HOLDEM 자동 체인지로그 생성 스크립트
 * 
 * 기능:
 * - Git 커밋 히스토리에서 체인지로그 자동 생성
 * - 커밋 타입별 분류 (feat, fix, docs, etc.)
 * - 마크다운 형식으로 출력
 * 
 * 사용법: 
 * - node scripts/generate-changelog.js
 * - node scripts/generate-changelog.js --from v0.1.0 --to HEAD
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 설정
const CONFIG = {
  changelogPath: path.join(__dirname, '../CHANGELOG.md'),
  packageJsonPath: path.join(__dirname, '../app2/package.json'),
  commitTypes: {
    feat: { title: '🚀 새로운 기능', emoji: '✨' },
    fix: { title: '🐛 버그 수정', emoji: '🔧' },
    refactor: { title: '♻️ 코드 리팩토링', emoji: '⚡' },
    perf: { title: '⚡ 성능 개선', emoji: '🚀' },
    style: { title: '💄 스타일 변경', emoji: '🎨' },
    docs: { title: '📚 문서', emoji: '📝' },
    test: { title: '🧪 테스트', emoji: '✅' },
    chore: { title: '🔧 기타 변경사항', emoji: '🔨' },
    build: { title: '📦 빌드 시스템', emoji: '📦' },
    ci: { title: '👷 CI/CD', emoji: '🤖' }
  }
};

// Git 명령어 실행 유틸리티
function execGitCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', cwd: path.join(__dirname, '..') })
      .toString()
      .trim();
  } catch (error) {
    console.error(`Git 명령어 실행 실패: ${command}`);
    return '';
  }
}

// 패키지 버전 가져오기
function getPackageVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(CONFIG.packageJsonPath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    console.warn('package.json 읽기 실패, 기본값 사용');
    return '0.1.0';
  }
}

// Git 태그 목록 가져오기
function getGitTags() {
  const tagsOutput = execGitCommand('git tag --sort=-version:refname');
  return tagsOutput ? tagsOutput.split('\n').filter(tag => tag.trim()) : [];
}

// 커밋 파싱
function parseCommit(commitLine) {
  // 커밋 형식: hash|date|author|subject
  const [hash, date, author, ...subjectParts] = commitLine.split('|');
  const subject = subjectParts.join('|').trim();
  
  // 커밋 타입 추출 (예: feat: 새 기능 추가)
  const typeMatch = subject.match(/^(\w+)(?:\([^)]*\))?:\s*(.+)$/);
  const type = typeMatch ? typeMatch[1] : 'chore';
  const description = typeMatch ? typeMatch[2] : subject;
  
  return {
    hash: hash.substring(0, 7),
    date: new Date(date),
    author: author.trim(),
    type: type.toLowerCase(),
    description: description.trim(),
    fullSubject: subject
  };
}

// 커밋 히스토리 가져오기
function getCommitHistory(fromRef = '', toRef = 'HEAD') {
  let gitCommand = 'git log --pretty=format:"%H|%ad|%an|%s" --date=iso';
  
  if (fromRef) {
    gitCommand += ` ${fromRef}..${toRef}`;
  } else {
    // 기본: 최근 50개 커밋
    gitCommand += ' -n 50';
  }
  
  const output = execGitCommand(gitCommand);
  if (!output) return [];
  
  return output
    .split('\n')
    .filter(line => line.trim())
    .map(parseCommit)
    .filter(commit => commit.hash); // 유효한 커밋만
}

// 커밋을 타입별로 그룹화
function groupCommitsByType(commits) {
  const grouped = {};
  
  // 타입별 초기화
  Object.keys(CONFIG.commitTypes).forEach(type => {
    grouped[type] = [];
  });
  grouped.other = []; // 기타 타입
  
  commits.forEach(commit => {
    const type = commit.type;
    if (grouped[type]) {
      grouped[type].push(commit);
    } else {
      grouped.other.push(commit);
    }
  });
  
  return grouped;
}

// 마크다운 체인지로그 생성
function generateChangelogMarkdown(version, commits, releaseDate = new Date()) {
  const grouped = groupCommitsByType(commits);
  let markdown = '';
  
  // 헤더
  markdown += `## [${version}] - ${releaseDate.toISOString().split('T')[0]}\n\n`;
  
  // 타입별 섹션 생성
  Object.entries(CONFIG.commitTypes).forEach(([type, config]) => {
    if (grouped[type] && grouped[type].length > 0) {
      markdown += `### ${config.title}\n\n`;
      
      grouped[type].forEach(commit => {
        markdown += `- ${config.emoji} ${commit.description} ([${commit.hash}])\n`;
      });
      
      markdown += '\n';
    }
  });
  
  // 기타 변경사항
  if (grouped.other && grouped.other.length > 0) {
    markdown += `### 🔧 기타 변경사항\n\n`;
    
    grouped.other.forEach(commit => {
      markdown += `- ${commit.description} ([${commit.hash}])\n`;
    });
    
    markdown += '\n';
  }
  
  // 통계 정보
  const totalCommits = commits.length;
  const contributors = [...new Set(commits.map(c => c.author))];
  
  markdown += `### 📊 릴리즈 통계\n\n`;
  markdown += `- **총 ${totalCommits}개 커밋**\n`;
  markdown += `- **기여자**: ${contributors.join(', ')}\n\n`;
  
  markdown += '---\n\n';
  
  return markdown;
}

// 기존 체인지로그 읽기
function readExistingChangelog() {
  try {
    return fs.readFileSync(CONFIG.changelogPath, 'utf8');
  } catch (error) {
    return createInitialChangelog();
  }
}

// 초기 체인지로그 템플릿 생성
function createInitialChangelog() {
  return `# 📝 T-HOLDEM 변경 사항 (CHANGELOG)

**프로젝트**: T-HOLDEM Tournament Management Platform  
**저장소**: https://github.com/your-username/T-HOLDEM

---

모든 주목할만한 변경사항은 이 파일에 기록됩니다.

이 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/)를 따릅니다.

## [Unreleased]

### 계획된 변경사항
- TypeScript any 타입 완전 제거
- 메모리 누수 해결
- 실시간 알림 시스템 완성

---

`;
}

// 체인지로그 업데이트
function updateChangelog(newContent) {
  const existingContent = readExistingChangelog();
  
  // [Unreleased] 섹션 찾기
  const unreleasedIndex = existingContent.indexOf('## [Unreleased]');
  const nextReleaseIndex = existingContent.indexOf('## [', unreleasedIndex + 1);
  
  let updatedContent;
  
  if (unreleasedIndex !== -1) {
    // [Unreleased] 섹션 뒤에 새 릴리즈 추가
    const beforeUnreleased = existingContent.substring(0, nextReleaseIndex !== -1 ? nextReleaseIndex : existingContent.length);
    const afterUnreleased = nextReleaseIndex !== -1 ? existingContent.substring(nextReleaseIndex) : '';
    
    updatedContent = beforeUnreleased + newContent + afterUnreleased;
  } else {
    // 기존 체인지로그 형식이 다른 경우, 맨 위에 추가
    const headerEndIndex = existingContent.indexOf('---');
    if (headerEndIndex !== -1) {
      const header = existingContent.substring(0, headerEndIndex + 4);
      const rest = existingContent.substring(headerEndIndex + 4);
      updatedContent = header + '\n\n' + newContent + rest;
    } else {
      updatedContent = newContent + existingContent;
    }
  }
  
  return updatedContent;
}

// 메인 실행 함수
async function main() {
  const args = process.argv.slice(2);
  let fromRef = '';
  let toRef = 'HEAD';
  let version = '';
  
  // 명령행 인수 파싱
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--from':
        fromRef = args[i + 1];
        i++;
        break;
      case '--to':
        toRef = args[i + 1];
        i++;
        break;
      case '--version':
        version = args[i + 1];
        i++;
        break;
      case '--help':
      case '-h':
        console.log(`
T-HOLDEM 체인지로그 생성 도구

사용법:
  node scripts/generate-changelog.js [옵션]

옵션:
  --from <ref>     시작 참조 (태그, 브랜치, 커밋 해시)
  --to <ref>       끝 참조 (기본값: HEAD)
  --version <ver>  릴리즈 버전 (기본값: package.json에서 가져옴)
  --help, -h       이 도움말 표시

예시:
  node scripts/generate-changelog.js
  node scripts/generate-changelog.js --from v0.1.0 --to HEAD
  node scripts/generate-changelog.js --version 0.2.0
        `);
        return;
    }
  }
  
  console.log('📝 T-HOLDEM 체인지로그 생성 시작');
  console.log('=' .repeat(50));
  
  // 버전 확인
  if (!version) {
    version = getPackageVersion();
  }
  console.log(`📦 릴리즈 버전: v${version}`);
  
  // 커밋 히스토리 가져오기
  console.log(`🔍 커밋 히스토리 조회 (${fromRef || '최근 50개'} → ${toRef})`);
  const commits = getCommitHistory(fromRef, toRef);
  
  if (commits.length === 0) {
    console.log('⚠️  커밋이 없습니다.');
    return;
  }
  
  console.log(`✅ ${commits.length}개 커밋 발견`);
  
  // 타입별 통계
  const grouped = groupCommitsByType(commits);
  Object.entries(CONFIG.commitTypes).forEach(([type, config]) => {
    const count = grouped[type] ? grouped[type].length : 0;
    if (count > 0) {
      console.log(`   - ${config.title}: ${count}개`);
    }
  });
  
  // 체인지로그 생성
  console.log('📄 체인지로그 마크다운 생성 중...');
  const changelogContent = generateChangelogMarkdown(version, commits);
  
  // 파일 업데이트
  console.log('💾 CHANGELOG.md 업데이트 중...');
  const updatedChangelog = updateChangelog(changelogContent);
  
  try {
    fs.writeFileSync(CONFIG.changelogPath, updatedChangelog, 'utf8');
    console.log('✅ CHANGELOG.md 업데이트 완료!');
    
    // 미리보기 출력
    console.log('\n📋 생성된 체인지로그 미리보기:');
    console.log('-' .repeat(50));
    console.log(changelogContent);
    
  } catch (error) {
    console.error('❌ 체인지로그 저장 실패:', error.message);
    process.exit(1);
  }
  
  console.log('🎉 체인지로그 생성 완료!');
}

// 스크립트 실행
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 스크립트 실행 실패:', error.message);
    process.exit(1);
  });
}

module.exports = {
  generateChangelogMarkdown,
  getCommitHistory,
  groupCommitsByType
};