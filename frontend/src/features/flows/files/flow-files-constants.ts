import { Code2, Database, FileText, Folder, FolderUp, HardDrive } from 'lucide-react';

import type { FileManagerRootGroup } from '@/components/shared/file-manager';

export const SEARCH_DEBOUNCE_MS = 300;

export const UPLOADS_PATH_PREFIX = 'uploads';
export const WORK_PATH_PREFIX = 'work';
export const RESOURCES_PATH_PREFIX = 'resources';
export const CONTAINER_PATH_PREFIX = 'container';
/** 下载的数据（置顶） */
export const DATA_PATH_PREFIX = 'data';
/** 报告 MD 文档（置顶） */
export const REPORTS_PATH_PREFIX = 'reports';
/** 源码（置顶） */
export const SOURCE_PATH_PREFIX = 'source';

/**
 * Root groups — order = display order.
 * data / reports / source are pinned at the top for quick access.
 */
export const ROOT_GROUPS: FileManagerRootGroup[] = [
    { defaultOpen: true, icon: Database, id: 'data', label: '📊 Data 数据', pathPrefix: DATA_PATH_PREFIX },
    { defaultOpen: true, icon: FileText, id: 'reports', label: '📄 报告 MD', pathPrefix: REPORTS_PATH_PREFIX },
    { defaultOpen: true, icon: Code2, id: 'source', label: '💻 源码', pathPrefix: SOURCE_PATH_PREFIX },
    { defaultOpen: true, icon: FolderUp, id: 'uploads', label: '上传资料', pathPrefix: UPLOADS_PATH_PREFIX },
    { defaultOpen: false, icon: Folder, id: 'work', label: '工作区/其它产物', pathPrefix: WORK_PATH_PREFIX },
    { defaultOpen: false, icon: HardDrive, id: 'container', label: '容器快照', pathPrefix: CONTAINER_PATH_PREFIX },
    { defaultOpen: false, icon: Folder, id: 'resources', label: '资源库副本', pathPrefix: RESOURCES_PATH_PREFIX },
];

export const FLOW_FILES_API_PATH = (flowId: string) => `/flows/${flowId}/files/`;
export const FLOW_FILES_MKDIR_API_PATH = (flowId: string) => `/flows/${flowId}/files/mkdir`;
export const FLOW_FILES_PULL_API_PATH = (flowId: string) => `/flows/${flowId}/files/pull`;
/** Sync deliverables from terminal /work → cache; main path always latest, prior versions kept. */
export const FLOW_FILES_SYNC_API_PATH = (flowId: string) => `/flows/${flowId}/files/sync`;
export const FLOW_FILES_CONTAINER_API_PATH = (flowId: string) => `/flows/${flowId}/files/container`;
export const FLOW_FILES_ATTACH_RESOURCES_API_PATH = (flowId: string) => `/flows/${flowId}/files/resources`;
export const FLOW_FILES_PROMOTE_API_PATH = (flowId: string) => `/flows/${flowId}/files/to-resources`;
export const RESOURCES_LIST_API_PATH = '/resources/';

export const UPLOADS_TARGET_DIRECTORY = '/work/uploads';
export const CONTAINER_TARGET_DIRECTORY = 'container/';
export const RESOURCES_TARGET_DIRECTORY = '/work/resources';

/** Default container path browsed when the Pull dialog opens. */
export const CONTAINER_DEFAULT_PATH = '/work';

// ── Upload limits (mirror backend's `pkg/flowfiles/files.go`) ──────────────
//
// Symmetric with the resources library limits (`features/resources/resources-constants.ts`)
// today, but kept as a separate set so they can diverge from resources without
// touching the resources call sites.

/** Mirrors `flowfiles.MaxUploadFileSize` (300 MB). */
export const FLOW_FILES_MAX_FILE_SIZE_MB = 300;

/** Mirrors `flowfiles.MaxUploadTotalSize` (2 GB) — combined size of one request. */
export const FLOW_FILES_MAX_UPLOAD_TOTAL_SIZE_MB = 2 * 1024;

/** Mirrors `flowfiles.MaxUploadFiles`. */
export const FLOW_FILES_MAX_UPLOAD_FILES_PER_REQUEST = 1000;
