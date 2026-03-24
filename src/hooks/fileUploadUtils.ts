import type { PendingFile } from "./useFileUpload";

export function revokePendingFilePreviews(
  pendingFiles: PendingFile[],
  revokeObjectUrl: (url: string) => void = URL.revokeObjectURL,
) {
  for (const pendingFile of pendingFiles) {
    if (pendingFile.preview) {
      revokeObjectUrl(pendingFile.preview);
    }
  }
}

export function removePendingFileAtIndex(
  pendingFiles: PendingFile[],
  index: number,
  revokeObjectUrl: (url: string) => void = URL.revokeObjectURL,
) {
  const removed = pendingFiles[index];
  if (removed?.preview) {
    revokeObjectUrl(removed.preview);
  }
  return pendingFiles.filter((_, currentIndex) => currentIndex !== index);
}
