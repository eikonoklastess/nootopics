import type { ParsedSearchQuery, SearchHasFilter } from './types';

const tokenPattern =
  /(?:[a-z]+:"[^"]+"|[a-z]+:'[^']+'|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\S+)/gi;

const hasAliases: Record<string, SearchHasFilter> = {
  attachment: 'file',
  attachments: 'file',
  audio: 'audio',
  file: 'file',
  files: 'file',
  image: 'image',
  images: 'image',
  reply: 'reply',
  replies: 'reply',
  thread: 'thread',
  video: 'video',
  videos: 'video',
};

export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {
      filters: {},
      hasFilters: false,
      raw,
      searchText: '',
      terms: [],
    };
  }

  const textTerms: string[] = [];
  const filters: ParsedSearchQuery['filters'] = {};
  const tokens = trimmed.match(tokenPattern) ?? [];

  for (const token of tokens) {
    const flagMatch = token.match(/^([a-z]+):(.*)$/i);
    if (!flagMatch) {
      textTerms.push(unquote(token));
      continue;
    }

    const [, rawFlag, rawValue] = flagMatch;
    const value = unquote(rawValue).trim();
    if (value.length === 0) {
      textTerms.push(unquote(token));
      continue;
    }

    switch (rawFlag.toLowerCase()) {
      case 'from':
        filters.authorName = value;
        break;
      case 'in':
        filters.channelName = value.replace(/^#/, '');
        break;
      case 'has': {
        const normalizedHas = hasAliases[value.toLowerCase()];
        if (normalizedHas) {
          filters.has = normalizedHas;
        } else {
          textTerms.push(unquote(token));
        }
        break;
      }
      case 'before': {
        const date = parseDateFilter(value, 'before');
        if (date) {
          filters.before = date.value;
          filters.beforeLabel = date.label;
        } else {
          textTerms.push(unquote(token));
        }
        break;
      }
      case 'after': {
        const date = parseDateFilter(value, 'after');
        if (date) {
          filters.after = date.value;
          filters.afterLabel = date.label;
        } else {
          textTerms.push(unquote(token));
        }
        break;
      }
      default:
        textTerms.push(unquote(token));
        break;
    }
  }

  const searchText = textTerms.join(' ').trim();
  return {
    filters,
    hasFilters: Object.keys(filters).length > 0,
    raw,
    searchText,
    terms: searchText
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean),
  };
}

export function buildSearchSnippet(content: string, terms: string[], maxLength = 140) {
  const normalizedTerms = terms
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);

  if (content.length <= maxLength) {
    return content;
  }

  const lowerContent = content.toLowerCase();
  const matchIndex = normalizedTerms.reduce<number>((earliest, term) => {
    const index = lowerContent.indexOf(term);
    if (index === -1) {
      return earliest;
    }
    return earliest === -1 ? index : Math.min(earliest, index);
  }, -1);

  if (matchIndex === -1) {
    return `${content.slice(0, maxLength).trimEnd()}...`;
  }

  const start = Math.max(0, matchIndex - 32);
  const end = Math.min(content.length, start + maxLength);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < content.length ? '...' : '';
  return `${prefix}${content.slice(start, end).trim()}${suffix}`;
}

function parseDateFilter(
  value: string,
  mode: 'before' | 'after',
): { label: string; value: number } | null {
  const exactDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (exactDateMatch) {
    const [, year, month, day] = exactDateMatch;
    const base = new Date(`${year}-${month}-${day}T00:00:00`);
    if (Number.isNaN(base.getTime())) {
      return null;
    }

    if (mode === 'after') {
      return { label: `${year}-${month}-${day}`, value: base.getTime() };
    }

    const nextDay = new Date(base);
    nextDay.setDate(nextDay.getDate() + 1);
    return {
      label: `${year}-${month}-${day}`,
      value: nextDay.getTime() - 1,
    };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    label: value,
    value: parsed.getTime(),
  };
}

function unquote(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
