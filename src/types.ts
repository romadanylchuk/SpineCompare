// ─── Spine JSON shape (subset we care about) ─────────────────────────────────

export interface SpineSkin {
  name: string;
  attachments?: Record<string, Record<string, unknown>>;
  bones?: string[];
  slots?: string[];
  skins?: string[];
  constraints?: string[];
}

export interface SpineEvent {
  int?: number;
  float?: number;
  string?: string;
  audio?: string;
  volume?: number;
  balance?: number;
}

export interface SpineTimeline {
  [key: string]: unknown;
}

export interface SpineAnimation {
  bones?: Record<string, SpineTimeline>;
  slots?: Record<string, SpineTimeline>;
  ik?: Record<string, SpineTimeline>;
  transform?: Record<string, SpineTimeline>;
  path?: Record<string, SpineTimeline>;
  physics?: Record<string, SpineTimeline>;
  deform?: Record<string, Record<string, SpineTimeline>>;
  events?: Array<{ time: number; name: string; [k: string]: unknown }>;
  drawOrder?: unknown[];
}

export interface SpineSkeleton {
  skeleton?: {
    hash?: string;
    spine?: string;
    width?: number;
    height?: number;
    images?: string;
    audio?: string;
  };
  bones?: Array<{ name: string; parent?: string; [k: string]: unknown }>;
  slots?: Array<{ name: string; bone: string; [k: string]: unknown }>;
  skins?: SpineSkin[] | Record<string, unknown>;
  events?: Record<string, SpineEvent>;
  animations?: Record<string, SpineAnimation>;
  ik?: unknown[];
  transform?: unknown[];
  path?: unknown[];
  physics?: unknown[];
}

// ─── Diff types ───────────────────────────────────────────────────────────────

export type DiffStatus = 'only-a' | 'only-b' | 'same' | 'different';

export interface DiffEntry {
  name: string;
  status: DiffStatus;
  detailA?: string;
  detailB?: string;
}

export interface CompareResult {
  animations: DiffEntry[];
  skins: DiffEntry[];
  events: DiffEntry[];
  bones: DiffEntry[];
  slots: DiffEntry[];
}

export interface LoadedFile {
  name: string;
  skeleton: SpineSkeleton;
}
