
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

// Constants
export const TEMP_DIR = path.join(process.cwd(), 'server', 'temp');
export const API_FOLDER = path.join(process.cwd(), 'client', 'api');
export const IMPORTS_DIR = path.join(process.cwd(), 'client', 'imports');
export const COLLECTIONS_DIR = path.join(process.cwd(), 'client', 'collections');

/**
 * Ensures necessary directories exist
 */
export async function ensureDirectories(dirs: string[]) {
  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

/**
 * Ensures API folder exists
 */
export async function ensureApiFolder() {
  try {
    await fs.access(API_FOLDER);
  } catch {
    await fs.mkdir(API_FOLDER, { recursive: true });
  }
}

/**
 * Cleans up a directory if it exists
 */
export function cleanupDirectory(dirPath: string): void {
  if (fsSync.existsSync(dirPath)) {
    fsSync.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Gets all files recursively from a directory
 */
export async function getAllFiles(dir: string): Promise<string[]> {
  const files = await fs.readdir(dir, { withFileTypes: true });
  const paths = await Promise.all(files.map(async (file) => {
    const filePath = path.join(dir, file.name);
    return file.isDirectory() ? getAllFiles(filePath) : filePath;
  }));
  return paths.flat();
}
