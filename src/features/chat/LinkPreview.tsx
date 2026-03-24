interface LinkPreviewProps {
  content: string;
}

const URL_REGEX = /https?:\/\/[^\s<]+/g;

export function LinkPreviews({ content }: LinkPreviewProps) {
  const urls = content.match(URL_REGEX);
  if (!urls || urls.length === 0) return null;

  // Deduplicate
  const uniqueUrls = [...new Set(urls)].slice(0, 3);

  return (
    <div className="flex flex-col gap-2 mt-2">
      {uniqueUrls.map((url) => {
        let hostname = '';
        try {
          hostname = new URL(url).hostname;
        } catch {
          hostname = url;
        }

        return (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-[#2B2D31] px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition max-w-md group"
          >
            <div className="w-1 h-10 rounded-full bg-indigo-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{hostname}</p>
              <p className="text-sm font-semibold text-indigo-500 dark:text-indigo-400 truncate group-hover:underline">{url}</p>
            </div>
            <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        );
      })}
    </div>
  );
}
