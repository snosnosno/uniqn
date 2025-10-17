#!/bin/bash
# StaffQRAttendanceService.ts의 logger 호출을 data로 감싸기

FILE="src/services/StaffQRAttendanceService.ts"

# Backup
cp "$FILE" "$FILE.bak"

# logger 호출에서 context 객체를 data로 감싸기 (간단한 패턴만)
# logger.warn('message', { field: value, ... }) -> logger.warn('message', { data: { field: value, ... } })
sed -i "s/logger\.warn('\([^']*\)', {$/logger.warn('\1', { data: {/g" "$FILE"
sed -i "s/logger\.debug('\([^']*\)', {$/logger.debug('\1', { data: {/g" "$FILE"
sed -i "s/logger\.info('\([^']*\)', {$/logger.info('\1', { data: {/g" "$FILE"

# 닫는 괄호 추가 (각 logger 호출 후 });를 }); }); 로 변경)
# 이건 수동으로 처리하는게 안전함

echo "Partial fix applied. Manual fixes still needed for closing braces and error calls."
