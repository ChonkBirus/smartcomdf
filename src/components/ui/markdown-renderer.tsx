import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";

marked.setOptions({ gfm: true, breaks: true });

const UNSAFE_URI = /^\s*(javascript|data|vbscript):/i;
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.nodeType !== 1) return;
  const el = node as Element;
  for (const attr of ["href", "src", "xlink:href"]) {
    const v = el.getAttribute(attr);
    if (v && UNSAFE_URI.test(v)) el.removeAttribute(attr);
  }
});

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const html = useMemo(() => {
    const raw = marked.parse(content || "", { async: false }) as string;
    return DOMPurify.sanitize(raw, {
      FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "svg", "math"],
      FORBID_ATTR: ["style", "onerror", "onload", "onclick", "onmouseover", "onfocus"],
    });
  }, [content]);

  return (
    <div
      className={cn("prose prose-sm dark:prose-invert max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
