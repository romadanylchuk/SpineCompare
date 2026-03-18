import './style.css';
import type { SpineSkeleton, LoadedFile, FolderFile, FolderEntry } from './types';
import { compare } from './comparator';
import { showResult, showFolderResult } from './ui';

// ─── App shell ───────────────────────────────────────────────────────────────

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="app-header">
    <div class="header-inner">
      <span class="logo">🦴</span>
      <h1>Spine Skeleton Comparator</h1>
      <span class="subtitle">Animations · Skins · Events · Bones · Slots</span>
    </div>
  </header>

  <main class="app-main">
    <div class="mode-toggle-row">
      <button class="mode-btn active" id="mode-single">Single File</button>
      <button class="mode-btn" id="mode-folder">Folder</button>
    </div>

    <section class="upload-section">
      <div class="upload-grid">
        <div class="drop-zone" id="drop-a">
          <div class="drop-icon">📂</div>
          <div class="drop-label">Skeleton <span class="label-a">A</span></div>
          <div class="drop-hint">Drop .json / .skel here or click to browse</div>
          <input type="file" id="file-a" accept=".json,.skel" hidden />
          <div class="file-name" id="name-a">No file loaded</div>
        </div>
        <div class="vs-divider">VS</div>
        <div class="drop-zone" id="drop-b">
          <div class="drop-icon">📂</div>
          <div class="drop-label">Skeleton <span class="label-b">B</span></div>
          <div class="drop-hint">Drop .json / .skel here or click to browse</div>
          <input type="file" id="file-b" accept=".json,.skel" hidden />
          <div class="file-name" id="name-b">No file loaded</div>
        </div>
      </div>
      <div class="compare-btn-row">
        <button class="compare-btn" id="compare-btn" disabled>Compare</button>
        <span class="compare-hint" id="compare-hint">Load both files to compare</span>
      </div>
    </section>

    <section class="folder-section hidden">
      <div class="upload-grid">
        <div class="drop-zone folder-drop-zone" id="folder-drop-a">
          <div class="drop-icon">📁</div>
          <div class="drop-label">Folder <span class="label-a">A</span></div>
          <div class="drop-hint">Drop a folder here or click to browse</div>
          <input type="file" id="folder-input-a" webkitdirectory hidden />
          <div class="file-name" id="folder-name-a">No folder loaded</div>
        </div>
        <div class="vs-divider">VS</div>
        <div class="drop-zone folder-drop-zone" id="folder-drop-b">
          <div class="drop-icon">📁</div>
          <div class="drop-label">Folder <span class="label-b">B</span></div>
          <div class="drop-hint">Drop a folder here or click to browse</div>
          <input type="file" id="folder-input-b" webkitdirectory hidden />
          <div class="file-name" id="folder-name-b">No folder loaded</div>
        </div>
      </div>
      <div class="compare-btn-row">
        <button class="compare-btn" id="folder-compare-btn" disabled>Compare Folders</button>
        <span class="compare-hint" id="folder-compare-hint">Load both folders to compare</span>
      </div>
    </section>

    <section class="folder-results-section hidden">
      <div class="compare-header">
        <span class="compare-title" id="folder-results-title"></span>
        <button class="reset-btn" id="folder-reset-btn">↩ Load new folders</button>
      </div>
      <div id="folder-entries"></div>
    </section>

    <section class="compare-section hidden">
      <div class="compare-header">
        <span class="compare-title" id="compare-title"></span>
        <button class="reset-btn" id="reset-btn">↩ Load new files</button>
      </div>
      <div class="tab-bar"></div>
      <div class="tab-content"></div>
    </section>
  </main>
`;

// ─── State ────────────────────────────────────────────────────────────────────

let fileA: LoadedFile | null = null;
let fileB: LoadedFile | null = null;

let folderFilesA: FolderFile[] = [];
let folderFilesB: FolderFile[] = [];
let folderNameA = '';
let folderNameB = '';
let currentMode: 'single' | 'folder' = 'single';

// ─── File loading ─────────────────────────────────────────────────────────────

function loadFile(file: File): Promise<LoadedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      let text = reader.result as string;
      // Strip UTF-8 BOM if present (some Spine exports include it)
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      // Detect binary .skel content (non-printable bytes near the start)
      const isBinary = /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text.slice(0, 8));
      if (isBinary) {
        reject(new Error(`Binary .skel files are not supported. Export as JSON from the Spine editor.`));
        return;
      }
      try {
        const skeleton = JSON.parse(text) as SpineSkeleton;
        resolve({ name: file.name, skeleton });
      } catch {
        reject(new Error(`"${file.name}" is not valid JSON.`));
      }
    };
    reader.onerror = () => reject(new Error(`Failed to read "${file.name}".`));
    reader.readAsText(file);
  });
}

function updateCompareButton(): void {
  const btn = document.getElementById('compare-btn') as HTMLButtonElement;
  const hint = document.getElementById('compare-hint')!;
  if (fileA && fileB) {
    btn.disabled = false;
    hint.textContent = `Ready: ${fileA.name} vs ${fileB.name}`;
  } else if (!fileA && !fileB) {
    btn.disabled = true;
    hint.textContent = 'Load both files to compare';
  } else {
    btn.disabled = true;
    hint.textContent = fileA ? 'Now load Skeleton B' : 'Now load Skeleton A';
  }
}

function setDropSuccess(zone: HTMLElement, label: string, fileName: string, version?: string): void {
  zone.classList.add('loaded');
  zone.querySelector<HTMLElement>('.drop-icon')!.textContent = '✅';
  const fileNameEl = zone.querySelector<HTMLElement>('.file-name')!;
  fileNameEl.textContent = fileName;
  if (version) {
    const badge = document.createElement('span');
    badge.className = 'version-badge';
    badge.textContent = `Spine ${version}`;
    fileNameEl.appendChild(badge);
  }
  const nameEl = document.getElementById(label)!;
  nameEl.textContent = fileName;
}

function setDropError(zone: HTMLElement, message: string): void {
  zone.classList.add('error');
  zone.querySelector<HTMLElement>('.drop-icon')!.textContent = '❌';
  zone.querySelector<HTMLElement>('.file-name')!.textContent = message;
  setTimeout(() => {
    zone.classList.remove('error');
    zone.querySelector<HTMLElement>('.drop-icon')!.textContent = '📂';
    zone.querySelector<HTMLElement>('.file-name')!.textContent = 'No file loaded';
  }, 2500);
}

function wireDropZone(
  zoneId: string,
  inputId: string,
  nameLabelId: string,
  onLoaded: (f: LoadedFile) => void,
): void {
  const zone = document.getElementById(zoneId)!;
  const input = document.getElementById(inputId) as HTMLInputElement;

  zone.addEventListener('click', () => input.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer?.files[0];
    if (file) handleFile(file, zone, nameLabelId, onLoaded);
  });

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) handleFile(file, zone, nameLabelId, onLoaded);
  });
}

async function handleFile(
  file: File,
  zone: HTMLElement,
  nameLabelId: string,
  onLoaded: (f: LoadedFile) => void,
): Promise<void> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'json' && ext !== 'skel') {
    setDropError(zone, `".${ext}" is not supported — drop a .json skeleton file.`);
    return;
  }
  try {
    const loaded = await loadFile(file);
    const version = loaded.skeleton.skeleton?.spine;
    setDropSuccess(zone, nameLabelId, file.name, version);
    onLoaded(loaded);
    updateCompareButton();
  } catch (err) {
    setDropError(zone, (err as Error).message);
  }
}

// ─── Folder scanning ──────────────────────────────────────────────────────────

function scanFolderInput(input: HTMLInputElement): FolderFile[] {
  const files: FolderFile[] = [];
  const allFiles = input.files;
  if (!allFiles) return files;
  for (let i = 0; i < allFiles.length; i++) {
    const f = allFiles[i];
    const rel = f.webkitRelativePath;
    // strip the top-level folder name: "folderName/path/to/file.json" -> "path/to/file.json"
    const name = rel.split('/').slice(1).join('/');
    if (name.toLowerCase().endsWith('.json')) {
      files.push({ name, file: f });
    }
  }
  return files;
}

function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve) => {
    const all: FileSystemEntry[] = [];
    function batch(): void {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          resolve(all);
        } else {
          all.push(...entries);
          batch();
        }
      });
    }
    batch();
  });
}

async function walkEntry(entry: FileSystemEntry, path: string): Promise<FolderFile[]> {
  const results: FolderFile[] = [];
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    if (entry.name.toLowerCase().endsWith('.json')) {
      const file = await new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject));
      results.push({ name: path + entry.name, file });
    }
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const children = await readAllEntries(reader);
    for (const child of children) {
      const sub = await walkEntry(child, path + entry.name + '/');
      results.push(...sub);
    }
  }
  return results;
}

async function scanFolderDrop(dataTransfer: DataTransfer): Promise<FolderFile[]> {
  const results: FolderFile[] = [];
  const items = dataTransfer.items;
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry();
    if (!entry) continue;
    if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      const children = await readAllEntries(reader);
      for (const child of children) {
        const sub = await walkEntry(child, '');
        results.push(...sub);
      }
    } else if (entry.isFile && entry.name.toLowerCase().endsWith('.json')) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject));
      results.push({ name: entry.name, file });
    }
  }
  return results;
}

function buildFolderEntries(a: FolderFile[], b: FolderFile[]): FolderEntry[] {
  const map = new Map<string, FolderEntry>();
  for (const f of a) {
    map.set(f.name, { name: f.name, fileA: f, fileB: null });
  }
  for (const f of b) {
    const existing = map.get(f.name);
    if (existing) {
      existing.fileB = f;
    } else {
      map.set(f.name, { name: f.name, fileA: null, fileB: f });
    }
  }
  const entries = Array.from(map.values());
  // Sort: matched first, then only-A, then only-B
  entries.sort((x, y) => {
    const rankX = x.fileA && x.fileB ? 0 : x.fileA ? 1 : 2;
    const rankY = y.fileA && y.fileB ? 0 : y.fileA ? 1 : 2;
    if (rankX !== rankY) return rankX - rankY;
    return x.name.localeCompare(y.name);
  });
  return entries;
}

function setFolderDropSuccess(zone: HTMLElement, nameElId: string, folderName: string, count: number): void {
  zone.classList.add('loaded');
  zone.querySelector<HTMLElement>('.drop-icon')!.textContent = '✅';
  const nameEl = zone.querySelector<HTMLElement>('.file-name')!;
  nameEl.textContent = `${folderName} (${count} .json files)`;
  document.getElementById(nameElId)!.textContent = folderName;
}

function setFolderDropError(zone: HTMLElement, message: string): void {
  zone.classList.add('error');
  zone.querySelector<HTMLElement>('.drop-icon')!.textContent = '❌';
  zone.querySelector<HTMLElement>('.file-name')!.textContent = message;
  setTimeout(() => {
    zone.classList.remove('error');
    zone.querySelector<HTMLElement>('.drop-icon')!.textContent = '📁';
    zone.querySelector<HTMLElement>('.file-name')!.textContent = 'No folder loaded';
  }, 2500);
}

function wireFolderDropZone(
  zoneId: string,
  inputId: string,
  nameElId: string,
  onLoaded: (files: FolderFile[], name: string) => void,
): void {
  const zone = document.getElementById(zoneId)!;
  const input = document.getElementById(inputId) as HTMLInputElement;

  zone.addEventListener('click', () => input.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (!e.dataTransfer) return;

    // Determine folder name from the first directory item
    let name = 'Folder';
    const items = e.dataTransfer.items;
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry();
      if (entry?.isDirectory) { name = entry.name; break; }
    }

    try {
      const files = await scanFolderDrop(e.dataTransfer);
      if (files.length === 0) {
        setFolderDropError(zone, 'No .json files found in dropped folder.');
        return;
      }
      setFolderDropSuccess(zone, nameElId, name, files.length);
      onLoaded(files, name);
    } catch {
      setFolderDropError(zone, 'Failed to read folder.');
    }
  });

  input.addEventListener('change', () => {
    if (!input.files || input.files.length === 0) return;
    // Derive folder name from webkitRelativePath of first file
    const firstPath = input.files[0].webkitRelativePath;
    const name = firstPath ? firstPath.split('/')[0] : 'Folder';
    const files = scanFolderInput(input);
    if (files.length === 0) {
      setFolderDropError(zone, 'No .json files found in selected folder.');
      return;
    }
    setFolderDropSuccess(zone, nameElId, name, files.length);
    onLoaded(files, name);
  });
}

function updateFolderCompareButton(): void {
  const btn = document.getElementById('folder-compare-btn') as HTMLButtonElement;
  const hint = document.getElementById('folder-compare-hint')!;
  if (folderFilesA.length > 0 && folderFilesB.length > 0) {
    btn.disabled = false;
    hint.textContent = `Ready: ${folderNameA} vs ${folderNameB}`;
  } else if (folderFilesA.length === 0 && folderFilesB.length === 0) {
    btn.disabled = true;
    hint.textContent = 'Load both folders to compare';
  } else {
    btn.disabled = true;
    hint.textContent = folderFilesA.length > 0 ? 'Now load Folder B' : 'Now load Folder A';
  }
}

function triggerFolderCompare(): void {
  if (folderFilesA.length === 0 || folderFilesB.length === 0) return;
  const entries = buildFolderEntries(folderFilesA, folderFilesB);

  // Update title
  const title = document.getElementById('folder-results-title')!;
  title.innerHTML = `<span class="label-a">${escHtml(folderNameA)}</span> vs <span class="label-b">${escHtml(folderNameB)}</span>`;

  // Show folder results section
  app.querySelector('.folder-results-section')!.classList.remove('hidden');

  const onCompare = async (fa: FolderFile, fb: FolderFile, nA: string, nB: string) => {
    const [a, b] = await Promise.all([loadFile(fa.file), loadFile(fb.file)]);
    const result = compare(a.skeleton, b.skeleton);
    const compareTitle = document.getElementById('compare-title')!;
    const verA = a.skeleton.skeleton?.spine ? ` <span class="version-badge">${escHtml(a.skeleton.skeleton.spine)}</span>` : '';
    const verB = b.skeleton.skeleton?.spine ? ` <span class="version-badge">${escHtml(b.skeleton.skeleton.spine)}</span>` : '';
    compareTitle.innerHTML = `<span class="label-a">${escHtml(nA)}</span>${verA} vs <span class="label-b">${escHtml(nB)}</span>${verB}`;
    showResult(app, result, nA, nB);
    app.querySelector('.folder-results-section')!.classList.add('hidden');
    app.querySelector('.compare-section')!.classList.remove('hidden');
  };

  const onGetStats = async (fa: FolderFile, fb: FolderFile) => {
    const [a, b] = await Promise.all([loadFile(fa.file), loadFile(fb.file)]);
    return compare(a.skeleton, b.skeleton);
  };

  showFolderResult(
    document.getElementById('folder-entries')!,
    entries,
    folderNameA,
    folderNameB,
    onCompare,
    onGetStats,
  );
}

// ─── Mode toggle ──────────────────────────────────────────────────────────────

function switchMode(mode: 'single' | 'folder'): void {
  currentMode = mode;

  document.getElementById('mode-single')!.classList.toggle('active', mode === 'single');
  document.getElementById('mode-folder')!.classList.toggle('active', mode === 'folder');

  app.querySelector('.upload-section')!.classList.toggle('hidden', mode === 'folder');
  app.querySelector('.folder-section')!.classList.toggle('hidden', mode === 'single');
  app.querySelector('.compare-section')!.classList.add('hidden');
  app.querySelector('.folder-results-section')!.classList.add('hidden');
}

document.getElementById('mode-single')!.addEventListener('click', () => switchMode('single'));
document.getElementById('mode-folder')!.addEventListener('click', () => switchMode('folder'));

// ─── Wire drop zones ─────────────────────────────────────────────────────────

wireDropZone('drop-a', 'file-a', 'name-a', (f) => {
  fileA = f;
});
wireDropZone('drop-b', 'file-b', 'name-b', (f) => {
  fileB = f;
});

wireFolderDropZone('folder-drop-a', 'folder-input-a', 'folder-name-a', (files, name) => {
  folderFilesA = files;
  folderNameA = name;
  updateFolderCompareButton();
  if (folderFilesB.length > 0) triggerFolderCompare();
});

wireFolderDropZone('folder-drop-b', 'folder-input-b', 'folder-name-b', (files, name) => {
  folderFilesB = files;
  folderNameB = name;
  updateFolderCompareButton();
  if (folderFilesA.length > 0) triggerFolderCompare();
});

document.getElementById('folder-compare-btn')!.addEventListener('click', () => {
  if (folderFilesA.length > 0 && folderFilesB.length > 0) triggerFolderCompare();
});

// ─── Compare button ───────────────────────────────────────────────────────────

document.getElementById('compare-btn')!.addEventListener('click', () => {
  if (!fileA || !fileB) return;
  const result = compare(fileA.skeleton, fileB.skeleton);
  const title = document.getElementById('compare-title')!;
  const verA = fileA.skeleton.skeleton?.spine ? ` <span class="version-badge">${escHtml(fileA.skeleton.skeleton.spine)}</span>` : '';
  const verB = fileB.skeleton.skeleton?.spine ? ` <span class="version-badge">${escHtml(fileB.skeleton.skeleton.spine)}</span>` : '';
  title.innerHTML = `<span class="label-a">${escHtml(fileA.name)}</span>${verA} vs <span class="label-b">${escHtml(fileB.name)}</span>${verB}`;
  showResult(app, result, fileA.name, fileB.name);
});

// ─── Reset buttons ─────────────────────────────────────────────────────────────

document.getElementById('reset-btn')!.addEventListener('click', () => {
  if (currentMode === 'folder') {
    // In folder mode: return to folder results view
    app.querySelector('.compare-section')!.classList.add('hidden');
    app.querySelector('.folder-results-section')!.classList.remove('hidden');
    return;
  }

  fileA = null;
  fileB = null;

  ['drop-a', 'drop-b'].forEach((id) => {
    const zone = document.getElementById(id)!;
    zone.classList.remove('loaded', 'error', 'drag-over');
    zone.querySelector<HTMLElement>('.drop-icon')!.textContent = '📂';
    zone.querySelector<HTMLElement>('.file-name')!.textContent = 'No file loaded';
  });
  ['name-a', 'name-b'].forEach((id) => {
    document.getElementById(id)!.textContent = 'No file loaded';
  });

  app.querySelector('.upload-section')?.classList.remove('compact');
  app.querySelector('.compare-section')!.classList.add('hidden');
  updateCompareButton();
});

document.getElementById('folder-reset-btn')!.addEventListener('click', () => {
  folderFilesA = [];
  folderFilesB = [];
  folderNameA = '';
  folderNameB = '';

  ['folder-drop-a', 'folder-drop-b'].forEach((id) => {
    const zone = document.getElementById(id)!;
    zone.classList.remove('loaded', 'error', 'drag-over');
    zone.querySelector<HTMLElement>('.drop-icon')!.textContent = '📁';
    zone.querySelector<HTMLElement>('.file-name')!.textContent = 'No folder loaded';
  });

  app.querySelector('.folder-results-section')!.classList.add('hidden');
  document.getElementById('folder-entries')!.innerHTML = '';
  updateFolderCompareButton();
});

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
