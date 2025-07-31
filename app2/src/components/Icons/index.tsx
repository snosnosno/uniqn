import React from 'react';

// 아이콘 Props 타입 정의
interface IconProps {
  className?: string;
  onClick?: () => void;
}

// 가장 많이 사용되는 아이콘들을 SVG로 직접 구현

export const ClockIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
  </svg>
);

export const TimesIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

export const UsersIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
  </svg>
);

export const CalendarIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
  </svg>
);

export const CheckCircleIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

export const ExclamationTriangleIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

export const InfoCircleIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
  </svg>
);

export const SaveIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path d="M7.5 5.5A1.5 1.5 0 006 4H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V7.5A1.5 1.5 0 0016.5 6H15v8.5a1.5 1.5 0 01-1.5 1.5h-3a1.5 1.5 0 01-1.5-1.5V6H6v8.5A1.5 1.5 0 014.5 16H4a.5.5 0 01-.5-.5v-9A.5.5 0 014 6h2.5A1.5 1.5 0 007.5 5.5z"/>
    <path d="M10.5 2.5a1 1 0 00-1 1v8a1 1 0 102 0v-8a1 1 0 00-1-1z"/>
  </svg>
);

export const TableIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clipRule="evenodd" />
  </svg>
);

export const CoffeeIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 24 24"
    onClick={onClick}
  >
    <path d="M2 21h18v-2H2M20 8h-2V5h2m0-2h-2v.1A7 7 0 0011 2C7.93 2 4.68 3.04 2 5.05V16l.02.05C4.7 17.5 7.91 18.5 11 18.5s6.3-1 9-2.46l-.02-.05V5c0-1.1-.9-2-2-2m-9 13c-2.7 0-5.2-.64-7-1.63V7.45c1.84-1.03 4.31-1.64 7-1.64s5.16.61 7 1.64v5.81c-1.8.99-4.3 1.63-7 1.63z"/>
  </svg>
);

export const ExclamationIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

export const InformationCircleIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
  </svg>
);

export const PlusIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
);

export const CogIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
);

// 자주 사용되지 않는 아이콘들은 lazy loading으로 처리
export const GoogleIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24"
    onClick={onClick}
  >
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// 방향 아이콘
export const ChevronUpIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

export const ChevronDownIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

// 기타 자주 사용되는 아이콘들
export const UserIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
  </svg>
);

export const PhoneIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
  </svg>
);

export const MailIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
  </svg>
);

export const HistoryIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
  </svg>
);

export const TrophyIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.5a2 2 0 00-2-2h-2.5c-.276 0-.5-.224-.5-.5v-2c0-.276.224-.5.5-.5h2.5a2 2 0 002-2V5a2 2 0 00-2-2H5zM9 9a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1z" clipRule="evenodd" />
  </svg>
);

export const EditIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20"
    onClick={onClick}
  >
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);