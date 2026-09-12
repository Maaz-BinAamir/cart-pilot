import { memo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const remarkPlugins = [remarkGfm];
const components: Components = {
  table: ({ children }) => (
    <div className="message-table-scroll" role="region" aria-label="Comparison table" tabIndex={0}>
      <table>{children}</table>
    </div>
  ),
  a: ({ href, children, title }) => (
    <a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a>
  ),
};

export const ChatMarkdown = memo(function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="message-markdown">
      <Markdown remarkPlugins={remarkPlugins} components={components} skipHtml>{text}</Markdown>
    </div>
  );
});
