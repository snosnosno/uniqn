const fs = require('fs');
const path = require('path');

// 디렉토리를 재귀적으로 탐색하여 모든 .ts, .tsx 파일 찾기
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(function(file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!['node_modules', 'build', 'coverage', '.git', '__tests__', '__mocks__'].includes(file)) {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      }
    } else if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !file.endsWith('.test.ts') && !file.endsWith('.test.tsx')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

// logger.error 호출 수정
function fixLoggerErrors(content, filePath) {
  let modified = false;
  let newContent = content;

  // logger.error('message', variable, context) 패턴 수정
  newContent = newContent.replace(
    /logger\.error\s*\(\s*(['"`][^'"`]+['"`])\s*,\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*,\s*(\{[^}]+\})\s*\)/g,
    (match, message, errorVar, context) => {
      modified = true;
      return `logger.error(${message}, ${errorVar} instanceof Error ? ${errorVar} : new Error(String(${errorVar})), ${context})`;
    }
  );

  // logger.error('Error occurred', err, { ... }) 패턴 수정
  newContent = newContent.replace(
    /logger\.error\s*\(\s*(['"`]Error occurred['"`])\s*,\s*(err|error|e)\s*,\s*(\{[^}]+\})\s*\)/g,
    (match, message, errorVar, context) => {
      modified = true;
      return `logger.error(${message}, ${errorVar} instanceof Error ? ${errorVar} : new Error(String(${errorVar})), ${context})`;
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
    const content = fs.readFileSync(filePath, 'utf8');
    const { newContent, modified } = fixLoggerErrors(content, filePath);

    if (modified) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      totalFixed++;
      modifiedFiles.push(filePath);
      console.log(`✅ 수정됨: ${path.relative(srcPath, filePath)}`);
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