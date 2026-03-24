import type { ReactNode } from 'react';
import type { ChatMessage, ServerMember } from './types';

import emojiRegex from 'emoji-regex';

export interface TokenMatch {
  start: number;
  end: number;
  type: 'mention' | 'emoji' | 'custom_emoji' | 'animated_emoji';
  content: string;
  data?: any;
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

export function renderMessageText(
  text: string,
  members: Pick<ServerMember, 'name'>[],
  isEdited?: boolean,
) {
  const tokens = findAllTokens(text, members);
  if (tokens.length === 0) {
    return isEdited ? <><span className="break-words">{text}</span>{editedLabel()}</> : <span className="break-words">{text}</span>;
  }

  const onlyEmojis = tokens.every(t => t.type !== 'mention') && 
                     text.replace(/\\s/g, '').length === tokens.reduce((acc, t) => acc + t.content.length, 0);

  const emojiSizeClass = onlyEmojis && tokens.length <= 5 ? "w-12 h-12" : "w-[22px] h-[22px]";
  const convexSiteUrl = import.meta.env.VITE_CONVEX_URL.replace('.convex.cloud', '.convex.site');

  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const token of tokens) {
    if (token.start > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`} className="break-words align-middle">{text.slice(lastIndex, token.start)}</span>);
    }

    if (token.type === 'mention') {
      parts.push(
        <span
          key={`mention-${token.start}`}
          className="bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold rounded px-1 py-0.5 text-[14px] align-middle"
        >
          @{token.data.name}
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
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            if (e.target && (e.target as any).nextSibling) {
               (e.target as any).nextSibling.style.display = 'inline';
            }
          }}
        />
      );
      parts.push(<span key={`emoji-fallback-${token.start}`} style={{display: 'none'}}>{token.content}</span>);
    } else if (token.type === 'custom_emoji' || token.type === 'animated_emoji') {
      const url = `${convexSiteUrl}/getEmoji?storageId=${token.data.id}`;
      parts.push(
        <img
          key={`custom-${token.start}`}
          src={url}
          alt={`:${token.data.name}:`}
          draggable={false}
          className={`${emojiSizeClass} inline-block align-middle mx-[1px] object-contain rounded-[2px]`}
        />
      );
    }

    lastIndex = token.end;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`} className="break-words align-middle">{text.slice(lastIndex)}</span>);
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
