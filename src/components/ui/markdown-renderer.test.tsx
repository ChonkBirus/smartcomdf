import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { MarkdownRenderer } from "./markdown-renderer";

function html(content: string) {
  const { container } = render(<MarkdownRenderer content={content} />);
  return container.innerHTML;
}

describe("debug", () => {
  it("marked output", () => {
    const m = marked.parse('Hi<script>alert(1)</script>', { async: false }) as string;
    console.log("MARKED:", JSON.stringify(m));
    const s = DOMPurify.sanitize(m);
    console.log("SAN:", JSON.stringify(s));
    const r = html('Hi<script>alert(1)</script>');
    console.log("RENDER:", JSON.stringify(r));
    expect(s).not.toContain("script");
  });
});
