import { logger } from '../utils/logger';

const fs = require('fs');
const path = require('path');

// catch 블록에서 변수명과 error 사용이 일치하지 않는 모든 패턴을 수정
function fixAllCatchErrors(content, filePath) {
  let fixed = content;
  let changesMade = false;
  
  // 모든 catch 블록을 찾기
  const catchRegex = /} catch \((\w+)(?::\s*any)?\) {/g;
  const matches = [...content.matchAll(catchRegex)];
  
  // 역순으로 처리 (인덱스가 변경되지 않도록)
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const catchVar = match[1];
    const startIndex = match.index;
    
    if (catchVar !== 'error') {
      // catch 블록의 끝 찾기
      let braceCount = 0;
      let endIndex = startIndex + match[0].length;
      
      for (let j = endIndex; j < content.length; j++) {
        if (content[j] === '{') {
          braceCount++;
        } else if (content[j] === '}') {
          if (braceCount === 0) {
            endIndex = j + 1;
            break;
          }
          braceCount--;
        }
      }
      
      // catch 블록 내용
      const catchBlock = content.substring(startIndex, endIndex);
      
      // 모든 'error' 사용을 실제 catch 변수명으로 변경
      let fixedBlock = catchBlock;
      
      // error instanceof Error 패턴
      const errorPattern = new RegExp(`\\berror\\b(?=\\s*instanceof\\s*Error)`, 'g');
      fixedBlock = fixedBlock.replace(errorPattern, catchVar);
      
      // String(error) 패턴
      const stringErrorPattern = new RegExp(`String\\s*\\(\\s*error\\s*\\)`, 'g');
      fixedBlock = fixedBlock.replace(stringErrorPattern, `String(${catchVar})`);
      
      // new Error(String(error)) 패턴
      const newErrorPattern = new RegExp(`new\\s+Error\\s*\\(\\s*String\\s*\\(\\s*error\\s*\\)\\s*\\)`, 'g');
      fixedBlock = fixedBlock.replace(newErrorPattern, `new Error(String(${catchVar}))`);
      
      // error ? error : 패턴
      const ternaryPattern = new RegExp(`\\berror\\s*\\?\\s*error\\s*:`, 'g');
      fixedBlock = fixedBlock.replace(ternaryPattern, `${catchVar} ? ${catchVar} :`);
      
      if (fixedBlock !== catchBlock) {
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
    const { fixed, changesMade } = fixAllCatchErrors(content, filePath);
    
    if (changesMade) {
      fs.writeFileSync(filePath, fixed, 'utf8');
      logger.info(`✅ Fixed catch errors in: ${filePath}`, { component: 'fixAllCatchErrors' });
      return true;
    }
    return false;
  } catch (error) {
    logger.error('❌ Error processing ${filePath}:', error.message instanceof Error ? error.message : new Error(String(error.message)), { component: 'fixAllCatchErrors' });
    return false;
  }
}

// 실행
const srcPath = path.join(__dirname, '..');
logger.info('🔄 Fixing ALL catch errors...', { component: 'fixAllCatchErrors' });
logger.info(`📁 Processing directory: ${srcPath}`, { component: 'fixAllCatchErrors' });
const totalFixed = processDirectory(srcPath);
logger.info('✨ Catch error fix complete! Fixed ${totalFixed} files.', { component: 'fixAllCatchErrors' });