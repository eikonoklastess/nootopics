import type { ReactNode } from 'react';
import type {
  MessageSearchResult,
  ParsedSearchQuery,
  SearchHasFilter,
} from './types';
import { buildSearchSnippet } from './search';

interface ChatSearchBoxProps {
  hasAnchoredContext: boolean;
  isLoading: boolean;
  onChange: (value: string) => void;
  onClearContext: () => void;
  onSelect: (result: MessageSearchResult) => void;
  parsedQuery: ParsedSearchQuery;
  query: string;
  results: MessageSearchResult[];
}

const hasFilterLabels: Record<SearchHasFilter, string> = {
  audio: 'Audio',
  file: 'File',
  image: 'Image',
  reply: 'Reply',
  thread: 'Thread',
  video: 'Video',
};

export function ChatSearchBox({
  hasAnchoredContext,
  isLoading,
  onChange,
  onClearContext,
  onSelect,
  parsedQuery,
  query,
  results,
}: ChatSearchBoxProps) {
  const showPanel = query.trim().length > 0;
  const chips = getFilterChips(parsedQuery);

  return (
    <div className="relative flex items-center gap-2 min-w-0">
      {hasAnchoredContext && (
        <button
          type="button"
          onClick={onClearContext}
          className="shrink-0 rounded-md border border-amber-300/70 bg-amber-100/80 px-2.5 py-1 text-[11px] font-semibold text-amber-900 transition hover:bg-amber-200 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
        >
          Return to latest
        </button>
      )}

      <div className="relative w-full max-w-xl">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-100/80 px-3 py-1.5 shadow-sm transition focus-within:border-indigo-400 focus-within:bg-white dark:border-zinc-700 dark:bg-[#232428] dark:focus-within:border-indigo-500">
          <svg
            className="h-4 w-4 shrink-0 text-zinc-500"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0Z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(event) => onChange(event.target.value)}
            className="w-full bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-500 dark:text-zinc-100"
            placeholder='Search messages, e.g. release from:"Alice" in:general has:file'
          />
        </div>

        {showPanel && (
          <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-[#1E1F22]">
            <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    Indexed Search
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Free text plus `from:`, `in:`, `has:`, `before:`, `after:`
                  </p>
                </div>
                {parsedQuery.searchText && (
                  <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300">
                    {parsedQuery.terms.length} term
                    {parsedQuery.terms.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              {chips.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {chips.map((chip) => (
                    <span
                      key={chip.label}
                      className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="max-h-[28rem] overflow-y-auto">
              {isLoading ? (
                <StateRow>Searching…</StateRow>
              ) : results.length === 0 ? (
                <StateRow>No matching messages.</StateRow>
              ) : (
                results.map((result) => (
                  <button
                    key={result._id}
                    type="button"
                    onClick={() => onSelect(result)}
                    className="flex w-full flex-col gap-2 border-b border-zinc-200 px-4 py-3 text-left transition hover:bg-zinc-50 last:border-b-0 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {result.user?.name ?? 'Unknown'}{' '}
                          <span className="font-medium text-zinc-500 dark:text-zinc-400">
                            in #{result.channelName}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                          {new Date(result._creationTime).toLocaleString([], {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 text-[10px] font-bold uppercase tracking-wide">
                        {result.isThreadReply && (
                          <span className="rounded-full bg-sky-500/10 px-2 py-1 text-sky-600 dark:text-sky-300">
                            Thread reply
                          </span>
                        )}
                        {result.hasFiles && (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-600 dark:text-emerald-300">
                            Attachments
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {renderHighlightedSnippet(
                        buildSearchSnippet(result.content, parsedQuery.terms),
                        parsedQuery.terms,
                      )}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StateRow({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
      {children}
    </div>
  );
}

function renderHighlightedSnippet(text: string, terms: string[]) {
  const normalizedTerms = [...new Set(terms.map((term) => term.toLowerCase()))].filter(
    Boolean,
  );

  if (normalizedTerms.length === 0) {
    return text || 'Message deleted';
  }

  const pattern = new RegExp(
    `(${normalizedTerms
      .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')})`,
    'gi',
  );
  const segments = text.split(pattern);

  return segments.map((segment, index) => {
    const isMatch = normalizedTerms.includes(segment.toLowerCase());
    if (!isMatch) {
      return <span key={`${segment}-${index}`}>{segment}</span>;
    }

    return (
      <mark
        key={`${segment}-${index}`}
        className="rounded bg-amber-200/80 px-0.5 text-inherit dark:bg-amber-400/30"
      >
        {segment}
      </mark>
    );
  });
}

function getFilterChips(parsedQuery: ParsedSearchQuery) {
  const chips: { label: string }[] = [];

  if (parsedQuery.filters.authorName) {
    chips.push({ label: `from:${parsedQuery.filters.authorName}` });
  }
  if (parsedQuery.filters.channelName) {
    chips.push({ label: `in:#${parsedQuery.filters.channelName}` });
  }
  if (parsedQuery.filters.has) {
    chips.push({ label: `has:${hasFilterLabels[parsedQuery.filters.has]}` });
  }
  if (parsedQuery.filters.afterLabel) {
    chips.push({ label: `after:${parsedQuery.filters.afterLabel}` });
  }
  if (parsedQuery.filters.beforeLabel) {
    chips.push({ label: `before:${parsedQuery.filters.beforeLabel}` });
  }

  return chips;
}
