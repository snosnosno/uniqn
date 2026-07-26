> 아카이브 문서: `specs/` 아래 문서는 설계 및 이력 보존용입니다. 현재 출시 기준 문서는 루트 `README.md`, `docs/README.md`, `docs/reference/ARCHITECTURE.md`를 우선 확인하세요.

# UNIQN Specs 디렉토리 안내

최종 업데이트: 2026-03-30

## 현재 위치

- `specs/react-native-app/` 문서는 React Native 전환 과정에서 정리한 설계 스냅샷이었습니다.
- 이 디렉토리는 구현 히스토리와 설계 의도를 보존하기 위한 용도이며, 현재 코드와 1:1로 일치하는 운영 문서가 아닐 수 있습니다.
- **2026-07-26**: 본문 문서 25개가 2026-03-30 커밋에서 전부 동일 내용으로 덮어써진 것이 확인되어 제거했습니다. 원본은 git 히스토리(`82cee067e`)에 남아 있습니다 — 복원 방법은 `specs/react-native-app/README.md` 참조.

## 현재 기준 소스 오브 트루스

- 모바일 앱 구현: `uniqn-mobile/`
- 배포 Functions 구현: `functions/`
- 활성 운영 문서 허브: `docs/README.md`

## 읽는 방법

- 기능 구현 여부는 `docs/reference/*`, `docs/guides/*`, `docs/operations/*`를 우선 확인합니다.
- `specs/react-native-app/*`는 설계 배경과 과거 가정을 확인할 때만 참고합니다.

## 주의

- 과거 웹앱 또는 초기 설계 용어가 남아 있을 수 있습니다.
- 미구현 결제/포인트 설계는 현재 출시 기능으로 간주하지 않습니다.
