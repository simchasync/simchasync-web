import { describe, it, expect } from "vitest";
import { friendlyUploadError } from "./uploadErrors";

describe("friendlyUploadError", () => {
  it("maps row-level security errors to a permission message", () => {
    const msg = friendlyUploadError({ message: "new row violates row-level security policy" });
    expect(msg).toContain("permission");
    expect(msg).not.toContain("row-level security");
  });

  it("maps oversize errors (message or 413 status)", () => {
    expect(friendlyUploadError({ message: "The object exceeded the maximum allowed size" })).toContain("too large");
    expect(friendlyUploadError({ message: "boom", statusCode: 413 })).toContain("too large");
  });

  it("maps unsupported file types", () => {
    expect(friendlyUploadError({ message: "mime type text/plain is not supported" })).toContain("file type isn't supported");
  });

  it("maps expired sessions (jwt / 401)", () => {
    expect(friendlyUploadError({ message: "JWT expired" })).toContain("session expired");
    expect(friendlyUploadError({ message: "boom", status: 401 })).toContain("session expired");
  });

  it("maps duplicate names", () => {
    expect(friendlyUploadError({ message: "The resource already exists" })).toContain("already exists");
  });

  it("maps network failures", () => {
    expect(friendlyUploadError({ message: "Failed to fetch" })).toContain("internet connection");
  });

  it("falls back for unknown errors and never leaks the raw message", () => {
    const raw = "some internal stack trace detail xyz";
    const msg = friendlyUploadError({ message: raw });
    expect(msg).toContain("Something went wrong");
    expect(msg).not.toContain(raw);
  });

  it("handles non-object inputs safely", () => {
    expect(friendlyUploadError(undefined)).toContain("Something went wrong");
    expect(friendlyUploadError("row-level security policy")).toContain("permission");
  });
});
