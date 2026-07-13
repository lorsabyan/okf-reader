/**
 * Browser adapters for opening a local directory as an OKF bundle.
 * Nothing is uploaded anywhere — files are read in-page only.
 */

/** TS's dom lib doesn't ship the async-iterable parts of the FS Access API yet. */
export interface DirHandle {
  readonly kind: 'directory';
  readonly name: string;
  entries(): AsyncIterableIterator<[string, DirHandle | FileHandle]>;
  /** Chromium-only permissions extension, also missing from TS's dom lib. */
  queryPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
}
interface FileHandle {
  readonly kind: 'file';
  getFile(): Promise<File>;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: () => Promise<DirHandle>;
}

export function supportsDirectoryPicker(): boolean {
  return typeof window !== 'undefined' && !!(window as DirectoryPickerWindow).showDirectoryPicker;
}

/** File System Access API (Chromium): live handle, recursive read. */
export async function pickDirectory(): Promise<{ files: Map<string, string>; name: string; handle: DirHandle } | null> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) return null;
  let handle: DirHandle;
  try {
    handle = await picker.call(window);
  } catch {
    return null; // user cancelled
  }
  const files = new Map<string, string>();
  await readHandle(handle, '', files);
  return { files, name: handle.name, handle };
}

export async function readHandle(dir: DirHandle, prefix: string, acc: Map<string, string>) {
  for await (const [name, entry] of dir.entries()) {
    if (name.startsWith('.')) continue;
    const path = prefix ? `${prefix}/${name}` : name;
    if (entry.kind === 'directory') {
      await readHandle(entry, path, acc);
    } else if (name.endsWith('.md')) {
      acc.set(path, await (await entry.getFile()).text());
    }
  }
}

/**
 * Re-read a previously-picked directory handle (from a "recent bundle"),
 * requesting read permission again if the browser needs it re-confirmed.
 * Returns 'denied' if the user declines, otherwise the fresh file snapshot.
 */
export async function reopenDirectory(
  handle: DirHandle,
): Promise<{ files: Map<string, string>; name: string } | 'denied'> {
  if (handle.queryPermission) {
    let state = await handle.queryPermission({ mode: 'read' });
    if (state !== 'granted' && handle.requestPermission) {
      state = await handle.requestPermission({ mode: 'read' });
    }
    if (state !== 'granted') return 'denied';
  }
  const files = new Map<string, string>();
  await readHandle(handle, '', files);
  return { files, name: handle.name };
}

/** <input type="file" webkitdirectory> fallback (all browsers): one-shot snapshot. */
export async function readFileList(list: FileList): Promise<{ files: Map<string, string>; name: string }> {
  const files = new Map<string, string>();
  let name = 'bundle';
  for (const file of Array.from(list)) {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const parts = rel.split('/');
    if (parts.length > 1) name = parts[0];
    const path = parts.slice(1).join('/') || parts[0];
    if (!path.endsWith('.md') || path.split('/').some((p) => p.startsWith('.'))) continue;
    files.set(path, await file.text());
  }
  return { files, name };
}
