import re
import sys

def fix_logger_calls(content):
    # logger.warn/info/debug 패턴: logger.XXX('message', { -> logger.XXX('message', { data: {
    # 그리고 끝의 }); -> } });로 변경
    
    lines = content.split('\n')
    result = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # logger 호출 시작 찾기
        match = re.match(r"^(\s*)(logger\.(warn|info|debug))\('([^']+)', \{$", line)
        if match:
            indent = match.group(1)
            logger_call = match.group(2)
            message = match.group(4)
            
            # data: { 추가
            result.append(f"{indent}{logger_call}('{message}', {{ data: {{")
            i += 1
            
            # 다음 줄부터 닫는 괄호 찾을 때까지 추가
            while i < len(lines):
                line = lines[i]
                if re.match(r'^\s*\}\);$', line):
                    # 닫는 괄호 두 개로 변경
                    result.append(re.sub(r'(\s*)\}\);$', r'\1} });', line))
                    i += 1
                    break
                else:
                    result.append(line)
                    i += 1
        else:
            # logger.error는 이미 error 파라미터가 있으므로 data로 감싸기
            match_error = re.match(r"^(\s*)(logger\.error)\('([^']+)', (.*), \{$", line)
            if match_error:
                indent = match_error.group(1)
                logger_call = match_error.group(2)
                message = match_error.group(3)
                error_param = match_error.group(4)
                
                # data: { 추가
                result.append(f"{indent}{logger_call}('{message}', {error_param}, {{ data: {{")
                i += 1
                
                # 다음 줄부터 닫는 괄호 찾을 때까지 추가
                while i < len(lines):
                    line = lines[i]
                    if re.match(r'^\s*\}\);$', line):
                        # 닫는 괄호 두 개로 변경
                        result.append(re.sub(r'(\s*)\}\);$', r'\1} });', line))
                        i += 1
                        break
                    else:
                        result.append(line)
                        i += 1
            else:
                result.append(line)
                i += 1
    
    return '\n'.join(result)

# Read file
with open('src/services/StaffQRAttendanceService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix logger calls
fixed_content = fix_logger_calls(content)

# Write back
with open('src/services/StaffQRAttendanceService.ts', 'w', encoding='utf-8') as f:
    f.write(fixed_content)

print("Fixed logger calls in StaffQRAttendanceService.ts")
