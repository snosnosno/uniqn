# UNIQN Project

UNIQN is a mobile-first operations platform for poker tournament staffing and employer workflows.

Active workspaces in this repository:

- `uniqn-mobile/`: Expo / React Native application
- `functions/`: deployed Firebase Functions source

`app2/` is legacy and should not receive new product work.

## Quick Start

App:

```bash
cd uniqn-mobile
npm install
cp .env.example .env.local
npm run quality
npm start
```

Functions:

```bash
cd functions
npm install
cp .env.example .env
npm run build
npm test
```

## Repository Layout

```text
T-HOLDEM/
|-- uniqn-mobile/   # Expo app
|-- functions/      # Firebase Functions entrypoint used for deploys
|-- docs/           # documentation
|-- specs/          # product and technical specs
`-- app2/           # legacy app
```

Important distinction:

- Root `functions/` is the production Functions workspace.
- `uniqn-mobile/functions/` is not the deployed Firebase Functions root and should not be treated as the backend entrypoint.

## Canonical Ownership

Inside `uniqn-mobile/src`, use these modules as the single source of truth:

- `@/shared/status`: status types, labels, flows, and mappers
- `@/constants/statusConfig`: UI status colors, variants, and display config
- `@/domains/settlement`: settlement calculators and default salary/tax constants
- `@/shared/realtime`: realtime surface (`RealtimeManager`, `useRealtimeSubscription`)
- `@/types`: type-only barrel; import runtime values from their original modules

## Reference Docs

- `AGENTS.md`
- `CLAUDE.md`
- `docs/core/DEVELOPMENT_GUIDE.md`
- `docs/reference/ARCHITECTURE.md`
- `docs/core/TESTING_GUIDE.md`

## Notes

- Before release, run `npm run quality` from `uniqn-mobile/`.
- For multi-document Firestore changes, keep transaction order as read -> validate -> write.
- Prefer current source in `uniqn-mobile/src/` and `functions/src/` over older planning documents when they differ.
