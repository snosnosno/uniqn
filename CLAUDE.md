# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

T-HOLDEM is a web-based platform for managing Hold'em poker tournaments. Built with React + TypeScript + Firebase, it provides dealer shift management, QR code attendance, staff management, and tournament operations.

## Common Development Commands

### Development Environment
```bash
# Start both Firebase emulators and React dev server
start-dev.bat  # Windows batch script

# Manual startup (alternative)
firebase emulators:start --only functions,auth,firestore
cd app2 && npm start

# Using package.json scripts
cd app2
npm run dev  # Starts emulators and React server
npm run emulators  # Firebase emulators only
```

### Frontend (app2/)
```bash
cd app2

# Development
npm start                    # React development server
npm run build               # Production build
npm run build --no-eslint  # Build without ESLint

# Code Quality
npm run lint                # Run ESLint
npm run lint:fix           # Fix ESLint errors
npm run format             # Format code with Prettier
npm run format:check       # Check formatting
npm run type-check         # TypeScript check
npm run quality            # Run all quality checks
npm run quality:fix        # Fix all quality issues

# Testing
npm test                   # Run tests
npm run analyze           # Build and serve for analysis
```

### Backend (functions/)
```bash
cd functions

# Development
npm run serve             # Local emulator with build
npm run build            # TypeScript compilation
npm run shell            # Firebase functions shell
npm run start            # Start shell (alias)

# Testing
npm run test             # Run tests with emulator

# Deployment
npm run deploy           # Build and deploy functions
npm run logs             # View function logs

# Code Quality
npm run lint             # ESLint for functions
```

### Firebase Deployment
```bash
# Individual deployments
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules

# Full deployment
npm run deploy:all       # From app2/: builds frontend + deploys all
firebase deploy          # Deploy everything
```

## Architecture Overview

### Technology Stack
- **Frontend**: React 18 + TypeScript + Tailwind CSS + react-data-grid
- **Backend**: Firebase (Firestore + Functions + Auth)
- **Key Libraries**: react-router-dom v6, react-firebase-hooks, @tanstack/react-query
- **Development**: ESLint + Prettier + Firebase CLI

### Project Structure
```
app2/src/
├── components/          # Reusable UI components
│   ├── common/         # Basic UI components (Button, Input, etc.)
│   └── tabs/           # Tab-based components for admin panels
├── pages/              # Route-based page components
│   ├── admin/         # Admin-only pages (DashboardPage, UserManagementPage)
│   └── *.tsx          # Public/shared pages
├── hooks/              # Custom React hooks for data management
├── contexts/           # React Context providers (Auth, Toast, etc.)
├── utils/              # Business logic utilities
│   ├── payroll/       # Payroll calculation logic
│   └── *.ts           # Various utilities (validation, time, etc.)
├── types/              # TypeScript type definitions
└── firebase.ts         # Firebase configuration
```

### Key Components
- **ShiftGridComponent**: Excel-like grid for dealer shift management using react-data-grid
- **RoleBasedRoute**: Route guard based on user roles (Admin/Manager/Staff)
- **Layout**: Main application layout with navigation
- **Toast**: Notification system

### Data Architecture
Main Firestore collections:
- `jobPostings`: Events/tournaments (replaces old Events system)
- `staff`: Staff information and status
- `shiftSchedules`: Dealer shift schedules with validation
- `workLogs`: Work records generated from schedules
- `users`: User authentication and profile data
- `applications`: Job applications linked to jobPostings

## Key Development Patterns

### Role-Based Access Control
Three user roles with different access levels:
- **Admin**: Full system access, user management, approvals
- **Manager**: Event and staff management, scheduling
- **Staff**: Personal profile, job board access, attendance

### Firebase Integration
- Use Firebase v9 modular SDK
- Prefer `onSnapshot` for real-time data
- Implement proper error boundaries with `FirebaseErrorBoundary`
- Use batched writes for multiple document operations

### State Management
- React Context for global state (Auth, Toast)
- Custom hooks for data fetching and mutations
- @tanstack/react-query for server state management

### Validation System
Shift schedule validation with three levels:
- **ERROR**: Table conflicts (same table, same time, multiple dealers)
- **WARNING**: Long shifts (4+ hours), short breaks (<30 min)
- **INFO**: Schedule gaps (2+ hours)

## Important Development Notes

### Deprecated Systems
- **Events collection**: Completely removed - use `jobPostings` instead
- **DealerEventsListPage**: Removed - Staff users now go to ProfilePage

### Critical Files
- `app2/src/firebase.ts`: Firebase configuration
- `app2/src/App.tsx`: Main routing setup
- `app2/src/utils/shiftValidation.ts`: Core business logic for shift validation
- `functions/src/index.ts`: Cloud Functions (attendance, logging)

### Testing Setup
- Jest + React Testing Library configured
- Firebase emulators for integration testing
- Tests should run with: `npm test` (frontend) or `npm run test` (functions)

### Code Quality Standards
- TypeScript strict mode enabled
- ESLint + Prettier configured
- Maximum 0 warnings policy
- Always run quality checks before commits: `npm run quality`

### Common Patterns to Follow
1. Use custom hooks for Firebase operations
2. Implement loading states and error handling
3. Use TypeScript interfaces for all data structures
4. Follow existing component patterns for consistency
5. Use Tailwind CSS classes, avoid custom CSS
6. Implement proper cleanup in useEffect hooks

### SHRIMP Task Manager Integration
- WebGUI available at: http://localhost:53387?lang=en
- Used for project task management and development workflow
- Check SHRIMP/tasks.json for current development tasks

## Troubleshooting

### Common Issues
- **Firebase connection**: Ensure emulators are running on correct ports
- **Build failures**: Run `npm run quality:fix` to resolve lint/format issues
- **TypeScript errors**: Run `npm run type-check` to identify issues
- **Test failures**: Ensure Firebase emulators are running for integration tests

### Debug Logs
- Frontend: Browser developer console
- Backend: Firebase Functions logs or emulator console
- Firestore: Check firestore-debug.log files