import { describe, expect, it, vi } from "vitest";
import {
  removePendingFileAtIndex,
  revokePendingFilePreviews,
} from "./fileUploadUtils";
import type { PendingFile } from "./useFileUpload";

const pendingFiles: PendingFile[] = [
  {
    file: new File(["one"], "one.png", { type: "image/png" }),
    preview: "blob:one",
  },
  {
    file: new File(["two"], "two.txt", { type: "text/plain" }),
    preview: "",
  },
  {
    file: new File(["three"], "three.png", { type: "image/png" }),
    preview: "blob:three",
  },
];

describe("file upload cleanup", () => {
  it("revokes every preview URL during bulk cleanup", () => {
    const revoke = vi.fn();

    revokePendingFilePreviews(pendingFiles, revoke);

    expect(revoke).toHaveBeenCalledTimes(2);
    expect(revoke).toHaveBeenCalledWith("blob:one");
    expect(revoke).toHaveBeenCalledWith("blob:three");
  });

  it("revokes only the removed preview URL when removing one pending file", () => {
    const revoke = vi.fn();

    const nextFiles = removePendingFileAtIndex(pendingFiles, 0, revoke);

    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:one");
    expect(nextFiles).toHaveLength(2);
    expect(nextFiles[0]?.file.name).toBe("two.txt");
  });
});
