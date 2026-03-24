import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  removePendingFileAtIndex,
  revokePendingFilePreviews,
} from "./fileUploadUtils";

export interface PendingFile {
  file: File;
  preview: string; // blob URL for image/video thumbnails
}

export interface UploadedFile {
  storageId: Id<"_storage">;
  name: string;
  type: string;
  size: number;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export function useFileUpload() {
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles: PendingFile[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`"${file.name}" exceeds the 25 MB limit.`);
        continue;
      }
      const preview = file.type.startsWith("image/") || file.type.startsWith("video/")
        ? URL.createObjectURL(file)
        : "";
      newFiles.push({ file, preview });
    }
    setPendingFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => removePendingFileAtIndex(prev, index));
  }, []);

  const uploadAll = useCallback(async (): Promise<UploadedFile[]> => {
    if (pendingFiles.length === 0) return [];
    setIsUploading(true);
    try {
      const results: UploadedFile[] = [];
      for (const pending of pendingFiles) {
        // Get a signed URL from Convex
        const uploadUrl = await generateUploadUrl();
        // POST the file
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": pending.file.type },
          body: pending.file,
        });
        const { storageId } = await response.json();
        results.push({
          storageId,
          name: pending.file.name,
          type: pending.file.type,
          size: pending.file.size,
        });
      }
      // Cleanup previews
      revokePendingFilePreviews(pendingFiles);
      setPendingFiles([]);
      return results;
    } finally {
      setIsUploading(false);
    }
  }, [pendingFiles, generateUploadUrl]);

  const clear = useCallback(() => {
    revokePendingFilePreviews(pendingFiles);
    setPendingFiles([]);
  }, [pendingFiles]);

  return {
    pendingFiles,
    isUploading,
    addFiles,
    removeFile,
    uploadAll,
    clear,
    hasPending: pendingFiles.length > 0,
  };
}
