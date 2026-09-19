/** 兼容模式的文件夹选择：不依赖 File System Access API。 */

export interface PickFilesOptions {
  /** 选择整个目录（webkitdirectory）。 */
  directory?: boolean;
  multiple?: boolean;
}

/**
 * 用隐藏的 <input type="file"> 选择文件。
 * 用户取消时返回空数组（cancel 事件在主流内核均已支持）。
 */
export function pickFilesFromInput(
  options: PickFilesOptions = {},
): Promise<File[]> {
  const { directory = false, multiple = true } = options;

  return new Promise<File[]>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = multiple;
    input.accept = "audio/*";
    if (directory) {
      input.webkitdirectory = true;
      input.setAttribute("directory", "");
    }
    input.style.position = "fixed";
    input.style.width = "0";
    input.style.height = "0";
    input.style.opacity = "0";

    const finish = (files: File[]) => {
      input.remove();
      resolve(files);
    };

    input.addEventListener("change", () => {
      finish(Array.from(input.files ?? []));
    });
    input.addEventListener("cancel", () => finish([]));

    document.body.appendChild(input);
    input.click();
  });
}

/** 从拖拽事件里取出文件（含目录递归）。 */
export async function filesFromDataTransfer(
  transfer: DataTransfer,
): Promise<File[]> {
  const items = Array.from(transfer.items ?? []);
  const entries = items
    .map((item) =>
      item.kind === "file"
        ? (item as DataTransferItem & {
            webkitGetAsEntry?: () => FileSystemEntry | null;
          }).webkitGetAsEntry?.() ?? null
        : null,
    )
    .filter((entry): entry is FileSystemEntry => Boolean(entry));

  if (entries.length === 0) {
    return Array.from(transfer.files ?? []);
  }

  const files: File[] = [];
  for (const entry of entries) {
    await collectEntry(entry, files);
  }
  return files.length > 0 ? files : Array.from(transfer.files ?? []);
}

async function collectEntry(entry: FileSystemEntry, files: File[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File | null>((resolve) => {
      (entry as FileSystemFileEntry).file(
        (value) => resolve(value),
        () => resolve(null),
      );
    });
    if (file) files.push(file);
    return;
  }

  if (!entry.isDirectory) return;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve) => {
      reader.readEntries(
        (values) => resolve(values),
        () => resolve([]),
      );
    });
    if (batch.length === 0) break;
    for (const child of batch) {
      await collectEntry(child, files);
    }
  }
}
