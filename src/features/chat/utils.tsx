import React, { type ReactNode } from 'react';
import type { ChatMessage, ServerMember } from './types';

import emojiRegex from 'emoji-regex';

type TokenData = {
  id?: string;
  name: string;
};

export interface TokenMatch {
  start: number;
  end: number;
  type: 'mention' | 'emoji' | 'custom_emoji' | 'animated_emoji';
  content: string;
  data?: TokenData;
}

export function findMentionMatches(
  text: string,
  members: Pick<ServerMember, 'name'>[],
): TokenMatch[] {
  const matches: TokenMatch[] = [];

  const sortedMembers = [...members].sort(
    (left, right) => right.name.length - left.name.length,
  );

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '@') {
      continue;
    }

    const rest = text.slice(index + 1);
    const matchingMember = sortedMembers.find((member) => {
      if (!rest.toLowerCase().startsWith(member.name.toLowerCase())) {
        return false;
      }

      const nextCharacter = rest[member.name.length];
      return nextCharacter === undefined || /\s/.test(nextCharacter);
    });

    if (matchingMember) {
      matches.push({
        start: index,
        end: index + matchingMember.name.length + 1,
        type: 'mention',
        content: text.slice(index, index + matchingMember.name.length + 1),
        data: { name: matchingMember.name },
      });
      index += matchingMember.name.length;
    }
  }

  return matches;
}

export function findAllTokens(
  text: string,
  members: Pick<ServerMember, 'name'>[],
): TokenMatch[] {
  const tokens: TokenMatch[] = [];

  // Find mentions
  tokens.push(...findMentionMatches(text, members));

  // Find Custom Emojis
  const customRegex = /<:([a-zA-Z0-9_]+):([a-zA-Z0-9_-]+)>/g;
  let match;
  while ((match = customRegex.exec(text)) !== null) {
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'custom_emoji',
      content: match[0],
      data: { name: match[1], id: match[2] },
    });
  }

  // Find Animated Emojis
  const animRegex = /<a:([a-zA-Z0-9_]+):([a-zA-Z0-9_-]+)>/g;
  while ((match = animRegex.exec(text)) !== null) {
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'animated_emoji',
      content: match[0],
      data: { name: match[1], id: match[2] },
    });
  }

  // Find Standard Emojis
  const er = emojiRegex();
  while ((match = er.exec(text)) !== null) {
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'emoji',
      content: match[0],
    });
  }

  // Sort and deduplicate overlaps
  tokens.sort((a, b) => a.start - b.start);

  const validTokens: TokenMatch[] = [];
  let lastEnd = 0;
  for (const t of tokens) {
    if (t.start >= lastEnd) {
      validTokens.push(t);
      lastEnd = t.end;
    }
  }

  return validTokens;
}

function twemojiCodePoint(codePointStr: string) {
  return Array.from(codePointStr)
    .map(c => c.codePointAt(0)?.toString(16))
    .filter(c => c !== 'fe0f')
    .join('-');
}

type MarkdownChunk = string | ReactNode;

function trimUrlTrailingPunctuation(url: string): string {
  return url.replace(/[.,;:!?)]+$/u, '');
}

function splitByRegex(
  s: string,
  regex: RegExp,
  render: (match: RegExpExecArray, key: string) => ReactNode,
  nextKey: () => string,
  mapPlain?: (slice: string) => MarkdownChunk[],
): MarkdownChunk[] {
  const out: MarkdownChunk[] = [];
  let last = 0;
  const r = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = r.exec(s)) !== null) {
    if (m.index > last) {
      const slice = s.slice(last, m.index);
      if (mapPlain) {
        if (slice.length > 0) {
          out.push(...mapPlain(slice));
        }
      } else if (slice.length > 0) {
        out.push(slice);
      }
    }
    out.push(render(m, nextKey()));
    last = m.index + m[0].length;
  }
  if (last < s.length) {
    const slice = s.slice(last);
    if (mapPlain) {
      if (slice.length > 0) {
        out.push(...mapPlain(slice));
      }
    } else if (slice.length > 0) {
      out.push(slice);
    }
  }
  return out;
}

function markdownChunksToNode(chunks: MarkdownChunk[]): React.ReactNode {
  if (chunks.length === 0) {
    return null;
  }
  if (chunks.length === 1) {
    return chunks[0];
  }
  return <>{chunks}</>;
}

function parseMarkdownLinks(s: string, nextKey: () => string): MarkdownChunk[] {
  return splitByRegex(
    s,
    /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g,
    (match, key) => {
      const href = trimUrlTrailingPunctuation(match[1]);
      return (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-500 hover:underline"
        >
          {href}
        </a>
      );
    },
    nextKey,
  );
}

function parseMarkdownAfterStrike(s: string, nextKey: () => string): MarkdownChunk[] {
  return splitByRegex(
    s,
    /~~([^~]+)~~/g,
    (match, key) => (
      <span key={key} className="line-through">
        {markdownChunksToNode(parseMarkdownLinks(match[1], nextKey))}
      </span>
    ),
    nextKey,
    (plain) => parseMarkdownLinks(plain, nextKey),
  );
}

function parseMarkdownAfterItalic(s: string, nextKey: () => string): MarkdownChunk[] {
  return splitByRegex(
    s,
    /\*([^*]+)\*|_([^_\n]+)_/g,
    (match, key) => {
      const inner = match[1] ?? match[2];
      return (
        <em key={key} className="italic">
          {markdownChunksToNode(parseMarkdownAfterStrike(inner, nextKey))}
        </em>
      );
    },
    nextKey,
    (plain) => parseMarkdownAfterStrike(plain, nextKey),
  );
}

function parseMarkdownAfterBold(s: string, nextKey: () => string): MarkdownChunk[] {
  return splitByRegex(
    s,
    /\*\*([^*]+)\*\*|__([^_]+)__/g,
    (match, key) => {
      const inner = match[1] ?? match[2];
      return (
        <strong key={key} className="font-bold">
          {markdownChunksToNode(parseMarkdownAfterItalic(inner, nextKey))}
        </strong>
      );
    },
    nextKey,
    (plain) => parseMarkdownAfterItalic(plain, nextKey),
  );
}

function parseMarkdownAfterInlineCode(s: string, nextKey: () => string): MarkdownChunk[] {
  return splitByRegex(
    s,
    /`([^`\n]+)`/g,
    (match, key) => (
      <code
        key={key}
        className="rounded bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 text-sm font-mono text-rose-500 dark:text-rose-400"
      >
        {match[1]}
      </code>
    ),
    nextKey,
    (plain) => parseMarkdownAfterBold(plain, nextKey),
  );
}

function parseMarkdownAfterCodeBlock(s: string, nextKey: () => string): MarkdownChunk[] {
  return splitByRegex(
    s,
    /```([\s\S]*?)```/g,
    (match, key) => (
      <pre
        key={key}
        className="rounded-lg bg-zinc-200 dark:bg-zinc-800 p-3 text-sm font-mono my-1 overflow-x-auto"
      >
        <code>{match[1]}</code>
      </pre>
    ),
    nextKey,
    (plain) => parseMarkdownAfterInlineCode(plain, nextKey),
  );
}

/**
 * Converts markdown in a plain text segment to React elements.
 * Order: code blocks → inline code → bold → italic → strikethrough → links.
 * Inner spans recurse so later rules still apply (e.g. URLs inside bold).
 */
export function renderMarkdown(text: string, keyPrefix = 'md'): React.ReactNode {
  if (text === '') {
    return text;
  }

  let elIndex = 0;
  const nextKey = () => `${keyPrefix}-${elIndex++}`;

  const chunks = parseMarkdownAfterCodeBlock(text, nextKey);
  return markdownChunksToNode(chunks);
}

export function renderMessageText(
  text: string,
  members: Pick<ServerMember, 'name'>[],
  customEmojiUrls: Record<string, string | null | undefined> = {},
  isEdited?: boolean,
) {
  const tokens = findAllTokens(text, members);
  if (tokens.length === 0) {
    return isEdited ? (
      <>
        <span className="break-words">{renderMarkdown(text, 'msg')}</span>
        {editedLabel()}
      </>
    ) : (
      <span className="break-words">{renderMarkdown(text, 'msg')}</span>
    );
  }

  const onlyEmojis = tokens.every(t => t.type !== 'mention') && 
                     text.replace(/\s/g, '').length === tokens.reduce((acc, t) => acc + t.content.length, 0);

  const emojiSizeClass = onlyEmojis && tokens.length <= 5 ? "w-12 h-12" : "w-[22px] h-[22px]";

  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const token of tokens) {
    if (token.start > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`} className="break-words align-middle">
          {renderMarkdown(text.slice(lastIndex, token.start), `text-${lastIndex}`)}
        </span>,
      );
    }

    if (token.type === 'mention') {
      const mentionName = token.data?.name ?? token.content.slice(1);
      parts.push(
        <span
          key={`mention-${token.start}`}
          className="bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold rounded px-1 py-0.5 text-[14px] align-middle"
        >
          @{mentionName}
        </span>
      );
    } else if (token.type === 'emoji') {
      const url = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${twemojiCodePoint(token.content)}.svg`;
      parts.push(
        <img
          key={`emoji-${token.start}`}
          src={url}
          alt={token.content}
          draggable={false}
          className={`${emojiSizeClass} inline-block align-middle mx-[1px]`}
          onError={(event) => {
            event.currentTarget.style.display = 'none';
            const fallback = event.currentTarget.nextElementSibling;
            if (fallback instanceof HTMLElement) {
              fallback.style.display = 'inline';
            }
          }}
        />
      );
      parts.push(<span key={`emoji-fallback-${token.start}`} style={{display: 'none'}}>{token.content}</span>);
    } else if (token.type === 'custom_emoji' || token.type === 'animated_emoji') {
      const url = token.data?.id ? customEmojiUrls[token.data.id] : null;
      if (url) {
        parts.push(
          <img
            key={`custom-${token.start}`}
            src={url}
            alt={`:${token.data?.name ?? 'emoji'}:`}
            draggable={false}
            className={`${emojiSizeClass} inline-block align-middle mx-[1px] object-contain rounded-[2px]`}
          />
        );
      } else {
        parts.push(
          <span
            key={`custom-fallback-${token.start}`}
            className="font-semibold text-zinc-500 dark:text-zinc-400"
          >
            :{token.data?.name ?? 'emoji'}:
          </span>,
        );
      }
    }

    lastIndex = token.end;
  }

  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-${lastIndex}`} className="break-words align-middle">
        {renderMarkdown(text.slice(lastIndex), `text-${lastIndex}`)}
      </span>,
    );
  }
  
  if (isEdited) {
    parts.push(editedLabel());
  }

  return <span className="leading-relaxed whitespace-pre-wrap">{parts}</span>;
}

function editedLabel() {
  return (
    <span
      key="edited"
      className="text-[11px] text-zinc-400 dark:text-zinc-500 ml-1.5"
    >
      (edited)
    </span>
  );
}

export function isUserMentioned(
  text: string,
  currentUserClerkId: string | undefined,
  members: ServerMember[],
) {
  if (!currentUserClerkId) {
    return false;
  }

  const currentUser = members.find(
    (member) => member.clerkId === currentUserClerkId,
  );
  if (!currentUser) {
    return false;
  }

  const safeName = currentUser.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`@${safeName}(?=\\s|$)`, 'i');
  return regex.test(text);
}

export function getFilteredMembers(
  members: ServerMember[],
  query: string,
) {
  return members
    .filter((member) =>
      member.name.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 8);
}

export function shouldShowUnreadDivider(
  messages: ChatMessage[],
  index: number,
  lastReadSnapshot: number | null,
) {
  if (lastReadSnapshot === null || lastReadSnapshot <= 0) {
    return false;
  }

  const message = messages[index];
  if (!message || message._creationTime <= lastReadSnapshot) {
    return false;
  }

  const nextMessage = messages[index + 1];
  return !nextMessage || nextMessage._creationTime <= lastReadSnapshot;
}

export function formatThreadMessage(message: Pick<ChatMessage, 'content' | 'deleted'>) {
  return message.deleted ? 'Message deleted' : message.content;
}
