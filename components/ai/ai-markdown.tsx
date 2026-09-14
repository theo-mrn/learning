"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="relative my-2.5 overflow-hidden rounded-lg border border-border/70 bg-muted/60 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/90 px-3 py-1.5 text-muted-foreground">
        <span className="text-[11px] font-medium uppercase tracking-wider">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-background/80 hover:text-foreground transition-colors"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-500" />
              <span>Copié</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>Copier</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 leading-relaxed text-foreground/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Formate le texte inline avec le gras, l'italique et le code inline */
function formatInline(text: string): React.ReactNode {
  // Regex pour capturer **gras**, *italique*, `code`
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(<em key={match.index}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground/90 font-medium"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

export function AIMarkdown({ content }: { content: string }) {
  // Découpage par blocs de code puis par lignes
  const elements: React.ReactNode[] = [];
  const lines = content.split("\n");
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLanguage = "";
  let listItemsBuffer: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = (keyPrefix: number) => {
    if (listItemsBuffer.length === 0) return;
    if (listType === "ul") {
      elements.push(
        <ul
          key={`ul-${keyPrefix}`}
          className="my-2 ml-4 list-disc space-y-1 text-sm text-foreground/90 leading-relaxed"
        >
          {listItemsBuffer.map((item, i) => (
            <li key={i}>{formatInline(item)}</li>
          ))}
        </ul>
      );
    } else if (listType === "ol") {
      elements.push(
        <ol
          key={`ol-${keyPrefix}`}
          className="my-2 ml-4 list-decimal space-y-1 text-sm text-foreground/90 leading-relaxed"
        >
          {listItemsBuffer.map((item, i) => (
            <li key={i}>{formatInline(item)}</li>
          ))}
        </ol>
      );
    }
    listItemsBuffer = [];
    listType = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Début ou fin d'un bloc de code
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        flushList(i);
        elements.push(
          <CodeBlock
            key={`code-${i}`}
            code={codeBuffer.join("\n")}
            language={codeLanguage}
          />
        );
        inCodeBlock = false;
        codeBuffer = [];
        codeLanguage = "";
      } else {
        flushList(i);
        inCodeBlock = true;
        codeLanguage = line.slice(3).trim();
        codeBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    const trimmed = line.trim();

    // Ligne vide
    if (!trimmed) {
      flushList(i);
      continue;
    }

    // Titres
    if (trimmed.startsWith("### ")) {
      flushList(i);
      elements.push(
        <h4
          key={`h3-${i}`}
          className="mt-3 mb-1 font-heading text-sm font-semibold text-foreground tracking-tight"
        >
          {formatInline(trimmed.slice(4))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushList(i);
      elements.push(
        <h3
          key={`h2-${i}`}
          className="mt-4 mb-1.5 font-heading text-base font-semibold text-foreground tracking-tight"
        >
          {formatInline(trimmed.slice(3))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      flushList(i);
      elements.push(
        <h2
          key={`h1-${i}`}
          className="mt-4 mb-2 font-heading text-lg font-bold text-foreground tracking-tight"
        >
          {formatInline(trimmed.slice(2))}
        </h2>
      );
      continue;
    }

    // Listes à puces (- ou *)
    if (/^[-*]\s+/.test(trimmed)) {
      if (listType !== "ul") flushList(i);
      listType = "ul";
      listItemsBuffer.push(trimmed.replace(/^[-*]\s+/, ""));
      continue;
    }

    // Listes ordonnées (1. 2. etc)
    if (/^\d+\.\s+/.test(trimmed)) {
      if (listType !== "ol") flushList(i);
      listType = "ol";
      listItemsBuffer.push(trimmed.replace(/^\d+\.\s+/, ""));
      continue;
    }

    // Citation (> )
    if (trimmed.startsWith("> ")) {
      flushList(i);
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="my-2 border-l-2 border-primary/60 pl-3 italic text-sm text-muted-foreground"
        >
          {formatInline(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Séparateur (---)
    if (trimmed === "---" || trimmed === "***") {
      flushList(i);
      elements.push(
        <hr key={`hr-${i}`} className="my-3 border-border/60" />
      );
      continue;
    }

    // Paragraphe classique
    flushList(i);
    elements.push(
      <p
        key={`p-${i}`}
        className="my-1.5 text-sm leading-relaxed text-foreground/90 break-words"
      >
        {formatInline(trimmed)}
      </p>
    );
  }

  // Vider les buffers restants
  if (inCodeBlock && codeBuffer.length > 0) {
    elements.push(
      <CodeBlock
        key="code-last"
        code={codeBuffer.join("\n")}
        language={codeLanguage}
      />
    );
  } else {
    flushList(lines.length);
  }

  return <div className="space-y-0.5">{elements}</div>;
}
