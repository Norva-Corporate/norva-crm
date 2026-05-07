"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MentionRenderer } from "@/components/discussion/mention-renderer";
import { parseMentionHref } from "@/lib/discussion/mention-format";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        "text-sm leading-relaxed text-foreground break-words",
        // markdown styling — minimal, opt-in via direct selectors
        "[&_p]:my-0 [&_p+p]:mt-2",
        "[&_strong]:font-semibold [&_em]:italic",
        "[&_code]:px-1 [&_code]:py-0.5 [&_code]:bg-[var(--muted)] [&_code]:text-[0.9em] [&_code]:rounded-sm",
        "[&_pre]:my-2 [&_pre]:p-3 [&_pre]:bg-[var(--muted)] [&_pre]:rounded-sm [&_pre]:overflow-x-auto",
        "[&_pre_code]:p-0 [&_pre_code]:bg-transparent",
        "[&_ul]:my-1 [&_ul]:pl-5 [&_ul]:list-disc",
        "[&_ol]:my-1 [&_ol]:pl-5 [&_ol]:list-decimal",
        "[&_li]:my-0.5",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-[var(--border)] [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:my-2",
        "[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-accent-hover",
        "[&_h1]:text-base [&_h1]:font-semibold [&_h1]:my-2",
        "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:my-2",
        "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:my-1",
        "[&_table]:my-2 [&_table]:border-collapse [&_th]:border [&_th]:border-[var(--border)] [&_th]:px-2 [&_th]:py-1",
        "[&_td]:border [&_td]:border-[var(--border)] [&_td]:px-2 [&_td]:py-1",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children, ...props }) {
            const mention = href ? parseMentionHref(href) : null;
            if (mention) {
              const label =
                typeof children === "string"
                  ? children
                  : Array.isArray(children)
                    ? children.join("")
                    : String(children);
              return (
                <MentionRenderer
                  type={mention.type}
                  id={mention.id}
                  label={label}
                />
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
