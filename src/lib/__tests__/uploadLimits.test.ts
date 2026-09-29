import { describe, expect, it } from "vitest";
import {
  MAX_DOCUMENT_UPLOAD_BYTES,
  MAX_DOCUMENT_UPLOAD_MB,
  documentUploadTooLargeMessage,
  isDocumentUploadTooLarge,
} from "../uploadLimits";

describe("uploadLimits", () => {
  it("defines 50 MB as document upload limit", () => {
    expect(MAX_DOCUMENT_UPLOAD_MB).toBe(50);
    expect(MAX_DOCUMENT_UPLOAD_BYTES).toBe(50 * 1024 * 1024);
  });

  it("detects oversize files", () => {
    expect(isDocumentUploadTooLarge(MAX_DOCUMENT_UPLOAD_BYTES)).toBe(false);
    expect(isDocumentUploadTooLarge(MAX_DOCUMENT_UPLOAD_BYTES + 1)).toBe(true);
  });

  it("returns Italian error message", () => {
    expect(documentUploadTooLargeMessage()).toContain("50 MB");
  });
});
