import JSZip from 'jszip';
import type { OrderDocumentItem } from '../core/types';

/**
 * Downloads a single file with its new resolved filename.
 */
export function downloadSingleFile(file: File, finalFileName: string): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Bundles all items into a single zip archive with their renamed filenames
 * and triggers a browser download.
 */
export async function downloadAllAsZip(items: OrderDocumentItem[]): Promise<void> {
  if (items.length === 0) return;

  const zip = new JSZip();

  for (const item of items) {
    const arrayBuffer = await item.file.arrayBuffer();
    zip.file(item.finalFileName, arrayBuffer);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const today = new Date().toISOString().split('T')[0];
  const zipFileName = `Переименованные_приказы_${today}.zip`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Checks if the modern File System Access API (showDirectoryPicker)
 * is supported in the current browser environment.
 */
export function supportsDirectorySave(): boolean {
  return typeof window !== 'undefined' && typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

/**
 * Prompts the user to select an output folder and writes all renamed files
 * directly into that folder using the File System Access API.
 * Returns the number of successfully saved files.
 */
export async function saveAllToDirectory(items: OrderDocumentItem[]): Promise<number> {
  if (!supportsDirectorySave()) {
    throw new Error('File System Access API (showDirectoryPicker) не поддерживается в этом браузере');
  }

  // Request directory handle from the user
  const dirHandle = await (window as unknown as {
    showDirectoryPicker: (options?: { mode?: 'read' | 'readwrite' }) => Promise<{
      getFileHandle: (name: string, options?: { create?: boolean }) => Promise<{
        createWritable: () => Promise<{
          write: (data: ArrayBuffer) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    }>;
  }).showDirectoryPicker({ mode: 'readwrite' });

  let savedCount = 0;

  for (const item of items) {
    const fileHandle = await dirHandle.getFileHandle(item.finalFileName, { create: true });
    const writable = await fileHandle.createWritable();
    const arrayBuffer = await item.file.arrayBuffer();
    await writable.write(arrayBuffer);
    await writable.close();
    savedCount++;
  }

  return savedCount;
}
