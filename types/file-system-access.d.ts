// 本文件补充 TypeScript 5.9 内置 DOM 类型中尚未包含的 File System Access API 片段。
// 注意：文件内不能出现 import / export，否则会变成模块，全局声明合并会失效。
interface FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<
    [string, FileSystemFileHandle | FileSystemDirectoryHandle]
  >;
  keys(): AsyncIterableIterator<string>;
  values(): AsyncIterableIterator<
    FileSystemFileHandle | FileSystemDirectoryHandle
  >;
}

// 句柄权限 API 目前仅 Chromium 实现，内置 DOM 类型未包含。
interface FileSystemFileHandle {
  queryPermission?(
    descriptor?: { mode?: "read" | "readwrite" },
  ): Promise<PermissionState>;
  requestPermission?(
    descriptor?: { mode?: "read" | "readwrite" },
  ): Promise<PermissionState>;
}

interface DirectoryPickerOptions {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?:
    | "desktop"
    | "documents"
    | "downloads"
    | "music"
    | "pictures"
    | "videos";
}

interface Window {
  showDirectoryPicker?(
    options?: DirectoryPickerOptions,
  ): Promise<FileSystemDirectoryHandle>;
}
