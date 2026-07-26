# React Native Specs Archive

최종 업데이트: 2026-07-26

`specs/react-native-app/`는 React Native 전환 과정에서 쌓인 설계 기록과 이행 메모를 보관하던 아카이브입니다.

## ⚠️ 본문 문서 25개 제거됨 (2026-07-26)

2026-03-30 커밋 `c0cb8b575`("docs(repo): 출시 기준 문서 최신화 및 아카이브 정리")에서 이 폴더의
설계 문서 25개가 **전부 `00-overview.md` 내용으로 덮어써지는 사고**가 있었습니다.
각 파일이 동일한 27,355줄(917KB)로 변해 고유 내용이 소실됐고, 총 22MB의 중복만 남아 있었습니다.

- 복구 불가능한 유실이 아니라 **git 히스토리에 원본이 그대로 남아 있습니다**.
- 원본 시점 커밋: `82cee067e` (태그 `archive/2026-07-26/specs-react-native-app-original`)
- 개별 복원: `git checkout 82cee067e -- specs/react-native-app/01-architecture.md`
- 전체 복원: `git checkout 82cee067e -- specs/react-native-app/`
- 예외: `24-board-system.md`는 `cc174c150` 시점이 원본입니다.

중복 22MB를 레포에 계속 두는 실익이 없어 오염본은 제거했습니다. 설계 배경을 확인해야 하면
위 명령으로 필요한 파일만 꺼내 보세요.

## 사용 원칙

- 현재 source of truth가 아닙니다.
- 현재 동작 판단은 `README.md`, `docs/README.md`, `docs/reference/ARCHITECTURE.md`, 실제 코드 기준으로 합니다.
- 이 폴더의 `app2` 비교, migration, 개선율 표는 역사 기록으로만 해석합니다.
- 현재 구현과 불일치할 수 있으므로, 수정 작업 시작 전에 활성 문서와 코드 경로를 먼저 확인합니다.
