/**
 * Reliable browser downloads.
 *
 * Chrome's File System Access pickers (`showSaveFilePicker`) are fragile:
 * they must run in a user-gesture turn, throw SecurityError on IP / bad cert
 * contexts, and uncaught errors surface as “This page isn’t working”.
 *
 * Default path: classic authenticated fetch → Blob → <a download>.
 * Optional advanced path (fixed folder) is best-effort and never throws out.
 */

import { Log } from '@/lib/log';

const IDB_NAME = 'pentagi-download-prefs';
const IDB_STORE = 'handles';
const IDB_KEY = 'downloadDir';
const LS_MODE_KEY = 'pentagi.download.mode';
const LS_DIR_NAME_KEY = 'pentagi.download.dirName';

export type DownloadMode = 'ask-each-time' | 'browser-default' | 'fixed-folder';
export type SaveLocalTarget = 'auto' | 'desktop' | 'fixed-folder' | 'pick-location';
export type DownloadResult = 'cancelled' | 'saved-anchor' | 'saved-folder' | 'saved-picker' | 'error';

export interface DownloadPrefs {
    dirName: null | string;
    mode: DownloadMode;
    supportsDirectoryPicker: boolean;
    supportsSavePicker: boolean;
}

const supportsDirectoryPicker = (): boolean =>
    typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

const supportsSavePicker = (): boolean =>
    typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';

/** True when page is a trusted secure context (valid HTTPS / localhost). */
export const isTrustedSecureContext = (): boolean => {
    try {
        if (typeof window === 'undefined') {
            return false;
        }

        // isSecureContext is true even for self-signed after proceed, but FS
        // APIs are still flaky on raw IPs. Prefer hostname with letters.
        if (!window.isSecureContext) {
            return false;
        }

        const host = window.location.hostname;

        if (host === 'localhost' || host === '127.0.0.1') {
            return true;
        }

        // Raw IPv4 — treat as "untrusted for FS API" even if HTTPS.
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
};

const openIdb = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
        const request = indexedDB.open(IDB_NAME, 1);

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    });

export const getDownloadMode = (): DownloadMode => {
    try {
        const raw = localStorage.getItem(LS_MODE_KEY);

        if (raw === 'ask-each-time' || raw === 'browser-default' || raw === 'fixed-folder') {
            return raw;
        }
    } catch {
        // ignore
    }

    return 'browser-default';
};

export const setDownloadMode = (mode: DownloadMode): void => {
    try {
        localStorage.setItem(LS_MODE_KEY, mode);
    } catch {
        // ignore
    }
};

export const getRememberedDirName = (): null | string => {
    try {
        return localStorage.getItem(LS_DIR_NAME_KEY);
    } catch {
        return null;
    }
};

const setRememberedDirName = (name: null | string): void => {
    try {
        if (name) {
            localStorage.setItem(LS_DIR_NAME_KEY, name);
        } else {
            localStorage.removeItem(LS_DIR_NAME_KEY);
        }
    } catch {
        // ignore
    }
};

export const getDownloadPrefs = (): DownloadPrefs => ({
    dirName: getRememberedDirName(),
    mode: getDownloadMode(),
    supportsDirectoryPicker: supportsDirectoryPicker() && isTrustedSecureContext(),
    supportsSavePicker: supportsSavePicker() && isTrustedSecureContext(),
});

export const saveDirectoryHandle = async (handle: FileSystemDirectoryHandle): Promise<void> => {
    try {
        const db = await openIdb();

        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');

            tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error ?? new Error('IndexedDB put failed'));
        });
        db.close();
        setRememberedDirName(handle.name);
        setDownloadMode('fixed-folder');
    } catch (error) {
        Log.error('saveDirectoryHandle failed:', error);
        throw error;
    }
};

export const clearDirectoryHandle = async (): Promise<void> => {
    try {
        const db = await openIdb();

        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');

            tx.objectStore(IDB_STORE).delete(IDB_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'));
        });
        db.close();
    } catch (error) {
        Log.error('Failed to clear download directory handle:', error);
    }

    setRememberedDirName(null);

    if (getDownloadMode() === 'fixed-folder') {
        setDownloadMode('browser-default');
    }
};

export const loadDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
    try {
        const db = await openIdb();
        const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const request = tx.objectStore(IDB_STORE).get(IDB_KEY);

            request.onsuccess = () => resolve((request.result as FileSystemDirectoryHandle | undefined) ?? null);
            request.onerror = () => reject(request.error ?? new Error('IndexedDB get failed'));
        });

        db.close();

        return handle;
    } catch (error) {
        Log.error('Failed to load download directory handle:', error);

        return null;
    }
};

const ensureDirectoryPermission = async (handle: FileSystemDirectoryHandle): Promise<boolean> => {
    try {
        const withPerm = handle as FileSystemDirectoryHandle & {
            queryPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
            requestPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
        };
        const opts = { mode: 'readwrite' as const };

        if (withPerm.queryPermission) {
            let state = await withPerm.queryPermission(opts);

            if (state === 'granted') {
                return true;
            }

            if (withPerm.requestPermission) {
                state = await withPerm.requestPermission(opts);

                return state === 'granted';
            }
        }

        return true;
    } catch {
        return false;
    }
};

export const pickDownloadDirectory = async (
    options: { startIn?: 'desktop' | 'downloads' | 'documents' } = {},
): Promise<FileSystemDirectoryHandle | null> => {
    if (!getDownloadPrefs().supportsDirectoryPicker || !window.showDirectoryPicker) {
        return null;
    }

    try {
        const handle = await window.showDirectoryPicker({
            id: options.startIn === 'desktop' ? 'pentagi-desktop' : 'pentagi-downloads',
            mode: 'readwrite',
            startIn: options.startIn ?? 'downloads',
        });

        if (!(await ensureDirectoryPermission(handle))) {
            return null;
        }

        await saveDirectoryHandle(handle);

        return handle;
    } catch (error) {
        if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'SecurityError')) {
            return null;
        }

        Log.error('Failed to pick download directory:', error);

        return null;
    }
};

export const pickDesktopDirectory = async (): Promise<FileSystemDirectoryHandle | null> =>
    pickDownloadDirectory({ startIn: 'desktop' });

export const sanitizeFileName = (name: string): string => {
    const cleaned = name
        .replace(/[/\\?%*:|"<>]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();

    return cleaned || 'download.bin';
};

export const basenameFromPath = (path: string): string => {
    const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
    const parts = normalized.split('/');

    return sanitizeFileName(parts[parts.length - 1] || 'download.bin');
};

const triggerAnchorDownload = (blobOrUrl: Blob | string, fileName: string): void => {
    const href = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    const anchor = document.createElement('a');

    anchor.href = href;
    anchor.download = sanitizeFileName(fileName);
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    window.setTimeout(() => {
        anchor.remove();

        if (typeof blobOrUrl !== 'string') {
            URL.revokeObjectURL(href);
        }
    }, 1500);
};

const writeBlobToFileHandle = async (fileHandle: FileSystemFileHandle, blob: Blob): Promise<void> => {
    const writable = await fileHandle.createWritable();

    try {
        await writable.write(blob);
    } finally {
        await writable.close();
    }
};

const writeBlobToDirectory = async (
    dir: FileSystemDirectoryHandle,
    fileName: string,
    blob: Blob,
): Promise<void> => {
    const fileHandle = await dir.getFileHandle(sanitizeFileName(fileName), { create: true });

    await writeBlobToFileHandle(fileHandle, blob);
};

const fetchBlob = async (url: string): Promise<{ blob: Blob; fileNameFromServer: null | string }> => {
    const response = await fetch(url, { credentials: 'include' });

    if (!response.ok) {
        let detail = `HTTP ${response.status}`;

        try {
            const text = await response.text();

            if (text) {
                detail = `${detail}: ${text.slice(0, 180)}`;
            }
        } catch {
            // ignore
        }

        throw new Error(`下载失败（${detail}）`);
    }

    const disposition = response.headers.get('Content-Disposition') ?? '';
    const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
    const serverName = match?.[1] ? decodeURIComponent(match[1].replace(/"/g, '')) : null;

    return { blob: await response.blob(), fileNameFromServer: serverName };
};

/**
 * Always-safe download: never throws to React. Uses <a download> by default.
 * Advanced FS APIs only when hostname is a real domain (not bare IP).
 */
export const downloadUrlLocally = async (
    url: string,
    fileName: string,
    target: SaveLocalTarget = 'auto',
): Promise<DownloadResult> => {
    const safeName = sanitizeFileName(fileName);

    try {
        // On bare IP or insecure context: skip all File System Access APIs.
        const allowFs = isTrustedSecureContext() && (supportsSavePicker() || supportsDirectoryPicker());

        let fileHandle: FileSystemFileHandle | null = null;
        let dirHandle: FileSystemDirectoryHandle | null = null;

        if (allowFs && (target === 'desktop' || target === 'pick-location')) {
            try {
                if (window.showSaveFilePicker) {
                    fileHandle = await window.showSaveFilePicker({
                        startIn: target === 'desktop' ? 'desktop' : 'downloads',
                        suggestedName: safeName,
                    });
                }
            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') {
                    return 'cancelled';
                }

                // SecurityError / NotAllowedError → fall through to anchor.
                Log.error('save picker blocked, using browser download:', error);
                fileHandle = null;
            }
        } else if (allowFs && (target === 'fixed-folder' || (target === 'auto' && getDownloadMode() === 'fixed-folder'))) {
            dirHandle = await loadDirectoryHandle();

            if (dirHandle && !(await ensureDirectoryPermission(dirHandle))) {
                dirHandle = null;
            }
        }

        const { blob, fileNameFromServer } = await fetchBlob(url);
        const finalName = sanitizeFileName(fileNameFromServer || safeName);

        if (fileHandle) {
            try {
                await writeBlobToFileHandle(fileHandle, blob);

                return 'saved-picker';
            } catch (error) {
                Log.error('write file handle failed:', error);
            }
        }

        if (dirHandle) {
            try {
                await writeBlobToDirectory(dirHandle, finalName, blob);

                return 'saved-folder';
            } catch (error) {
                Log.error('write directory handle failed:', error);
            }
        }

        triggerAnchorDownload(blob, finalName);

        return 'saved-anchor';
    } catch (error) {
        Log.error('downloadUrlLocally failed:', error);

        try {
            triggerAnchorDownload(url, safeName);
        } catch {
            // ignore
        }

        // Re-throw only as soft message for toast; callers must catch.
        throw error instanceof Error ? error : new Error('下载失败');
    }
};

export const saveBlobLocally = async (
    blob: Blob,
    fileName: string,
    _target: SaveLocalTarget = 'auto',
): Promise<DownloadResult> => {
    try {
        triggerAnchorDownload(blob, sanitizeFileName(fileName));

        return 'saved-anchor';
    } catch (error) {
        Log.error('saveBlobLocally failed:', error);

        return 'error';
    }
};

export const downloadTextLocally = async (
    content: string,
    fileName: string,
    mimeType = 'text/plain;charset=UTF-8',
    target: SaveLocalTarget = 'auto',
): Promise<void> => {
    const blob = new Blob([content], { type: mimeType });

    await saveBlobLocally(blob, fileName, target);
};
