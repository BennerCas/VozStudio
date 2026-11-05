import type { ComponentType, SVGProps } from 'react';
import {
  Activity,
  AudioLines,
  AudioWaveform,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Download,
  Feather,
  FileAudio,
  Fingerprint,
  FolderOpen,
  HardDrive,
  Info,
  Layers,
  LoaderCircle,
  MapPin,
  Maximize2,
  Mic,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Sliders,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  Wand2,
  Zap,
} from 'lucide-react';

export type IconName =
  | 'zap'
  | 'map-pin'
  | 'feather'
  | 'book-open'
  | 'fingerprint'
  | 'audio-waveform'
  | 'sparkles'
  | 'audio-lines'
  | 'loader'
  | 'play'
  | 'pause'
  | 'square'
  | 'download'
  | 'cpu'
  | 'hard-drive'
  | 'chevron-left'
  | 'chevron-right'
  | 'trash'
  | 'search'
  | 'refresh'
  | 'upload'
  | 'file-audio'
  | 'volume'
  | 'volume-mute'
  | 'sliders'
  | 'layers'
  | 'activity'
  | 'info'
  | 'check'
  | 'mic'
  | 'wand'
  | 'folder'
  | 'maximize'
  | 'reset';

export type IconAnimationVariant = 'none' | 'draw' | 'pulse' | 'spin' | 'bounce' | 'oscillate';
export type IconAnimationTrigger = 'always' | 'hover' | 'active';

type LucideComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }>;

const ICON_MAP: Record<IconName, LucideComponent> = {
  zap: Zap,
  'map-pin': MapPin,
  feather: Feather,
  'book-open': BookOpen,
  fingerprint: Fingerprint,
  'audio-waveform': AudioWaveform,
  sparkles: Sparkles,
  'audio-lines': AudioLines,
  loader: LoaderCircle,
  play: Play,
  pause: Pause,
  square: Square,
  download: Download,
  cpu: Cpu,
  'hard-drive': HardDrive,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  trash: Trash2,
  search: Search,
  refresh: RefreshCw,
  upload: Upload,
  'file-audio': FileAudio,
  volume: Volume2,
  'volume-mute': VolumeX,
  sliders: Sliders,
  layers: Layers,
  activity: Activity,
  info: Info,
  check: Check,
  mic: Mic,
  wand: Wand2,
  folder: FolderOpen,
  maximize: Maximize2,
  reset: RotateCcw,
};

export interface AnimatedIconProps {
  name: IconName;
  variant?: IconAnimationVariant;
  trigger?: IconAnimationTrigger;
  active?: boolean;
  className?: string;
  strokeWidth?: number;
  ariaLabel?: string;
}

export function AnimatedIcon({
  name,
  variant = 'none',
  trigger = 'hover',
  active = false,
  className = '',
  strokeWidth = 1.85,
  ariaLabel,
}: AnimatedIconProps) {
  const Component = ICON_MAP[name] ?? Activity;

  const stateClass =
    variant === 'none'
      ? ''
      : trigger === 'always' || (trigger === 'active' && active)
        ? `ag-icon-${variant}-run`
        : `ag-icon-${variant}-hover`;

  return (
    <span
      className={`ag-icon-wrap inline-flex shrink-0 items-center justify-center ${stateClass} ${className}`}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
    >
      <Component className="ag-icon-svg" strokeWidth={strokeWidth} />
    </span>
  );
}

export function getEngineIconConfig(engineId: string): {
  name: IconName;
  variant: IconAnimationVariant;
} {
  switch (engineId) {
    case 'kokoro':
      return { name: 'zap', variant: 'draw' };
    case 'piper':
      return { name: 'map-pin', variant: 'bounce' };
    case 'mms':
      return { name: 'feather', variant: 'oscillate' };
    case 'styletts2':
      return { name: 'book-open', variant: 'draw' };
    case 'f5_spanish':
      return { name: 'fingerprint', variant: 'pulse' };
    case 'cosyvoice':
      return { name: 'audio-waveform', variant: 'oscillate' };
    case 'xtts_v2':
      return { name: 'sparkles', variant: 'pulse' };
    case 'qwen3_tts':
      return { name: 'cpu', variant: 'draw' };
    default:
      return { name: 'audio-lines', variant: 'pulse' };
  }
}
