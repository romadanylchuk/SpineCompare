import './style.css';
import type { SpineSkeleton, LoadedFile } from './types';
import { compare } from './comparator';
import { showResult } from './ui';

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

// ─── Wire drop zones ─────────────────────────────────────────────────────────

wireDropZone('drop-a', 'file-a', 'name-a', (f) => {
  fileA = f;
});
wireDropZone('drop-b', 'file-b', 'name-b', (f) => {
  fileB = f;
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

// ─── Reset button ─────────────────────────────────────────────────────────────

document.getElementById('reset-btn')!.addEventListener('click', () => {
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

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
