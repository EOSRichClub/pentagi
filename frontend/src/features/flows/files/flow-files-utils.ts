import type { FileNode } from '@/components/shared/file-manager';
import type { FlowFileFragmentFragment } from '@/graphql/types';

import { buildPathsQuery } from '@/features/resources/resources-utils';
import { baseUrl } from '@/models/api';

import {
    CONTAINER_PATH_PREFIX,
    DATA_PATH_PREFIX,
    REPORTS_PATH_PREFIX,
    RESOURCES_PATH_PREFIX,
    SOURCE_PATH_PREFIX,
    UPLOADS_PATH_PREFIX,
    WORK_PATH_PREFIX,
} from './flow-files-constants';

/**
 * Wire shape of `models.ContainerFiles`. `path` echoes back the queried path
 * when exactly one was requested — empty string for multi-path queries.
 */
export interface ContainerFilesResponse {
    files: RestContainerFile[];
    path: string;
    total: number;
}

export type FlowFile = FlowFileFragmentFragment;

/**
 * Wire shape of `models.FlowFile` (REST JSON, snake_case). The internal
 * `FlowFile` alias mirrors the GraphQL camelCase fragment for use in the
 * FileManager UI. Current consumers of `FlowFilesResponse` only read
 * `files.length` and `files[0].name`, so no conversion helper is needed yet.
 */
export interface FlowFilesResponse {
    files: RestFlowFile[];
    total: number;
}

/** Wire shape of `models.ContainerFile` — matches `RestFlowFile` exactly today. */
export interface RestContainerFile {
    id: string;
    is_dir: boolean;
    modified_at: string;
    name: string;
    path: string;
    size: number;
}

export interface RestFlowFile {
    id: string;
    is_dir: boolean;
    modified_at: string;
    name: string;
    path: string;
    size: number;
}

const ROOT_PREFIXES = [
    `${DATA_PATH_PREFIX}/`,
    `${REPORTS_PATH_PREFIX}/`,
    `${SOURCE_PATH_PREFIX}/`,
    `${UPLOADS_PATH_PREFIX}/`,
    `${WORK_PATH_PREFIX}/`,
    `${CONTAINER_PATH_PREFIX}/`,
    `${RESOURCES_PATH_PREFIX}/`,
];

/**
 * Strips the synthetic root group prefix (`uploads/`, `container/`, `resources/`)
 * from a flow-file path so callers can suggest a sensible default `destination`
 * when promoting the file into the user's global resource library.
 */
export const stripFlowRootPrefix = (path: string): string => {
    for (const prefix of ROOT_PREFIXES) {
        if (path.startsWith(prefix)) {
            return path.slice(prefix.length);
        }
    }

    return path;
};

/**
 * Normalise a user-typed or FileManager path into the cache-relative form the
 * backend accepts: must start with `uploads/`, `container/`, or `resources/`
 * and must NOT have a leading `/`.
 *
 * Common user mistakes we repair:
 *   - `/work/foo`          → `container/work/foo`
 *   - `work/foo`           → `container/work/foo`
 *   - `/uploads/a.txt`     → `uploads/a.txt`
 *   - `/container/etc`     → `container/etc`
 */
export const normalizeFlowCachePath = (input: string): string => {
    let path = input.trim().replace(/\\/g, '/');

    while (path.startsWith('/')) {
        path = path.slice(1);
    }

    if (!path || path === '.') {
        return '';
    }

    // Bare work paths stay as work/ (agent workspace); legacy /work/* still ok.
    if (path.startsWith('work/')) {
        return path;
    }

    return path;
};

/**
 * Build the absolute download URL for one or more flow files. Returns `null`
 * when no flow is selected so callers can disable the download UI without
 * checking `flowId` themselves. The backend decides the response shape on its
 * own (single file → attachment, single directory → `<dirname>.zip`, multiple
 * paths → `download.zip`); callers just pass the file list.
 *
 * Prefer the simple query form `?path=` for a single file (matches backend
 * tests and avoids any ambiguity around `paths[]` encoding).
 */
export const buildFlowFilesDownloadHref = (flowId: null | string, files: readonly FileNode[]): null | string => {
    if (!flowId || files.length === 0) {
        return null;
    }

    const normalised = files
        .map((file) => normalizeFlowCachePath(file.path))
        .filter((path) => path.length > 0);

    if (normalised.length === 0) {
        return null;
    }

    if (normalised.length === 1) {
        return `${baseUrl}/flows/${flowId}/files/download?path=${encodeURIComponent(normalised[0])}`;
    }

    return `${baseUrl}/flows/${flowId}/files/download?${buildPathsQuery(normalised)}`;
};

/** Trigger a browser-native download (default Downloads folder). */
export const triggerBrowserDownload = (href: string, fileName?: string): void => {
    const anchor = document.createElement('a');

    anchor.href = href;
    anchor.rel = 'noopener';

    if (fileName) {
        anchor.download = fileName;
    }

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
};

/**
 * Unique local filename so multi-flow / multi-report downloads never collide
 * in the browser Downloads folder.
 *
 * Example: `flow-25__container__work__final_pentest_report.md`
 */
export const buildUniqueDownloadFileName = (flowId: string, file: FileNode): string => {
    const rawPath = normalizeFlowCachePath(file.path) || file.name;
    const isZip = Boolean(file.isDir);
    const pathForName = isZip ? rawPath : rawPath.replace(/\.md$/i, '');
    const slug = pathForName
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\//g, '__')
        .replace(/[^a-zA-Z0-9._\u4e00-\u9fff-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

    const base = slug || (file.name || 'report').replace(/\.md$/i, '');
    const ext = isZip ? 'zip' : 'md';

    return `flow-${flowId}__${base}.${ext}`;
};

/** True for markdown files we treat as downloadable reports. */
export const isMarkdownReportFile = (file: FileNode): boolean => {
    if (file.isDir) {
        return false;
    }

    const name = (file.name || '').toLowerCase();
    const path = (file.path || '').toLowerCase();

    return name.endsWith('.md') || path.endsWith('.md');
};

export const formatFileSizeShort = (bytes: number | undefined): string => {
    if (bytes == null || !Number.isFinite(bytes)) {
        return '';
    }

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const toFileNode = (file: FlowFile): FileNode => ({
    id: file.id,
    isDir: file.isDir,
    modifiedAt: file.modifiedAt,
    name: file.name,
    path: file.path,
    size: file.size,
});

/**
 * Convert a `RestContainerFile` (snake_case wire shape) into a `FileNode` the
 * FileManager can render. Container paths are absolute (`/work/foo.txt`); the
 * Pull dialog sends them straight back to `POST /files/pull?paths=…` so no
 * normalisation is needed here — we pass the path through verbatim.
 */
export const containerFileToFileNode = (file: RestContainerFile): FileNode => ({
    id: file.id,
    isDir: file.is_dir,
    modifiedAt: file.modified_at,
    name: file.name,
    path: file.path,
    size: file.size,
});

export const pluralizeItems = (count: number): string => (count === 1 ? 'item' : 'items');
