const fs = require('fs');
const path = require('path');

// 모든 error 패턴을 수정하는 함수
function fixAllErrorPatterns(content, filePath) {
  let fixed = content;
  let changesMade = false;
  
  // 1. catch (변수) 블록에서 잘못된 error 사용 찾기
  // catch (err) { ... error instanceof Error ? error : ... } 패턴
  const catchErrorPattern = /catch\s*\((\w+)(?::\s*any)?\)\s*{[^}]*\berror\s+instanceof\s+Error/g;
  let matches = [...content.matchAll(catchErrorPattern)];
  
  for (const match of matches) {
    const catchVar = match[1];
    if (catchVar !== 'error') {
      // catch 블록 내에서 잘못된 error 사용을 모두 수정
      const startIndex = match.index;
      let endIndex = content.indexOf('}', startIndex);
      
      // 중첩된 중괄호 처리
      let braceCount = 1;
      for (let i = startIndex + match[0].length; i < content.length && braceCount > 0; i++) {
        if (content[i] === '{') braceCount++;
        else if (content[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            endIndex = i + 1;
            break;
          }
        }
      }
      
      const catchBlock = content.substring(startIndex, endIndex);
      let fixedBlock = catchBlock;
      
      // error instanceof Error ? error : 패턴을 catchVar로 변경
      fixedBlock = fixedBlock.replace(/\berror\s+instanceof\s+Error\s*\?\s*error\s*:/g, 
        `${catchVar} instanceof Error ? ${catchVar} :`);
      
      if (fixedBlock !== catchBlock) {
        fixed = fixed.substring(0, startIndex) + fixedBlock + fixed.substring(endIndex);
        changesMade = true;
      }
    }
  }
  
  // 2. 에러 핸들러 콜백에서 잘못된 error 사용 찾기
  // }, (err) => { ... error instanceof Error ? error : ... } 패턴
  const callbackErrorPattern = /},\s*\((\w+)\)\s*=>\s*{[^}]*\berror\s+instanceof\s+Error/g;
  matches = [...fixed.matchAll(callbackErrorPattern)];
  
  for (const match of matches) {
    const paramVar = match[1];
    if (paramVar !== 'error') {
      // 콜백 블록 내에서 잘못된 error 사용을 모두 수정
      const startIndex = match.index;
      let endIndex = fixed.indexOf('}', startIndex + match[0].length);
      
      // 중첩된 중괄호 처리
      let braceCount = 1;
      for (let i = startIndex + match[0].length; i < fixed.length && braceCount > 0; i++) {
        if (fixed[i] === '{') braceCount++;
        else if (fixed[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            endIndex = i + 1;
            break;
          }
        }
      }
      
      const callbackBlock = fixed.substring(startIndex, endIndex);
      let fixedBlock = callbackBlock;
      
      // error instanceof Error ? error : 패턴을 paramVar로 변경
      fixedBlock = fixedBlock.replace(/\berror\s+instanceof\s+Error\s*\?\s*error\s*:/g, 
        `${paramVar} instanceof Error ? ${paramVar} :`);
      
      if (fixedBlock !== callbackBlock) {
        fixed = fixed.substring(0, startIndex) + fixedBlock + fixed.substring(endIndex);
        changesMade = true;
      }
    }
  }
  
  return { fixed, changesMade };
}

// 디렉토리 순회 함수
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  let totalFixed = 0;
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // node_modules, build 등 제외
      if (!['node_modules', 'build', 'dist', '.git'].includes(file)) {
        totalFixed += processDirectory(filePath);
      }
    } else if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !file.includes('fix')) {
      if (processFile(filePath)) {
        totalFixed++;
      }
    }
  });
  
  return totalFixed;
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { fixed, changesMade } = fixAllErrorPatterns(content, filePath);
    
    if (changesMade) {
      fs.writeFileSync(filePath, fixed, 'utf8');
      console.log(`✅ Fixed error patterns in: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// 실행
const srcPath = path.join(__dirname, '..');
console.log('🔄 Fixing ALL error patterns...');
console.log(`📁 Processing directory: ${srcPath}`);
const totalFixed = processDirectory(srcPath);
console.log(`✨ Fix complete! Fixed ${totalFixed} files.`);