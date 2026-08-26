import fs from 'fs';
import path from 'path';

export async function walk(dir: string): Promise<string[]> {
  const visited = new Set<string>();
  return await walkInternal(dir, visited);
}

async function walkInternal(
  dir: string,
  visited: Set<string>,
): Promise<string[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Handle symlinks by following them but tracking visited paths
    let isDir = entry.isDirectory();
    let isFileEntry = entry.isFile();

    if (entry.isSymbolicLink()) {
      const stats = await fs.promises.stat(fullPath).catch(() => null);

      if (stats === null) {
        // Skip broken symlinks
        continue;
      }

      isDir = stats.isDirectory();
      isFileEntry = stats.isFile();
    }

    if (isDir) {
      // Track visited directories by their real path to prevent infinite loops
      let realPath: string;
      try {
        realPath = await fs.promises.realpath(fullPath);
      } catch {
        // Skip if we can't resolve the real path
        continue;
      }

      if (visited.has(realPath)) {
        // Skip already visited directories (prevents infinite loops from symlinks)
        continue;
      }

      visited.add(realPath);
      results.push(...await walkInternal(fullPath, visited));
    } else if (isFileEntry) {
      // Track visited files by their real path to prevent duplicates.
      // Only resolve realpath for symlinks — for regular files fullPath
      // is already unique within the walk, saving a syscall per file.
      let realPath: string = fullPath;
      if (entry.isSymbolicLink()) {
        try {
          realPath = await fs.promises.realpath(fullPath);
        } catch {
          // Fall back to fullPath if realpath fails
        }
      }

      if (!visited.has(realPath)) {
        visited.add(realPath);
        results.push(fullPath);
      }
    }
  }

  return results;
}
