import { describe, it, expect } from "vitest";
import DOMPurify from "dompurify";

describe("DOMPurify smoke", () => {
  it("strips script", () => {
    const out = DOMPurify.sanitize('Hi<script>alert(1)</script>');
    console.log("OUT:", out, "supported:", DOMPurify.isSupported);
    expect(out).not.toContain("script");
  });
});
