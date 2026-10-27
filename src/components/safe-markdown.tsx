"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
export function SafeMarkdown({ children }: { children: string }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        disallowedElements={[
          "img",
          "iframe",
          "object",
          "embed",
          "script",
          "style",
        ]}
        urlTransform={(url) =>
          /^https?:\/\//i.test(url) ||
          (url.startsWith("/") && !url.startsWith("//")) ||
          url.startsWith("#")
            ? url
            : ""
        }
        components={{
          a: ({ href, children }) => (
            <a
              href={href || undefined}
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
