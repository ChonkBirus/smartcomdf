import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MarkdownRenderer } from "./markdown-renderer";

function html(content: string) {
  const { container } = render(<MarkdownRenderer content={content} />);
  return container.innerHTML;
}

describe("MarkdownRenderer XSS sanitization", () => {
  it("renders basic markdown", () => {
    const out = html("**bold** and _italic_");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>italic</em>");
  });

  it("strips <script> tags", () => {
    const out = html('Hi<script>alert("xss")</script>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(");
  });

  it("strips inline event handlers", () => {
    const out = html('<img src=x onerror="alert(1)">');
    expect(out).not.toMatch(/onerror/i);
  });

  it("removes javascript: URLs in links", () => {
    const out = html('[click](javascript:alert(1))');
    expect(out).not.toMatch(/href\s*=\s*"javascript:/i);
  });

  it("strips <iframe>", () => {
    const out = html('<iframe src="https://evil.example"></iframe>');
    expect(out).not.toContain("<iframe");
  });

  it("strips inline style attributes", () => {
    const out = html('<p style="background:url(javascript:alert(1))">x</p>');
    expect(out).not.toMatch(/style=/i);
  });

  it("escapes raw HTML inside code blocks", () => {
    const out = html("```\n<script>alert(1)</script>\n```");
    expect(out).not.toContain("<script>alert");
    expect(out).toContain("&lt;script&gt;");
  });

  it("handles partial streaming chunks without throwing", () => {
    expect(() => html("Partial **bo")).not.toThrow();
    expect(() => html("<scr")).not.toThrow();
    expect(() => html("")).not.toThrow();
  });

  it("blocks svg onload payloads", () => {
    const out = html('<svg/onload=alert(1)>');
    expect(out).not.toMatch(/onload/i);
  });
});
