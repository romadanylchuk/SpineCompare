import type { DiffEntry, DiffStatus, CompareResult, FolderEntry, FolderFile } from './types';
import type { TabStats } from './comparator';
import { getStats } from './comparator';

// ─── Status colours & labels ─────────────────────────────────────────────────

const STATUS_CLASS: Record<DiffStatus, string> = {
  'only-a': 'tag-only-a',
  'only-b': 'tag-only-b',
  'same': 'tag-same',
  'different': 'tag-different',
};

const STATUS_ICON: Record<DiffStatus, string> = {
  'only-a': '◀',
  'only-b': '▶',
  'same': '✓',
  'different': '≠',
};

// ─── Tab definitions ─────────────────────────────────────────────────────────

type TabKey = 'animations' | 'skins' | 'events' | 'bones' | 'slots' | 'physics';
const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'animations', label: 'Animations', icon: '🎬' },
  { key: 'skins', label: 'Skins', icon: '🎨' },
  { key: 'events', label: 'Events', icon: '⚡' },
  { key: 'bones', label: 'Bones', icon: '🦴' },
  { key: 'slots', label: 'Slots', icon: '📌' },
  { key: 'physics', label: 'Physics', icon: '🔩' },
];

// ─── Filter state ─────────────────────────────────────────────────────────────

type FilterStatus = DiffStatus | 'all';

interface State {
  activeTab: TabKey;
  filter: FilterStatus;
  searchQuery: string;
  result: CompareResult | null;
  nameA: string;
  nameB: string;
}

const state: State = {
  activeTab: 'animations',
  filter: 'all',
  searchQuery: '',
  result: null,
  nameA: 'Skeleton A',
  nameB: 'Skeleton B',
};

// ─── Entry row ───────────────────────────────────────────────────────────────

function buildEntryRow(entry: DiffEntry, _nameA: string, _nameB: string): HTMLElement {
  const row = document.createElement('div');
  row.className = `entry-row status-${entry.status}`;

  // Left cell (A)
  const cellA = document.createElement('div');
  cellA.className = 'col-cell col-a-cell';
  if (entry.status !== 'only-b') {
    const nameEl = document.createElement('span');
    nameEl.className = 'entry-name';
    nameEl.textContent = entry.name;
    cellA.appendChild(nameEl);
    if (entry.detailA) {
      const detail = document.createElement('span');
      detail.className = 'detail-value';
      detail.textContent = entry.detailA;
      cellA.appendChild(detail);
    }
  } else {
    cellA.classList.add('col-empty');
    cellA.innerHTML = `<span class="col-missing">—</span>`;
  }

  // Middle status
  const cellStatus = document.createElement('div');
  cellStatus.className = 'col-status';
  const tag = document.createElement('span');
  tag.className = `status-tag ${STATUS_CLASS[entry.status]}`;
  tag.innerHTML = `<span class="status-icon">${STATUS_ICON[entry.status]}</span>`;
  cellStatus.appendChild(tag);

  // Right cell (B)
  const cellB = document.createElement('div');
  cellB.className = 'col-cell col-b-cell';
  if (entry.status !== 'only-a') {
    const nameEl = document.createElement('span');
    nameEl.className = 'entry-name';
    nameEl.textContent = entry.name;
    cellB.appendChild(nameEl);
    if (entry.detailB) {
      const detail = document.createElement('span');
      detail.className = 'detail-value';
      detail.textContent = entry.detailB;
      cellB.appendChild(detail);
    }
  } else {
    cellB.classList.add('col-empty');
    cellB.innerHTML = `<span class="col-missing">—</span>`;
  }

  row.appendChild(cellA);
  row.appendChild(cellStatus);
  row.appendChild(cellB);
  return row;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Stats bar ───────────────────────────────────────────────────────────────

function buildStatsBar(stats: TabStats): string {
  return `
    <div class="stats-bar">
      <span class="stat stat-total">Total: <b>${stats.total}</b></span>
      <span class="stat tag-only-a">${STATUS_ICON['only-a']} Only A: <b>${stats.onlyA}</b></span>
      <span class="stat tag-only-b">${STATUS_ICON['only-b']} Only B: <b>${stats.onlyB}</b></span>
      <span class="stat tag-different">${STATUS_ICON['different']} Different: <b>${stats.different}</b></span>
      <span class="stat tag-same">${STATUS_ICON['same']} Same: <b>${stats.same}</b></span>
    </div>
  `;
}

// ─── Tab badge ───────────────────────────────────────────────────────────────

function tabBadge(entries: DiffEntry[]): string {
  const issues = entries.filter((e) => e.status !== 'same').length;
  if (issues === 0) return `<span class="badge badge-ok">✓</span>`;
  return `<span class="badge badge-issues">${issues}</span>`;
}

// ─── Render helpers ───────────────────────────────────────────────────────────

export function renderTabs(container: HTMLElement): void {
  if (!state.result) return;

  const tabBar = container.querySelector<HTMLElement>('.tab-bar')!;
  tabBar.innerHTML = '';

  TABS.forEach(({ key, label, icon }) => {
    const btn = document.createElement('button');
    btn.className = `tab-btn ${state.activeTab === key ? 'active' : ''}`;
    btn.dataset.tab = key;
    const entries = state.result![key];
    btn.innerHTML = `${icon} ${label} <span class="badge badge-count">${entries.length}</span>${tabBadge(entries)}`;
    btn.addEventListener('click', () => {
      state.activeTab = key;
      state.filter = 'all';
      state.searchQuery = '';
      renderTabs(container);
    });
    tabBar.appendChild(btn);
  });

  renderContent(container);
}

function renderContent(container: HTMLElement): void {
  if (!state.result) return;

  const content = container.querySelector<HTMLElement>('.tab-content')!;
  const entries = state.result[state.activeTab];
  const stats = getStats(entries);

  let html = buildStatsBar(stats);

  // Filter controls
  html += `<div class="filter-bar">`;
  html += `<input class="search-input" type="search" placeholder="Search by name…" value="${escHtml(state.searchQuery)}" />`;
  html += `<div class="filter-buttons">`;
  const filters: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'only-a', label: 'Only A' },
    { key: 'only-b', label: 'Only B' },
    { key: 'different', label: 'Different' },
    { key: 'same', label: 'Same' },
  ];
  filters.forEach(({ key, label }) => {
    const active = state.filter === key ? 'active' : '';
    html += `<button class="filter-btn ${active} ${key !== 'all' ? STATUS_CLASS[key as DiffStatus] : ''}" data-filter="${key}">${label}</button>`;
  });
  html += `</div></div>`;

  content.innerHTML = html;

  // Wire up filter buttons
  content.querySelectorAll<HTMLButtonElement>('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.filter as FilterStatus;
      renderContent(container);
    });
  });

  // Wire up search
  const searchInput = content.querySelector<HTMLInputElement>('.search-input')!;
  searchInput.addEventListener('input', () => {
    state.searchQuery = searchInput.value;
    renderContent(container);
  });

  // Entries list
  const list = document.createElement('div');
  list.className = 'entries-list';

  // Column headers
  const colHeader = document.createElement('div');
  colHeader.className = 'entry-row col-headers-row';
  colHeader.innerHTML = `
    <div class="col-cell col-a-cell col-header-cell">
      <span class="col-header-label label-a">${escHtml(state.nameA)}</span>
    </div>
    <div class="col-status"></div>
    <div class="col-cell col-b-cell col-header-cell">
      <span class="col-header-label label-b">${escHtml(state.nameB)}</span>
    </div>
  `;
  list.appendChild(colHeader);

  let filtered = entries;
  if (state.filter !== 'all') {
    filtered = filtered.filter((e) => e.status === state.filter);
  }
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.trim().toLowerCase();
    filtered = filtered.filter((e) => e.name.toLowerCase().includes(q));
  }

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No entries match the current filter.';
    list.appendChild(empty);
  } else {
    filtered.forEach((entry) => {
      list.appendChild(buildEntryRow(entry, state.nameA, state.nameB));
    });
  }

  content.appendChild(list);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function showResult(
  container: HTMLElement,
  result: CompareResult,
  nameA: string,
  nameB: string,
): void {
  state.result = result;
  state.nameA = nameA;
  state.nameB = nameB;
  state.activeTab = 'animations';
  state.filter = 'all';
  state.searchQuery = '';

  container.querySelector('.upload-section')?.classList.add('compact');
  container.querySelector('.compare-section')!.classList.remove('hidden');

  renderTabs(container);
}

// ─── Folder result ────────────────────────────────────────────────────────────

function buildFolderEntryRow(
  entry: FolderEntry,
  nameA: string,
  nameB: string,
  onCompare: (fa: FolderFile, fb: FolderFile, nA: string, nB: string) => void,
): HTMLElement {
  const row = document.createElement('div');

  if (entry.fileA && entry.fileB) {
    row.className = 'entry-row folder-pair-row status-same';

    const cellA = document.createElement('div');
    cellA.className = 'col-cell col-a-cell';
    const nameElA = document.createElement('span');
    nameElA.className = 'entry-name';
    nameElA.textContent = entry.name;
    cellA.appendChild(nameElA);

    const cellMiddle = document.createElement('div');
    cellMiddle.className = 'col-status folder-compare-col';
    const btn = document.createElement('button');
    btn.className = 'folder-compare-btn';
    btn.textContent = 'Compare ▶';
    const fa = entry.fileA;
    const fb = entry.fileB;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onCompare(fa, fb, `${nameA} / ${entry.name}`, `${nameB} / ${entry.name}`);
    });
    cellMiddle.appendChild(btn);

    const cellB = document.createElement('div');
    cellB.className = 'col-cell col-b-cell';
    const nameElB = document.createElement('span');
    nameElB.className = 'entry-name';
    nameElB.textContent = entry.name;
    cellB.appendChild(nameElB);

    row.appendChild(cellA);
    row.appendChild(cellMiddle);
    row.appendChild(cellB);
  } else if (entry.fileA) {
    row.className = 'entry-row folder-pair-row status-only-a';

    const cellA = document.createElement('div');
    cellA.className = 'col-cell col-a-cell';
    const nameEl = document.createElement('span');
    nameEl.className = 'entry-name';
    nameEl.textContent = entry.name;
    cellA.appendChild(nameEl);

    const cellMiddle = document.createElement('div');
    cellMiddle.className = 'col-status';
    const tag = document.createElement('span');
    tag.className = 'status-tag tag-only-a';
    tag.innerHTML = `<span class="status-icon">◀</span>`;
    cellMiddle.appendChild(tag);

    const cellB = document.createElement('div');
    cellB.className = 'col-cell col-b-cell col-empty';
    cellB.innerHTML = `<span class="col-missing">—</span>`;

    row.appendChild(cellA);
    row.appendChild(cellMiddle);
    row.appendChild(cellB);
  } else {
    row.className = 'entry-row folder-pair-row status-only-b';

    const cellA = document.createElement('div');
    cellA.className = 'col-cell col-a-cell col-empty';
    cellA.innerHTML = `<span class="col-missing">—</span>`;

    const cellMiddle = document.createElement('div');
    cellMiddle.className = 'col-status';
    const tag = document.createElement('span');
    tag.className = 'status-tag tag-only-b';
    tag.innerHTML = `<span class="status-icon">▶</span>`;
    cellMiddle.appendChild(tag);

    const cellB = document.createElement('div');
    cellB.className = 'col-cell col-b-cell';
    const nameEl = document.createElement('span');
    nameEl.className = 'entry-name';
    nameEl.textContent = entry.name;
    cellB.appendChild(nameEl);

    row.appendChild(cellA);
    row.appendChild(cellMiddle);
    row.appendChild(cellB);
  }

  return row;
}

export function showFolderResult(
  container: HTMLElement,
  entries: FolderEntry[],
  nameA: string,
  nameB: string,
  onCompare: (fa: FolderFile, fb: FolderFile, nA: string, nB: string) => void,
): void {
  container.innerHTML = '';

  const matched = entries.filter((e) => e.fileA && e.fileB);
  const onlyA = entries.filter((e) => e.fileA && !e.fileB);
  const onlyB = entries.filter((e) => !e.fileA && e.fileB);

  // Stats bar
  const statsBar = document.createElement('div');
  statsBar.className = 'stats-bar';
  statsBar.innerHTML = `
    <span class="stat stat-total">Total: <b>${entries.length}</b></span>
    <span class="stat tag-same">✓ Matched: <b>${matched.length}</b></span>
    <span class="stat tag-only-a">◀ Only in A: <b>${onlyA.length}</b></span>
    <span class="stat tag-only-b">▶ Only in B: <b>${onlyB.length}</b></span>
  `;
  container.appendChild(statsBar);

  // Column headers
  const list = document.createElement('div');
  list.className = 'entries-list folder-entries-list';

  const colHeader = document.createElement('div');
  colHeader.className = 'entry-row folder-pair-row col-headers-row';
  colHeader.innerHTML = `
    <div class="col-cell col-a-cell col-header-cell">
      <span class="col-header-label label-a">${escHtml(nameA)}</span>
    </div>
    <div class="col-status folder-compare-col"></div>
    <div class="col-cell col-b-cell col-header-cell">
      <span class="col-header-label label-b">${escHtml(nameB)}</span>
    </div>
  `;
  list.appendChild(colHeader);

  function appendGroup(groupEntries: FolderEntry[], label: string): void {
    if (groupEntries.length === 0) return;
    const header = document.createElement('div');
    header.className = 'folder-group-header';
    header.textContent = label;
    list.appendChild(header);
    groupEntries.forEach((e) => list.appendChild(buildFolderEntryRow(e, nameA, nameB, onCompare)));
  }

  appendGroup(matched, `Matched (${matched.length})`);
  appendGroup(onlyA, `Only in A (${onlyA.length})`);
  appendGroup(onlyB, `Only in B (${onlyB.length})`);

  container.appendChild(list);
}
