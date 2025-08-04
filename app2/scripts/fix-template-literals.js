const fs = require('fs');
const path = require('path');

// 디렉토리를 재귀적으로 탐색하여 모든 .ts, .tsx, .js, .jsx 파일 찾기
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(function(file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!['node_modules', 'build', 'coverage', '.git', '__tests__', '__mocks__'].includes(file)) {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

// 템플릿 리터럴 수정
function fixTemplateLiterals(content, filePath) {
  let modified = false;
  let newContent = content;

  // logger.method('문자열 ${변수}') 패턴을 백틱으로 변환
  newContent = newContent.replace(
    /logger\.(debug|info|warn|error)\s*\(\s*'([^']*\$\{[^']*\})'/g,
    (match, method, str) => {
      modified = true;
      return `logger.${method}(\`${str}\``;
    }
  );

  // logger.method("문자열 ${변수}") 패턴을 백틱으로 변환
  newContent = newContent.replace(
    /logger\.(debug|info|warn|error)\s*\(\s*"([^"]*\$\{[^"]*\})"/g,
    (match, method, str) => {
      modified = true;
      return `logger.${method}(\`${str}\``;
    }
  );

  return { newContent, modified };
}

// 메인 실행 함수
function main() {
  const srcPath = path.join(__dirname, '../src');
  const files = getAllFiles(srcPath);
  let totalFixed = 0;
  const modifiedFiles = [];

  files.forEach(filePath => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const { newContent, modified } = fixTemplateLiterals(content, filePath);

      if (modified) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        totalFixed++;
        modifiedFiles.push(filePath);
        console.log(`✅ 수정됨: ${path.relative(srcPath, filePath)}`);
      }
    } catch (error) {
      console.error(`❌ 파일 처리 중 오류: ${filePath}`, error.message);
    }
  });

  console.log(`\n📊 총 ${totalFixed}개 파일 수정됨`);
  if (modifiedFiles.length > 0) {
    console.log('\n📝 수정된 파일 목록:');
    modifiedFiles.forEach(file => {
      console.log(`  - ${path.relative(srcPath, file)}`);
    });
  }
}

main();