#!/bin/bash
# Firebase 설정 파일 복원 스크립트
# EAS Build 시 자동 실행

set -e

echo "📱 Firebase 설정 파일 복원 시작..."

# Android: google-services.json
if [ -n "$GOOGLE_SERVICES_JSON_BASE64" ]; then
  echo "  ✓ google-services.json 복원 중..."
  echo "$GOOGLE_SERVICES_JSON_BASE64" | base64 -d > google-services.json
  echo "  ✓ google-services.json 복원 완료"
else
  echo "  ⚠ GOOGLE_SERVICES_JSON_BASE64 환경 변수가 없습니다"
fi

# iOS: GoogleService-Info.plist
if [ -n "$GOOGLE_SERVICE_INFO_PLIST_BASE64" ]; then
  echo "  ✓ GoogleService-Info.plist 복원 중..."
  echo "$GOOGLE_SERVICE_INFO_PLIST_BASE64" | base64 -d > GoogleService-Info.plist
  echo "  ✓ GoogleService-Info.plist 복원 완료"
else
  echo "  ⚠ GOOGLE_SERVICE_INFO_PLIST_BASE64 환경 변수가 없습니다"
fi

echo "📱 Firebase 설정 파일 복원 완료!"
