import { useCallback, useEffect, useRef, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const pendingFilesRef = useRef<PendingFile[]>([]);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles: PendingFile[] = [];
    let nextError: string | null = null;
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_FILE_SIZE) {
        nextError = `"${file.name}" exceeds the 25 MB limit.`;
        continue;
      }
      const preview = file.type.startsWith("image/") || file.type.startsWith("video/")
        ? URL.createObjectURL(file)
        : "";
      newFiles.push({ file, preview });
    }
    setError(nextError);
    setPendingFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => removePendingFileAtIndex(prev, index));
  }, []);

  const uploadAll = useCallback(async (): Promise<UploadedFile[]> => {
    if (pendingFiles.length === 0) return [];
    setIsUploading(true);
    setError(null);
    try {
      const results: UploadedFile[] = [];
      for (const pending of pendingFiles) {
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": pending.file.type },
          body: pending.file,
        });
        if (!response.ok) {
          throw new Error(`Upload failed for "${pending.file.name}".`);
        }
        const { storageId } = await response.json();
        if (!storageId) {
          throw new Error(`Upload failed for "${pending.file.name}".`);
        }
        results.push({
          storageId,
          name: pending.file.name,
          type: pending.file.type,
          size: pending.file.size,
        });
      }
      revokePendingFilePreviews(pendingFiles);
      setPendingFiles([]);
      return results;
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "File upload failed. Please try again.";
      setError(message);
      throw uploadError;
    } finally {
      setIsUploading(false);
    }
  }, [pendingFiles, generateUploadUrl]);

  const clear = useCallback(() => {
    setError(null);
    revokePendingFilePreviews(pendingFiles);
    setPendingFiles([]);
  }, [pendingFiles]);

  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);

  useEffect(() => {
    return () => {
      revokePendingFilePreviews(pendingFilesRef.current);
    };
  }, []);

  return {
    pendingFiles,
    isUploading,
    error,
    addFiles,
    removeFile,
    uploadAll,
    clear,
    hasPending: pendingFiles.length > 0,
  };
}
