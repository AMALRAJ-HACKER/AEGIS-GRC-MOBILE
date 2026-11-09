import Svg, { Circle, Path } from 'react-native-svg';

type IconProps = { color?: string; size?: number };

const stroke = (color: string, width = 1.8) => ({
  stroke: color,
  strokeWidth: width,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
});

export function ShieldCheckIcon({ color = '#0A1931', size = 22 }: IconProps) {
  const s = stroke(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3.2 4.8 6v5.7c0 4.3 3 7.6 7.2 9.1 4.2-1.5 7.2-4.8 7.2-9.1V6L12 3.2Z" {...s} />
      <Path d="m8.9 12.1 2.2 2.2 4.1-4.3" {...s} />
    </Svg>
  );
}

export function SearchIcon({ color = '#64748B', size = 18 }: IconProps) {
  const s = stroke(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="11" cy="11" r="6.4" {...s} />
      <Path d="m15.8 15.8 4.2 4.2" {...s} />
    </Svg>
  );
}

export function PencilIcon({ color = '#0A1931', size = 18 }: IconProps) {
  const s = stroke(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4.5 19.5 5.4 15 16.2 4.2a1.9 1.9 0 0 1 2.7 0l.9.9a1.9 1.9 0 0 1 0 2.7L9 18.6l-4.5.9Z" {...s} />
      <Path d="m14.7 5.7 3.6 3.6" {...s} />
    </Svg>
  );
}

export function AlertTriangleIcon({ color = '#F59E0B', size = 22 }: IconProps) {
  const s = stroke(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3.6 2.9 20.1h18.2L12 3.6Z" {...s} />
      <Path d="M12 9.6v4.7" {...s} />
      <Circle cx="12" cy="17.4" r="0.9" fill={color} stroke="none" />
    </Svg>
  );
}

export function PlusIcon({ color = '#FFFFFF', size = 18 }: IconProps) {
  const s = stroke(color, 2);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 5v14M5 12h14" {...s} />
    </Svg>
  );
}

export function CheckIcon({ color = '#10B981', size = 18 }: IconProps) {
  const s = stroke(color, 2);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="m5 12.4 4.4 4.4L19 6.9" {...s} />
    </Svg>
  );
}

export function CalendarIcon({ color = '#64748B', size = 18 }: IconProps) {
  const s = stroke(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5Z" {...s} />
      <Path d="M3.5 9.5h17M8 3.5v4M16 3.5v4" {...s} />
    </Svg>
  );
}

export function ChevronLeftIcon({ color = '#0A1931', size = 20 }: IconProps) {
  const s = stroke(color, 2);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="m14.5 5.5-6.5 6.5 6.5 6.5" {...s} />
    </Svg>
  );
}

export function ChevronRightIcon({ color = '#0A1931', size = 20 }: IconProps) {
  const s = stroke(color, 2);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="m9.5 5.5 6.5 6.5-6.5 6.5" {...s} />
    </Svg>
  );
}

export function XIcon({ color = '#64748B', size = 18 }: IconProps) {
  const s = stroke(color, 2);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 6l12 12M18 6 6 18" {...s} />
    </Svg>
  );
}

export function ArrowRightIcon({ color = '#0A1931', size = 18 }: IconProps) {
  const s = stroke(color, 2);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4.5 12h15" {...s} />
      <Path d="m13.5 6 6 6-6 6" {...s} />
    </Svg>
  );
}

export function FileTextIcon({ color = '#0A1931', size = 22 }: IconProps) {
  const s = stroke(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6.5 2.8h7.2l4.8 4.8v13.6H6.5V2.8Z" {...s} />
      <Path d="M13.7 2.8v4.8h4.8M9.5 12h6M9.5 15.5h6M9.5 8.5h2" {...s} />
    </Svg>
  );
}

export function LayersIcon({ color = '#0A1931', size = 22 }: IconProps) {
  const s = stroke(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="m12 3.2 8.5 4.4-8.5 4.4-8.5-4.4L12 3.2Z" {...s} />
      <Path d="m3.5 12 8.5 4.4 8.5-4.4" {...s} />
      <Path d="m3.5 16.4 8.5 4.4 8.5-4.4" {...s} />
    </Svg>
  );
}

export function LockIcon({ color = '#0A1931', size = 22 }: IconProps) {
  const s = stroke(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6.5 10.2h11a1.8 1.8 0 0 1 1.8 1.8v7a1.8 1.8 0 0 1-1.8 1.8h-11a1.8 1.8 0 0 1-1.8-1.8v-7a1.8 1.8 0 0 1 1.8-1.8Z" {...s} />
      <Path d="M8.4 10.2V7.6a3.6 3.6 0 0 1 7.2 0v2.6" {...s} />
      <Circle cx="12" cy="15.4" r="1.2" fill={color} stroke="none" />
    </Svg>
  );
}

export function ActivityIcon({ color = '#0A1931', size = 22 }: IconProps) {
  const s = stroke(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M2.8 12h3.6l2.4-6.4 5.1 12.8 2.4-6.4h4.9" {...s} />
    </Svg>
  );
}

