import { describe, expect, test } from 'bun:test';
import { readFileList, readHandle, reopenDirectory, type DirHandle } from './local';

/**
 * In-memory fakes for the File System Access API shapes `local.ts` consumes.
 * A `Spec` value is either a file's text content (string) or a nested
 * directory (another `Spec`). Mirrors just the surface `readHandle` touches:
 * `entries()` (async iterator of `[name, entry]`), `entry.kind`, and
 * `entry.getFile().then(f => f.text())`.
 */
type Spec = { [name: string]: string | Spec };

function fakeFileHandle(content: string) {
  return {
    kind: 'file' as const,
    getFile: async () => ({ text: async () => content }) as unknown as File,
  };
}

function fakeDir(spec: Spec, name = 'root'): DirHandle {
  const entries = Object.entries(spec);
  return {
    kind: 'directory' as const,
    name,
    entries: async function* () {
      for (const [key, value] of entries) {
        if (typeof value === 'string') {
          yield [key, fakeFileHandle(value)];
        } else {
          yield [key, fakeDir(value, key)];
        }
      }
    },
  } as unknown as DirHandle;
}

describe('readHandle', () => {
  test('nested dirs flatten to slash-joined paths; dotfiles/dot-dirs and non-.md skipped; content round-trips', async () => {
    const dir = fakeDir({
      'index.md': '# Root',
      '.hidden.md': 'should be skipped (dotfile)',
      '.git': { config: 'should be skipped (dot-directory, never even descended into)' },
      'notes.txt': 'should be skipped (not .md)',
      sub: {
        dir: {
          'file.md': 'nested content',
        },
      },
    });

    const acc = new Map<string, string>();
    await readHandle(dir, '', acc);

    expect(acc.get('index.md')).toBe('# Root');
    expect(acc.get('sub/dir/file.md')).toBe('nested content');
    expect(acc.size).toBe(2);
    expect(acc.has('.hidden.md')).toBe(false);
    expect(acc.has('notes.txt')).toBe(false);
    expect([...acc.keys()].some((k) => k.includes('.git'))).toBe(false);
  });

  test('deterministic ordering: parent-dir files land before subdirectory contents regardless of iteration order', async () => {
    // 'sub' is declared before 'root.md' in the spec, so entries() yields the
    // subdirectory first — but the merge-order contract (parallel file reads
    // resolved and set before subdir maps are merged in) must still put the
    // parent's own file first in the accumulator's insertion order.
    const dir = fakeDir({
      sub: { 'a.md': 'sub content' },
      'root.md': 'root content',
    });

    const acc = new Map<string, string>();
    await readHandle(dir, '', acc);

    expect([...acc.keys()]).toEqual(['root.md', 'sub/a.md']);
  });
});

describe('readFileList', () => {
  function fakeFile(name: string, webkitRelativePath: string | undefined, content: string) {
    return {
      name,
      webkitRelativePath,
      text: async () => content,
    };
  }

  test('derives bundle name from first path segment and re-slices the rest', async () => {
    const list = [fakeFile('a.md', 'bundle/tables/a.md', 'hello')];
    const { files, name } = await readFileList(list as unknown as FileList);
    expect(name).toBe('bundle');
    expect(files.get('tables/a.md')).toBe('hello');
    expect(files.size).toBe(1);
  });

  test('single-segment path (no webkitRelativePath) falls back to the file name as the key', async () => {
    const list = [fakeFile('root.md', undefined, 'top level')];
    const { files } = await readFileList(list as unknown as FileList);
    expect(files.get('root.md')).toBe('top level');
    expect(files.size).toBe(1);
  });

  test('filters out dot-directory paths and non-.md files', async () => {
    const list = [
      fakeFile('x.md', 'bundle/.git/x.md', 'should be filtered (dot-directory segment)'),
      fakeFile('notes.txt', 'bundle/notes.txt', 'should be filtered (not .md)'),
      fakeFile('kept.md', 'bundle/tables/kept.md', 'kept'),
    ];
    const { files, name } = await readFileList(list as unknown as FileList);
    expect(name).toBe('bundle');
    expect(files.size).toBe(1);
    expect(files.get('tables/kept.md')).toBe('kept');
  });
});

describe('reopenDirectory', () => {
  function fakeHandleWithPermissions(opts: {
    query: 'granted' | 'denied' | 'prompt';
    request?: 'granted' | 'denied' | 'prompt';
  }) {
    let entriesCalled = false;
    const handle = {
      kind: 'directory' as const,
      name: 'reopened',
      queryPermission: async () => opts.query,
      requestPermission: async () => {
        if (opts.request === undefined) throw new Error('requestPermission should not have been called');
        return opts.request;
      },
      entries: async function* () {
        entriesCalled = true;
        yield ['a.md', fakeFileHandle('reopened content')];
      },
    } as unknown as DirHandle;
    return { handle, wasRead: () => entriesCalled };
  }

  test('returns "denied" without reading files when permission is refused', async () => {
    const { handle, wasRead } = fakeHandleWithPermissions({ query: 'prompt', request: 'denied' });
    const result = await reopenDirectory(handle);
    expect(result).toBe('denied');
    expect(wasRead()).toBe(false);
  });

  test('proceeds to read files when permission is already granted', async () => {
    const { handle, wasRead } = fakeHandleWithPermissions({ query: 'granted' });
    const result = await reopenDirectory(handle);
    expect(result).not.toBe('denied');
    if (result === 'denied') throw new Error('unreachable');
    expect(result.name).toBe('reopened');
    expect(result.files.get('a.md')).toBe('reopened content');
    expect(wasRead()).toBe(true);
  });

  test('proceeds to read files when the request prompt is subsequently granted', async () => {
    const { handle, wasRead } = fakeHandleWithPermissions({ query: 'prompt', request: 'granted' });
    const result = await reopenDirectory(handle);
    expect(result).not.toBe('denied');
    if (result === 'denied') throw new Error('unreachable');
    expect(result.files.get('a.md')).toBe('reopened content');
    expect(wasRead()).toBe(true);
  });
});
