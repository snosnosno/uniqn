import { SECONDARY_PALETTE } from '@/constants/colors';
import React from 'react';
import Svg, { Circle, Line, Path, Polyline, Polygon, Rect } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
import { useColorScheme } from 'nativewind';

export type IconProps = Omit<SvgProps, 'width' | 'height' | 'color'> & {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export type IconComponent = React.FunctionComponent<IconProps>;

type BookmarkIconProps = IconProps & {
  filled?: boolean;
};

type IconRenderer = (color: string, strokeWidth: number) => React.ReactNode;
type SolidIconRenderer = (color: string) => React.ReactNode;

const DEFAULT_SIZE = 24;
const DEFAULT_COLOR_LIGHT = SECONDARY_PALETTE[500];
const DEFAULT_COLOR_DARK = SECONDARY_PALETTE[400];

export const DEFAULT_COLOR = DEFAULT_COLOR_LIGHT;

export function getDefaultIconColor(
  colorScheme: 'light' | 'dark' | undefined,
  explicitColor?: string
): string {
  if (explicitColor) return explicitColor;
  return colorScheme === 'dark' ? DEFAULT_COLOR_DARK : DEFAULT_COLOR_LIGHT;
}

function useDefaultColor(explicitColor?: string): string {
  const { colorScheme } = useColorScheme();
  return getDefaultIconColor(colorScheme, explicitColor);
}

function getStrokeProps(color: string, strokeWidth: number) {
  return {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };
}

function createOutlineIcon(render: IconRenderer, viewBox = '0 0 24 24'): IconComponent {
  return function OutlineIcon({ size = DEFAULT_SIZE, color, strokeWidth = 2, ...rest }: IconProps) {
    const resolvedColor = useDefaultColor(color);

    return (
      <Svg width={size} height={size} viewBox={viewBox} fill="none" {...rest}>
        {render(resolvedColor, strokeWidth)}
      </Svg>
    );
  };
}

function createSolidIcon(render: SolidIconRenderer, viewBox = '0 0 24 24'): IconComponent {
  return function SolidIcon({
    size = DEFAULT_SIZE,
    color,
    strokeWidth: _strokeWidth = 2,
    ...rest
  }: IconProps) {
    const resolvedColor = useDefaultColor(color);

    return (
      <Svg width={size} height={size} viewBox={viewBox} fill="none" {...rest}>
        {render(resolvedColor)}
      </Svg>
    );
  };
}

const heartOutlinePath =
  'M12 20.5s-6.5-4.16-8.33-8.02A4.93 4.93 0 0 1 12 6.27a4.93 4.93 0 0 1 8.33 6.21C18.5 16.34 12 20.5 12 20.5Z';
const bookmarkPath = 'M7 4.5h10v15L12 16l-5 3.5V4.5Z';

export const HomeIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path d="M3.5 10.5 12 3.5l8.5 7" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M6.5 9.5v11h11v-11" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M10 20.5v-5h4v5" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const SearchIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Circle cx="10.5" cy="10.5" r="5.5" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="15" y1="15" x2="20" y2="20" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const BellIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path
      d="M18 16H6c1.33-1.2 2-3 2-5V9a4 4 0 1 1 8 0v2c0 2 .67 3.8 2 5Z"
      {...getStrokeProps(color, strokeWidth)}
    />
    <Path d="M9.5 18a2.5 2.5 0 0 0 5 0" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const UserIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Circle cx="12" cy="8" r="3.5" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M5 19c1.8-2.67 4.13-4 7-4s5.2 1.33 7 4" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const UsersIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Circle cx="9" cy="8.5" r="2.75" {...getStrokeProps(color, strokeWidth)} />
    <Circle cx="16.5" cy="9.5" r="2.25" {...getStrokeProps(color, strokeWidth)} />
    <Path
      d="M3.5 18c1.5-2.33 3.33-3.5 5.5-3.5 2.17 0 4 1.17 5.5 3.5"
      {...getStrokeProps(color, strokeWidth)}
    />
    <Path
      d="M13.5 17.5c1.07-1.6 2.37-2.4 3.9-2.4 1.53 0 2.83.8 3.9 2.4"
      {...getStrokeProps(color, strokeWidth)}
    />
  </>
));

export const SettingsIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Circle cx="12" cy="12" r="3.25" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="12" y1="2.5" x2="12" y2="5" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="12" y1="19" x2="12" y2="21.5" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="2.5" y1="12" x2="5" y2="12" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="19" y1="12" x2="21.5" y2="12" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="5.4" y1="5.4" x2="7.2" y2="7.2" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="16.8" y1="16.8" x2="18.6" y2="18.6" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="18.6" y1="5.4" x2="16.8" y2="7.2" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="7.2" y1="16.8" x2="5.4" y2="18.6" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const MenuIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Line x1="4" y1="7" x2="20" y2="7" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="4" y1="12" x2="20" y2="12" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="4" y1="17" x2="20" y2="17" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const XMarkIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Line x1="6" y1="6" x2="18" y2="18" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="18" y1="6" x2="6" y2="18" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const ChevronLeftIcon = createOutlineIcon((color, strokeWidth) => (
  <Polyline points="15 5 8 12 15 19" {...getStrokeProps(color, strokeWidth)} />
));

export const ChevronRightIcon = createOutlineIcon((color, strokeWidth) => (
  <Polyline points="9 5 16 12 9 19" {...getStrokeProps(color, strokeWidth)} />
));

export const ChevronDownIcon = createOutlineIcon((color, strokeWidth) => (
  <Polyline points="5 9 12 16 19 9" {...getStrokeProps(color, strokeWidth)} />
));

export const ChevronUpIcon = createOutlineIcon((color, strokeWidth) => (
  <Polyline points="5 15 12 8 19 15" {...getStrokeProps(color, strokeWidth)} />
));

export const PlusIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Line x1="12" y1="5" x2="12" y2="19" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="5" y1="12" x2="19" y2="12" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const MinusIcon = createOutlineIcon((color, strokeWidth) => (
  <Line x1="5" y1="12" x2="19" y2="12" {...getStrokeProps(color, strokeWidth)} />
));

export const EditIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path d="M4 20l4.5-.9L18 9.6 14.4 6 4.9 15.5 4 20Z" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M13.9 6.5 17.5 10.1" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const TrashIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path d="M4 7h16" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M9 7V4h6v3" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M7 7l1 13h8l1-13" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="10" y1="11" x2="10" y2="17" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="14" y1="11" x2="14" y2="17" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const CopyIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Rect x="8" y="8" width="11" height="11" rx="2" {...getStrokeProps(color, strokeWidth)} />
    <Rect x="5" y="5" width="11" height="11" rx="2" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const ShareIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Circle cx="17.5" cy="6.5" r="2.5" {...getStrokeProps(color, strokeWidth)} />
    <Circle cx="6.5" cy="12" r="2.5" {...getStrokeProps(color, strokeWidth)} />
    <Circle cx="17.5" cy="17.5" r="2.5" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="8.9" y1="10.9" x2="15.1" y2="7.6" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="8.9" y1="13.1" x2="15.1" y2="16.4" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const FilterIcon = createOutlineIcon((color, strokeWidth) => (
  <Path d="M4 6h16l-6 7v5l-4 2v-7L4 6Z" {...getStrokeProps(color, strokeWidth)} />
));

export const RefreshIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path d="M20 11a8 8 0 0 0-13.66-4.95L4 8" {...getStrokeProps(color, strokeWidth)} />
    <Polyline points="4 4 4 8 8 8" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M4 13a8 8 0 0 0 13.66 4.95L20 16" {...getStrokeProps(color, strokeWidth)} />
    <Polyline points="16 16 20 16 20 20" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const CheckIcon = createOutlineIcon((color, strokeWidth) => (
  <Polyline points="5 13 10 18 19 7" {...getStrokeProps(color, strokeWidth)} />
));

export const CheckCircleIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Circle cx="12" cy="12" r="9" {...getStrokeProps(color, strokeWidth)} />
    <Polyline points="8 12.5 11 15.5 17 9" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const AlertCircleIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Circle cx="12" cy="12" r="9" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="12" y1="7.5" x2="12" y2="13" {...getStrokeProps(color, strokeWidth)} />
    <Circle cx="12" cy="16.5" r="1" fill={color} />
  </>
));

export const ExclamationCircleIcon = AlertCircleIcon;

export const ExclamationTriangleIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path d="M12 4 21 19H3L12 4Z" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="12" y1="9" x2="12" y2="13.5" {...getStrokeProps(color, strokeWidth)} />
    <Circle cx="12" cy="16.5" r="1" fill={color} />
  </>
));

export const InformationCircleIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Circle cx="12" cy="12" r="9" {...getStrokeProps(color, strokeWidth)} />
    <Circle cx="12" cy="8" r="1" fill={color} />
    <Line x1="12" y1="11" x2="12" y2="16" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const CalendarIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Rect x="4" y="6.5" width="16" height="13" rx="2" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="8" y1="3.5" x2="8" y2="8" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="16" y1="3.5" x2="16" y2="8" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="4" y1="10" x2="20" y2="10" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const ClockIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Circle cx="12" cy="12" r="9" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="12" y1="7" x2="12" y2="12" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="12" y1="12" x2="15.5" y2="14.5" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const MapPinIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path
      d="M12 20.5s-5-4.03-5-8.5a5 5 0 1 1 10 0c0 4.47-5 8.5-5 8.5Z"
      {...getStrokeProps(color, strokeWidth)}
    />
    <Circle cx="12" cy="12" r="1.75" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const MapIcon = MapPinIcon;

export const PhoneIcon = createOutlineIcon((color, strokeWidth) => (
  <Path
    d="M7 4.5c.5 4 7.5 11 11.5 11.5L21 12.5c-1.3-.7-2.8-.83-4.25-.4l-1.5.45c-1.92-1.18-3.62-2.88-4.8-4.8l.45-1.5c.43-1.45.3-2.95-.4-4.25L7 4.5Z"
    {...getStrokeProps(color, strokeWidth)}
  />
));

export const MailIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Rect x="4" y="6.5" width="16" height="11" rx="2" {...getStrokeProps(color, strokeWidth)} />
    <Polyline points="5.5 8 12 13 18.5 8" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const CurrencyDollarIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Line x1="12" y1="3" x2="12" y2="21" {...getStrokeProps(color, strokeWidth)} />
    <Path
      d="M15.5 7c0-1.5-1.57-2.5-3.5-2.5S8.5 5.6 8.5 7c0 1.72 1.28 2.38 3.5 3 2.22.62 3.5 1.28 3.5 3 0 1.4-1.57 2.5-3.5 2.5S8.5 14.4 8.5 13"
      {...getStrokeProps(color, strokeWidth)}
    />
  </>
));

export const BriefcaseIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Rect x="4" y="7" width="16" height="11" rx="2" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M9 7V5h6v2" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="4" y1="12" x2="20" y2="12" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const DocumentIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path d="M7 3.5h7l5 5v12H7v-17Z" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M14 3.5v5h5" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="9.5" y1="12" x2="16.5" y2="12" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="9.5" y1="15.5" x2="16.5" y2="15.5" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const DocumentTextOutlineIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path
      d="M6.5 3.75h7.25l3.75 3.75V20a1.75 1.75 0 0 1-1.75 1.75h-9.5A1.75 1.75 0 0 1 4.5 20V5.5A1.75 1.75 0 0 1 6.25 3.75Z"
      {...getStrokeProps(color, strokeWidth)}
    />
    <Path d="M13.75 3.75V7.5h3.75" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="8" y1="11" x2="16" y2="11" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="8" y1="14.5" x2="16" y2="14.5" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="8" y1="18" x2="13.5" y2="18" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const ImageIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Rect x="4" y="5.5" width="16" height="13" rx="2" {...getStrokeProps(color, strokeWidth)} />
    <Circle cx="9" cy="10" r="1.5" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M7 16l3.5-3.5L13 15l2.5-2.5L18 16" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const CameraIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Rect x="4" y="7" width="16" height="11" rx="2" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M8 7l1.5-2h5L16 7" {...getStrokeProps(color, strokeWidth)} />
    <Circle cx="12" cy="12.5" r="3" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const EyeIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path
      d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z"
      {...getStrokeProps(color, strokeWidth)}
    />
    <Circle cx="12" cy="12" r="2.5" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const EyeSlashIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path
      d="M3 12s3.5-5.5 9-5.5c2.18 0 4.02.87 5.5 2.01 1.17.9 2.01 1.99 2.5 2.64"
      {...getStrokeProps(color, strokeWidth)}
    />
    <Path
      d="M21 12s-3.5 5.5-9 5.5c-2.2 0-4.05-.88-5.54-2.04C5.28 14.55 4.46 13.46 4 12.82"
      {...getStrokeProps(color, strokeWidth)}
    />
    <Line x1="4" y1="4" x2="20" y2="20" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const LockIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Rect x="6" y="11" width="12" height="9" rx="2" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M8 11V8a4 4 0 1 1 8 0v3" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const UnlockIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Rect x="6" y="11" width="12" height="9" rx="2" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M16 11V8a4 4 0 0 0-7-2.65" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const LogOutIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path d="M10 4H6v16h4" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="10" y1="12" x2="20" y2="12" {...getStrokeProps(color, strokeWidth)} />
    <Polyline points="16 8 20 12 16 16" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const LogInIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path d="M14 4h4v16h-4" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="4" y1="12" x2="14" y2="12" {...getStrokeProps(color, strokeWidth)} />
    <Polyline points="8 8 4 12 8 16" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const ArrowRightIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Line x1="4" y1="12" x2="20" y2="12" {...getStrokeProps(color, strokeWidth)} />
    <Polyline points="14 6 20 12 14 18" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const ArrowLeftIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Line x1="20" y1="12" x2="4" y2="12" {...getStrokeProps(color, strokeWidth)} />
    <Polyline points="10 6 4 12 10 18" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const HeartIcon = createOutlineIcon((color, strokeWidth) => (
  <Path d={heartOutlinePath} {...getStrokeProps(color, strokeWidth)} />
));

export const HeartFilledIcon = ({ size = DEFAULT_SIZE, color = '#DC2626', ...rest }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
    <Path d={heartOutlinePath} fill={color} />
  </Svg>
);

export const HeartOutlineIcon = HeartIcon;

export const BookmarkOutlineIcon = createOutlineIcon((color, strokeWidth) => (
  <Path d={bookmarkPath} {...getStrokeProps(color, strokeWidth)} />
));

export const BookmarkFilledIcon = ({
  size = DEFAULT_SIZE,
  color = '#D4A017',
  ...rest
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
    <Path d={bookmarkPath} fill={color} />
  </Svg>
);

export const BookmarkIcon = ({
  size = DEFAULT_SIZE,
  color,
  filled = false,
  ...rest
}: BookmarkIconProps) => {
  if (filled) {
    return <BookmarkFilledIcon size={size} color={color || '#D4A017'} {...rest} />;
  }

  return <BookmarkOutlineIcon size={size} color={color} {...rest} />;
};

export const StarIcon = createOutlineIcon((color, strokeWidth) => (
  <Polygon
    points="12,3.5 14.8,8.8 20.7,9.7 16.4,13.8 17.4,19.8 12,16.9 6.6,19.8 7.6,13.8 3.3,9.7 9.2,8.8"
    {...getStrokeProps(color, strokeWidth)}
  />
));

export const MessageIcon = createOutlineIcon((color, strokeWidth) => (
  <Path
    d="M5 18.5V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 2.5Z"
    {...getStrokeProps(color, strokeWidth)}
  />
));

export const LoaderIcon = ({ size = DEFAULT_SIZE, color, strokeWidth = 2, ...rest }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  const segments = [
    { x1: 12, y1: 3, x2: 12, y2: 6, opacity: 0.28 },
    { x1: 16.95, y1: 5.05, x2: 14.83, y2: 7.17, opacity: 0.4 },
    { x1: 21, y1: 12, x2: 18, y2: 12, opacity: 0.52 },
    { x1: 16.95, y1: 18.95, x2: 14.83, y2: 16.83, opacity: 0.64 },
    { x1: 12, y1: 21, x2: 12, y2: 18, opacity: 0.76 },
    { x1: 7.05, y1: 18.95, x2: 9.17, y2: 16.83, opacity: 0.88 },
    { x1: 3, y1: 12, x2: 6, y2: 12, opacity: 1 },
    { x1: 7.05, y1: 5.05, x2: 9.17, y2: 7.17, opacity: 0.16 },
  ];

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
      {segments.map((segment, index) => (
        <Line
          key={index}
          x1={segment.x1}
          y1={segment.y1}
          x2={segment.x2}
          y2={segment.y2}
          stroke={resolvedColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={segment.opacity}
        />
      ))}
    </Svg>
  );
};

export const QrCodeIcon = createSolidIcon((color) => (
  <Path
    fill={color}
    fillRule="evenodd"
    clipRule="evenodd"
    d="M3 3h8v8H3V3Zm2 2v4h4V5H5Zm8-2h8v8h-8V3Zm2 2v4h4V5h-4ZM3 13h8v8H3v-8Zm2 2v4h4v-4H5Zm8-4h2v2h-2v-2Zm3 0h2v2h-2v-2Zm-3 3h2v2h-2v-2Zm3 0h5v2h-1v5h-2v-2h-2v-3Zm-3 3h2v2h-2v-2Zm3 3h2v2h-2v-2Z"
  />
));

export const ScanIcon = createSolidIcon((color) => (
  <Path
    fill={color}
    d="M5 3h4v2H5v4H3V5a2 2 0 0 1 2-2Zm10 0h4a2 2 0 0 1 2 2v4h-2V5h-4V3ZM3 15h2v4h4v2H5a2 2 0 0 1-2-2v-4Zm16 0h2v4a2 2 0 0 1-2 2h-4v-2h4v-4ZM7 7h4v4H7V7Zm6 0h4v2h-4V7Zm-6 6h2v2H7v-2Zm4-2h2v2h-2v-2Zm4 0h2v6h-2v-6Zm-4 4h2v2h-2v-2Z"
  />
));

export const BellSlashIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path
      d="M18 16H6c1.33-1.2 2-3 2-5V9a4 4 0 0 1 6.44-3.14"
      {...getStrokeProps(color, strokeWidth)}
    />
    <Path d="M9.5 18a2.5 2.5 0 0 0 5 0" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="4" y1="4" x2="20" y2="20" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const UserPlusIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Circle cx="10" cy="8" r="3.5" {...getStrokeProps(color, strokeWidth)} />
    <Path
      d="M3.5 19c1.7-2.67 3.87-4 6.5-4 2.63 0 4.8 1.33 6.5 4"
      {...getStrokeProps(color, strokeWidth)}
    />
    <Line x1="18" y1="8" x2="18" y2="14" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="15" y1="11" x2="21" y2="11" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const UserMinusIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Circle cx="10" cy="8" r="3.5" {...getStrokeProps(color, strokeWidth)} />
    <Path
      d="M3.5 19c1.7-2.67 3.87-4 6.5-4 2.63 0 4.8 1.33 6.5 4"
      {...getStrokeProps(color, strokeWidth)}
    />
    <Line x1="15" y1="11" x2="21" y2="11" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const XCircleIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Circle cx="12" cy="12" r="9" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="8.5" y1="8.5" x2="15.5" y2="15.5" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="15.5" y1="8.5" x2="8.5" y2="15.5" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const CloseCircleOutlineIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Circle cx="12" cy="12" r="9.25" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="9" y1="9" x2="15" y2="15" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="15" y1="9" x2="9" y2="15" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const CalendarDaysIcon = CalendarIcon;

export const BanknotesIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Rect x="3.5" y="7" width="17" height="10" rx="2" {...getStrokeProps(color, strokeWidth)} />
    <Circle cx="12" cy="12" r="2" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="7" y1="12" x2="7.01" y2="12" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="17" y1="12" x2="17.01" y2="12" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const MegaphoneIcon = createSolidIcon((color) => (
  <Path
    fill={color}
    d="M11.5 4.5v15l-4.75-2.38H3V9.88h3.75L11.5 4.5Zm2 1.4v12.2c.97-.24 1.74-.77 2.3-1.58a5.03 5.03 0 0 0 0-5.64c-.56-.81-1.33-1.34-2.3-1.58ZM8.75 13.25l.95 4.25H7.95l-.85-3.75h1.65Zm9.05-1.25c-.57 0-1.05-.2-1.45-.6-.4-.4-.6-.88-.6-1.45s.2-1.05.6-1.45c.4-.4.88-.6 1.45-.6.58 0 1.07.2 1.46.6.39.4.59.88.59 1.45s-.2 1.05-.59 1.45c-.39.4-.88.6-1.46.6Zm1.4 3.5-2.72-1.36c.15-.29.27-.59.35-.91.08-.31.13-.64.15-.97l2.73 1.37-.51 1.87Zm-2.22-7.74a5.14 5.14 0 0 0-.16-.97c-.08-.31-.2-.61-.35-.9L19.2 4.5l.51 1.87-2.73 1.39Z"
  />
));

export const MegaphoneOutlineIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path d="M12.5 5.5v13l-4.5-2.25H4V9.75h4L12.5 5.5Z" {...getStrokeProps(color, strokeWidth)} />
    <Path d="m8 16.25 1.35 3.25" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M15.5 9.25a3.25 3.25 0 0 1 0 5.5" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M18 7a6 6 0 0 1 0 10" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const WrenchScrewdriverIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path
      d="M14.5 5.5a3 3 0 0 0 4 4l-9 9a2.1 2.1 0 0 1-3-3l9-9Z"
      {...getStrokeProps(color, strokeWidth)}
    />
    <Path d="M6 6l3 3" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="13" y1="13" x2="19" y2="19" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const ArrowPathIcon = RefreshIcon;

export const ChatBubbleLeftIcon = createOutlineIcon((color, strokeWidth) => (
  <Path
    d="M5 18V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3Z"
    {...getStrokeProps(color, strokeWidth)}
  />
));

export const ShieldIcon = createOutlineIcon((color, strokeWidth) => (
  <Path
    d="M12 3l7 3v5c0 4.5-2.8 8.5-7 10-4.2-1.5-7-5.5-7-10V6l7-3Z"
    {...getStrokeProps(color, strokeWidth)}
  />
));

export const ShieldCheckIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path
      d="M12 3l7 3v5c0 4.5-2.8 8.5-7 10-4.2-1.5-7-5.5-7-10V6l7-3Z"
      {...getStrokeProps(color, strokeWidth)}
    />
    <Polyline points="8.5 12 11 14.5 15.5 10" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const MoonIcon = createOutlineIcon((color, strokeWidth) => (
  <Path
    d="M20 14.5A7.5 7.5 0 1 1 9.5 4a6 6 0 0 0 10.5 10.5Z"
    {...getStrokeProps(color, strokeWidth)}
  />
));

export const DevicePhoneMobileIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Rect x="7" y="3.5" width="10" height="17" rx="2" {...getStrokeProps(color, strokeWidth)} />
    <Circle cx="12" cy="17.5" r=".9" fill={color} />
  </>
));

export const GiftIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Rect x="4" y="10" width="16" height="10" rx="2" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M4 10h16" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="12" y1="10" x2="12" y2="20" {...getStrokeProps(color, strokeWidth)} />
    <Path
      d="M12 10c0-2-1.1-4-3-4-1.6 0-2.5.8-2.5 2 0 1.2.9 2 2.5 2H12Z"
      {...getStrokeProps(color, strokeWidth)}
    />
    <Path
      d="M12 10c0-2 1.1-4 3-4 1.6 0 2.5.8 2.5 2 0 1.2-.9 2-2.5 2H12Z"
      {...getStrokeProps(color, strokeWidth)}
    />
  </>
));

export const TagIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path d="M11 4H5v6l8 8 6-6-8-8Z" {...getStrokeProps(color, strokeWidth)} />
    <Circle cx="7.5" cy="7.5" r="1" fill={color} />
  </>
));

export const HashtagIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Line x1="9" y1="4" x2="7" y2="20" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="17" y1="4" x2="15" y2="20" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="4" y1="9" x2="20" y2="9" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="3" y1="15" x2="19" y2="15" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const WifiIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path d="M4.5 8.5a11 11 0 0 1 15 0" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M7.5 11.5a7 7 0 0 1 9 0" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M10.5 14.5a3 3 0 0 1 3 0" {...getStrokeProps(color, strokeWidth)} />
    <Circle cx="12" cy="18" r="1" fill={color} />
  </>
));

export const WifiOff = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path d="M4.5 8.5a11 11 0 0 1 11.12-1.44" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M7.5 11.5a7 7 0 0 1 4.44-1.58" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M10.5 14.5a3 3 0 0 1 .93-.4" {...getStrokeProps(color, strokeWidth)} />
    <Circle cx="12" cy="18" r="1" fill={color} />
    <Line x1="4" y1="4" x2="20" y2="20" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const RefreshCw = RefreshIcon;

export const GlobeIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Circle cx="12" cy="12" r="9" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M3.5 12h17" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M12 3.5a13 13 0 0 1 0 17" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M12 3.5a13 13 0 0 0 0 17" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M5.5 8.5c2 1 11 1 13 0" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M5.5 15.5c2-1 11-1 13 0" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const CreditCardIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Rect x="3.5" y="6.5" width="17" height="11" rx="2" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="3.5" y1="10.5" x2="20.5" y2="10.5" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="7" y1="14.5" x2="11" y2="14.5" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const InboxIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path d="M4 7h16v10l-3 3H7l-3-3V7Z" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M4 14h4l2 3h4l2-3h4" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const CurrencyYenIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Polyline points="8 4.5 12 10 16 4.5" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="8" y1="12" x2="16" y2="12" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="8" y1="15" x2="16" y2="15" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="12" y1="10" x2="12" y2="20" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const Squares2X2Icon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Rect x="4" y="4" width="6.5" height="6.5" rx="1" {...getStrokeProps(color, strokeWidth)} />
    <Rect x="13.5" y="4" width="6.5" height="6.5" rx="1" {...getStrokeProps(color, strokeWidth)} />
    <Rect x="4" y="13.5" width="6.5" height="6.5" rx="1" {...getStrokeProps(color, strokeWidth)} />
    <Rect
      x="13.5"
      y="13.5"
      width="6.5"
      height="6.5"
      rx="1"
      {...getStrokeProps(color, strokeWidth)}
    />
  </>
));

export const AddCircleOutlineIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Circle cx="12" cy="12" r="9.25" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="12" y1="8.25" x2="12" y2="15.75" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="8.25" y1="12" x2="15.75" y2="12" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const PinIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path d="M8 4.5h8l-1 5 3 2.5H6L9 9.5l-1-5Z" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="12" y1="12" x2="12" y2="20" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const ArchiveOutlineIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Rect x="4" y="7" width="16" height="12" rx="2" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M4 9.5h16" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M12 12v4" {...getStrokeProps(color, strokeWidth)} />
    <Polyline points="9.5 13.5 12 16 14.5 13.5" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const PaperPlaneOutlineIcon = createOutlineIcon((color, strokeWidth) => (
  <Path d="M21 4 10 14l-1 6 4-3 3 3L21 4Z" {...getStrokeProps(color, strokeWidth)} />
));

export const TrophyOutlineIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path d="M7 5h10v3a5 5 0 0 1-10 0V5Z" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M7 6H5a2 2 0 0 0 2 4" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M17 6h2a2 2 0 0 1-2 4" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M12 13v3" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M9 20h6" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M10 16h4v4h-4Z" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const FlagOutlineIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Line x1="6" y1="4" x2="6" y2="20" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M6 5h10l-2 3 2 3H6" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const ChatbubbleEllipsesOutlineIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path
      d="M5 18V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3Z"
      {...getStrokeProps(color, strokeWidth)}
    />
    <Circle cx="9" cy="11" r=".9" fill={color} />
    <Circle cx="12" cy="11" r=".9" fill={color} />
    <Circle cx="15" cy="11" r=".9" fill={color} />
  </>
));

export const RestaurantOutlineIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Line x1="7" y1="4.5" x2="7" y2="12" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="5.5" y1="4.5" x2="5.5" y2="9" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="8.5" y1="4.5" x2="8.5" y2="9" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="7" y1="12" x2="7" y2="19.5" {...getStrokeProps(color, strokeWidth)} />
    <Path
      d="M15.5 4.5c1.5 1.5 1.5 4 0 5.5-.5.5-1 1-1 1.5v8"
      {...getStrokeProps(color, strokeWidth)}
    />
  </>
));

export const BusOutlineIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Rect x="5" y="5" width="14" height="12" rx="2" {...getStrokeProps(color, strokeWidth)} />
    <Line x1="5" y1="10" x2="19" y2="10" {...getStrokeProps(color, strokeWidth)} />
    <Circle cx="9" cy="18" r="1.5" {...getStrokeProps(color, strokeWidth)} />
    <Circle cx="15" cy="18" r="1.5" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const BedOutlineIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Path d="M4 18V8" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M4 12h16v6" {...getStrokeProps(color, strokeWidth)} />
    <Rect x="6" y="9" width="5" height="3" rx="1" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M11 9h5a2 2 0 0 1 2 2v1" {...getStrokeProps(color, strokeWidth)} />
  </>
));

export const ImagesOutlineIcon = createOutlineIcon((color, strokeWidth) => (
  <>
    <Rect x="7" y="7" width="12" height="10" rx="2" {...getStrokeProps(color, strokeWidth)} />
    <Rect x="4" y="4" width="12" height="10" rx="2" {...getStrokeProps(color, strokeWidth)} />
    <Path d="M9 14l2.5-2.5L14 14l1.5-1.5L18 15" {...getStrokeProps(color, strokeWidth)} />
    <Circle cx="10" cy="9.5" r="1" fill={color} />
  </>
));

export const MagnifyingGlassIcon = SearchIcon;
export const EnvelopeIcon = MailIcon;
export const QRCodeIcon = QrCodeIcon;
export const AlertTriangleIcon = ExclamationTriangleIcon;

export const AddIcon = PlusIcon;
export const CloseIcon = XMarkIcon;
export const CheckmarkIcon = CheckIcon;
export const CheckmarkCircleIcon = CheckCircleIcon;
export const CheckmarkCircleOutlineIcon = CheckCircleIcon;
export const AlertCircleOutlineIcon = AlertCircleIcon;
export const CalendarOutlineIcon = CalendarIcon;
export const LocationOutlineIcon = MapPinIcon;
export const PersonOutlineIcon = UserIcon;
export const PeopleOutlineIcon = UsersIcon;
export const EyeOutlineIcon = EyeIcon;
export const CreateOutlineIcon = EditIcon;
export const CloseCircleIcon = XCircleIcon;
export const TrashOutlineIcon = TrashIcon;
export const NotificationsIcon = BellIcon;
