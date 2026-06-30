import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";

marked.setOptions({ gfm: true, breaks: true });

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
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    });
  }, [content]);

  return (
    <div
      className={cn("prose prose-sm dark:prose-invert max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
