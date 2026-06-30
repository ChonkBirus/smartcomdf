import { useMemo } from "react";
import { marked } from "marked";
import { cn } from "@/lib/utils";

marked.setOptions({ gfm: true, breaks: true });

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const html = useMemo(
    () => marked.parse(content || "", { async: false }) as string,
    [content],
  );

  return (
    <div
      className={cn("prose prose-sm dark:prose-invert max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
