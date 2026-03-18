import type {
  SpineSkeleton,
  SpineAnimation,
  SpineEvent,
  SpinePhysicsConstraint,
  DiffEntry,
  DiffStatus,
  CompareResult,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const sorted = Object.keys(value as object)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableJson((value as Record<string, unknown>)[k])}`);
  return `{${sorted.join(',')}}`;
}

function diffSets(
  keysA: string[],
  keysB: string[],
  getDetailA: (k: string) => string,
  getDetailB: (k: string) => string,
): DiffEntry[] {
  const setA = new Set(keysA);
  const setB = new Set(keysB);
  const all = Array.from(new Set([...keysA, ...keysB])).sort((a, b) =>
    a.localeCompare(b),
  );

  return all.map((name) => {
    const inA = setA.has(name);
    const inB = setB.has(name);

    let status: DiffStatus;
    let detailA: string | undefined;
    let detailB: string | undefined;

    if (inA && !inB) {
      status = 'only-a';
      detailA = getDetailA(name);
    } else if (!inA && inB) {
      status = 'only-b';
      detailB = getDetailB(name);
    } else {
      const dA = getDetailA(name);
      const dB = getDetailB(name);
      status = dA === dB ? 'same' : 'different';
      detailA = dA;
      detailB = dB;
    }

    return { name, status, detailA, detailB };
  });
}

// ─── Animation detail ─────────────────────────────────────────────────────────

function animSummary(anim: SpineAnimation): string {
  const tracks: string[] = [];

  if (anim.bones) tracks.push(`bones:[${Object.keys(anim.bones).sort().join(',')}]`);
  if (anim.slots) tracks.push(`slots:[${Object.keys(anim.slots).sort().join(',')}]`);
  if (anim.ik) tracks.push(`ik:[${Object.keys(anim.ik).sort().join(',')}]`);
  if (anim.transform) tracks.push(`transform:[${Object.keys(anim.transform).sort().join(',')}]`);
  if (anim.path) tracks.push(`path:[${Object.keys(anim.path).sort().join(',')}]`);
  if (anim.physics) tracks.push(`physics:[${Object.keys(anim.physics).sort().join(',')}]`);
  if (anim.deform) tracks.push(`deform:[${Object.keys(anim.deform).sort().join(',')}]`);
  if (anim.events) tracks.push(`events:${anim.events.length}`);
  if (anim.drawOrder) tracks.push(`drawOrder:${anim.drawOrder.length}`);

  return tracks.join(' | ') || '(empty)';
}

// ─── Skin names ───────────────────────────────────────────────────────────────

function extractSkinNames(skeleton: SpineSkeleton): string[] {
  if (!skeleton.skins) return [];
  if (Array.isArray(skeleton.skins)) {
    return skeleton.skins.map((s) => s.name);
  }
  // old format: skins is an object
  return Object.keys(skeleton.skins);
}

function skinDetail(skeleton: SpineSkeleton, name: string): string {
  if (!skeleton.skins) return '';
  if (Array.isArray(skeleton.skins)) {
    const s = skeleton.skins.find((x) => x.name === name);
    if (!s?.attachments) return '(no attachments)';
    const slots = Object.keys(s.attachments).sort();
    return `slots:[${slots.join(',')}]`;
  }
  const s = (skeleton.skins as Record<string, unknown>)[name];
  return stableJson(s).slice(0, 120);
}

// ─── Event detail ─────────────────────────────────────────────────────────────

function eventDetail(ev: SpineEvent): string {
  const parts: string[] = [];
  if (ev.int !== undefined) parts.push(`int=${ev.int}`);
  if (ev.float !== undefined) parts.push(`float=${ev.float}`);
  if (ev.string !== undefined) parts.push(`string="${ev.string}"`);
  if (ev.audio !== undefined) parts.push(`audio="${ev.audio}"`);
  return parts.join(', ') || '(empty)';
}

// ─── Physics constraint detail ────────────────────────────────────────────────

function physicsDetail(constraint: SpinePhysicsConstraint): string {
  const parts: string[] = [`bone:${constraint.bone}`];
  const numeric = ['step', 'inertia', 'strength', 'damping', 'massInverse', 'wind', 'gravity', 'mix'];
  for (const key of numeric) {
    if (constraint[key] !== undefined) parts.push(`${key}:${constraint[key]}`);
  }
  return parts.join(' ');
}

// ─── Main compare ─────────────────────────────────────────────────────────────

export function compare(a: SpineSkeleton, b: SpineSkeleton): CompareResult {
  // Animations
  const animsA = a.animations ?? {};
  const animsB = b.animations ?? {};
  const animations = diffSets(
    Object.keys(animsA),
    Object.keys(animsB),
    (k) => animSummary(animsA[k] ?? {}),
    (k) => animSummary(animsB[k] ?? {}),
  );

  // Skins
  const skinNamesA = extractSkinNames(a);
  const skinNamesB = extractSkinNames(b);
  const skins = diffSets(
    skinNamesA,
    skinNamesB,
    (k) => skinDetail(a, k),
    (k) => skinDetail(b, k),
  );

  // Events
  const eventsA = a.events ?? {};
  const eventsB = b.events ?? {};
  const events = diffSets(
    Object.keys(eventsA),
    Object.keys(eventsB),
    (k) => eventDetail(eventsA[k] ?? {}),
    (k) => eventDetail(eventsB[k] ?? {}),
  );

  // Bones
  const boneNamesA = (a.bones ?? []).map((b) => b.name);
  const boneNamesB = (b.bones ?? []).map((b) => b.name);
  const boneMapA = Object.fromEntries((a.bones ?? []).map((b) => [b.name, b.parent ?? '(root)']));
  const boneMapB = Object.fromEntries((b.bones ?? []).map((b) => [b.name, b.parent ?? '(root)']));
  const bones = diffSets(
    boneNamesA,
    boneNamesB,
    (k) => `parent:${boneMapA[k] ?? '?'}`,
    (k) => `parent:${boneMapB[k] ?? '?'}`,
  );

  // Slots
  const slotNamesA = (a.slots ?? []).map((s) => s.name);
  const slotNamesB = (b.slots ?? []).map((s) => s.name);
  const slotMapA = Object.fromEntries((a.slots ?? []).map((s) => [s.name, `bone:${s.bone}`]));
  const slotMapB = Object.fromEntries((b.slots ?? []).map((s) => [s.name, `bone:${s.bone}`]));
  const slots = diffSets(
    slotNamesA,
    slotNamesB,
    (k) => slotMapA[k] ?? '?',
    (k) => slotMapB[k] ?? '?',
  );

  // Physics constraints (Spine 4.1+)
  const physicsA = a.physics ?? [];
  const physicsB = b.physics ?? [];
  const physicsMapA = Object.fromEntries(physicsA.map((p) => [p.name, p]));
  const physicsMapB = Object.fromEntries(physicsB.map((p) => [p.name, p]));
  const physics = diffSets(
    physicsA.map((p) => p.name),
    physicsB.map((p) => p.name),
    (k) => physicsDetail(physicsMapA[k] ?? { name: k, bone: '?' }),
    (k) => physicsDetail(physicsMapB[k] ?? { name: k, bone: '?' }),
  );

  return { animations, skins, events, bones, slots, physics };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface TabStats {
  total: number;
  onlyA: number;
  onlyB: number;
  different: number;
  same: number;
}

export function getStats(entries: DiffEntry[]): TabStats {
  return {
    total: entries.length,
    onlyA: entries.filter((e) => e.status === 'only-a').length,
    onlyB: entries.filter((e) => e.status === 'only-b').length,
    different: entries.filter((e) => e.status === 'different').length,
    same: entries.filter((e) => e.status === 'same').length,
  };
}
