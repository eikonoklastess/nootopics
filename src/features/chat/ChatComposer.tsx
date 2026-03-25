import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useFileUpload, type PendingFile } from '../../hooks/useFileUpload';
import type { ServerEmoji, ServerMember } from './types';
import { getFilteredMembers } from './utils';

interface ChatComposerProps {
  content: string;
  errorMessage?: string | null;
  fileUpload: ReturnType<typeof useFileUpload>;
  isUploading: boolean;
  onContentChange: (value: string) => void;
  onOpenThreadCreator: () => void;
  onSend: (event: React.FormEvent) => void;
  onTyping: () => void;
  placeholder?: string;
  serverEmojis: ServerEmoji[];
  serverMembers: ServerMember[];
}

const LazyEmojiPicker = lazy(async () => {
  const module = await import('./EmojiPicker');
  return { default: module.EmojiPicker };
});

function FilePreviewStrip({
  pendingFiles,
  onRemoveFile,
}: {
  pendingFiles: PendingFile[];
  onRemoveFile: (index: number) => void;
}) {
  if (pendingFiles.length === 0) {
    return null;
  }

  return (
    <div className="px-4 pt-3 pb-1 flex gap-3 overflow-x-auto hide-scrollbar border-b border-zinc-300/50 dark:border-zinc-600/50">
      {pendingFiles.map((pendingFile, index) => (
        <div key={`${pendingFile.file.name}-${index}`} className="relative group/file shrink-0">
          {pendingFile.preview ? (
            <img
              src={pendingFile.preview}
              alt={pendingFile.file.name}
              className="w-16 h-16 object-cover rounded-lg border border-zinc-300 dark:border-zinc-600"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white/50 dark:bg-[#2B2D31] flex flex-col items-center justify-center px-1">
              <svg
                className="w-5 h-5 text-indigo-500"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
              <p className="text-[8px] text-zinc-500 truncate w-full text-center mt-0.5">
                {pendingFile.file.name}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemoveFile(index)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-xs font-bold opacity-0 group-hover/file:opacity-100 transition shadow-sm"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export function ChatComposer({
  content,
  errorMessage,
  fileUpload,
  isUploading,
  onContentChange,
  onOpenThreadCreator,
  onSend,
  onTyping,
  placeholder,
  serverEmojis,
  serverMembers,
}: ChatComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showEmojiAutocomplete, setShowEmojiAutocomplete] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState('');
  const [emojiIndex, setEmojiIndex] = useState(0);
  const [emojiData, setEmojiData] = useState<EmojiMartData['emojis'] | null>(null);

  const filteredMembers = getFilteredMembers(serverMembers, mentionQuery);

  type CustomEmojiOption = {
    format: 'gif' | 'png';
    id: string;
    isCustom: true;
    name: string;
    storageId: string;
    url?: string | null;
  };
  type StandardEmojiOption = {
    id: string;
    isCustom: false;
    name: string;
    native: string;
  };
  type EmojiOption = CustomEmojiOption | StandardEmojiOption;
  type EmojiMartData = {
    emojis?: Record<string, { id: string; keywords?: string[]; skins: { native: string }[] }>;
  };

  useEffect(() => {
    if ((!showEmojiPicker && !showEmojiAutocomplete) || emojiData) {
      return;
    }

    void import('@emoji-mart/data').then((module) => {
      const payload = (module.default ?? module) as EmojiMartData;
      setEmojiData(payload.emojis ?? {});
    });
  }, [emojiData, showEmojiAutocomplete, showEmojiPicker]);

  const queryLower = emojiQuery.toLowerCase();
  const customMatches: CustomEmojiOption[] = serverEmojis
    .filter((emoji) => emoji.name.toLowerCase().includes(queryLower))
    .map((emoji) => ({
      id: String(emoji._id),
      name: emoji.name,
      isCustom: true,
      storageId: String(emoji.storageId),
      format: emoji.format,
      url: emoji.url,
    }));

  const standardEmojis = Object.values(emojiData ?? {});
  const standardMatches = standardEmojis
    .filter(
      (emoji) =>
        emoji.id.includes(queryLower) ||
        emoji.keywords?.some((keyword) => keyword.includes(queryLower)),
    )
    .slice(0, 10)
    .map(
      (emoji): StandardEmojiOption => ({
        id: emoji.id,
        name: emoji.id,
        isCustom: false,
        native: emoji.skins[0]?.native ?? '',
      }),
    )
    .filter((emoji) => emoji.native);

  const filteredEmojis: EmojiOption[] = [...customMatches, ...standardMatches].slice(0, 8);

  const insertMention = (name: string) => {
    const atIndex = content.lastIndexOf('@');
    onContentChange(`${content.slice(0, atIndex)}@${name} `);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const insertEmojiAutocomplete = (emoji: EmojiOption) => {
    const colonIndex = content.lastIndexOf(':');
    if (emoji.isCustom) {
      const prefix = emoji.format === 'gif' ? '<a' : '<';
      onContentChange(`${content.slice(0, colonIndex)}${prefix}:${emoji.name}:${emoji.storageId}> `);
    } else {
      onContentChange(`${content.slice(0, colonIndex)}${emoji.native} `);
    }
    setShowEmojiAutocomplete(false);
    inputRef.current?.focus();
  };

  const resizeTextarea = () => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files: File[] = [];
    for (const item of Array.from(event.clipboardData.items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      fileUpload.addFiles(files);
    }
  };

  return (
    <div className="px-4 md:px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shrink-0 mt-auto bg-white dark:bg-[#313338] sticky bottom-0 relative">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) {
            fileUpload.addFiles(event.target.files);
          }
          event.target.value = '';
        }}
      />

      <form
        onSubmit={onSend}
        className="bg-[#EBEDEF] dark:bg-[#383A40] rounded-2xl text-sm shadow-inner border border-zinc-200 dark:border-zinc-700/50 overflow-hidden"
      >
        {errorMessage && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
            {errorMessage}
          </div>
        )}
        <FilePreviewStrip
          pendingFiles={fileUpload.pendingFiles}
          onRemoveFile={fileUpload.removeFile}
        />

        <div className="flex items-center px-4 py-3 relative">
          <button
            type="button"
            onClick={() => setShowPlusMenu((value) => !value)}
            className="p-2 hover:bg-zinc-300 dark:bg-zinc-600/20 dark:hover:bg-zinc-600 rounded-full mr-3 cursor-pointer transition text-zinc-500 dark:text-zinc-400"
            aria-label="Attach file or create thread"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <textarea
            ref={inputRef}
            rows={1}
            className="flex-1 bg-transparent border-none outline-none text-base md:text-sm text-zinc-800 dark:text-zinc-200 font-medium placeholder-zinc-500 dark:placeholder-zinc-400 resize-none max-h-[200px] leading-normal"
            placeholder={isUploading ? 'Uploading...' : placeholder ?? 'Message this channel'}
            value={content}
            disabled={isUploading}
            onPaste={handlePaste}
            onKeyDown={(event) => {
              if (showMentions && filteredMembers.length > 0) {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setMentionIndex((index) => (index + 1) % filteredMembers.length);
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setMentionIndex((index) => (index - 1 + filteredMembers.length) % filteredMembers.length);
                }
                if (event.key === 'Tab' || event.key === 'Enter') {
                  event.preventDefault();
                  const member = filteredMembers[mentionIndex];
                  if (member) insertMention(member.name);
                }
                if (event.key === 'Escape') {
                  setShowMentions(false);
                }
                return;
              }

              if (showEmojiAutocomplete && filteredEmojis.length > 0) {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setEmojiIndex((index) => (index + 1) % filteredEmojis.length);
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setEmojiIndex((index) => (index - 1 + filteredEmojis.length) % filteredEmojis.length);
                }
                if (event.key === 'Tab' || event.key === 'Enter') {
                  event.preventDefault();
                  const emoji = filteredEmojis[emojiIndex];
                  if (emoji) insertEmojiAutocomplete(emoji);
                }
                if (event.key === 'Escape') {
                  setShowEmojiAutocomplete(false);
                }
                return;
              }

              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                onSend(event as unknown as React.FormEvent);
              }
            }}
            onChange={(event) => {
              const nextValue = event.target.value;
              onContentChange(nextValue);
              onTyping();
              resizeTextarea();

              const atIndex = nextValue.lastIndexOf('@');
              let isMention = false;
              if (atIndex !== -1 && (atIndex === 0 || nextValue[atIndex - 1] === ' ' || nextValue[atIndex - 1] === '\n')) {
                const query = nextValue.slice(atIndex + 1);
                if (!query.includes(' ') && !query.includes('\n') && query.length < 30) {
                  setMentionQuery(query);
                  setMentionIndex(0);
                  setShowMentions(true);
                  isMention = true;
                }
              }
              if (!isMention) setShowMentions(false);

              const colonIndex = nextValue.lastIndexOf(':');
              let isEmoji = false;
              if (colonIndex !== -1 && (colonIndex === 0 || nextValue[colonIndex - 1] === ' ' || nextValue[colonIndex - 1] === '\n')) {
                const query = nextValue.slice(colonIndex + 1);
                if (!query.includes(' ') && !query.includes('\n') && query.length > 0 && query.length < 30) {
                  setEmojiQuery(query);
                  setEmojiIndex(0);
                  setShowEmojiAutocomplete(true);
                  isEmoji = true;
                }
              }
              if (!isEmoji) setShowEmojiAutocomplete(false);
            }}
          />

          <button
            type="button"
            onClick={() => setShowEmojiPicker((v) => !v)}
            className="p-1 ml-2 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded-lg cursor-pointer transition text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 dark:text-zinc-400"
            aria-label="Emoji picker"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm3.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75z" />
            </svg>
          </button>

          {isUploading && (
             <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin ml-2" />
          )}
        </div>
      </form>

      {showPlusMenu && (
        <div className="absolute bottom-full left-0 mb-1 ml-6 w-48 bg-white dark:bg-[#2B2D31] rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 py-1 z-50">
          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-indigo-500/10 transition text-left"
            onClick={() => {
              fileInputRef.current?.click();
              setShowPlusMenu(false);
            }}
          >
            <svg
              className="w-5 h-5 text-indigo-500"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
              />
            </svg>
            <span className="font-semibold">Upload a File</span>
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-indigo-500/10 transition text-left"
            onClick={() => {
              setShowPlusMenu(false);
              onOpenThreadCreator();
            }}
          >
            <svg
              className="w-5 h-5 text-indigo-500"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
              />
            </svg>
            <span className="font-semibold">Create Thread</span>
          </button>
        </div>
      )}

      {showEmojiPicker && (
        <div className="absolute bottom-full right-0 mb-2 mr-6 z-50">
          <Suspense
            fallback={
              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 shadow-xl dark:border-zinc-700 dark:bg-[#2B2D31] dark:text-zinc-400">
                Loading emojis...
              </div>
            }
          >
            <LazyEmojiPicker
              onSelect={(emoji) => {
                onContentChange(content + emoji);
                setShowEmojiPicker(false);
                inputRef.current?.focus();
              }}
              serverEmojis={serverEmojis}
            />
          </Suspense>
        </div>
      )}

      {showMentions && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 ml-16 w-64 bg-white dark:bg-[#2B2D31] rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 py-1 z-50 max-h-52 overflow-y-auto">
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-500 dark:text-zinc-400">
            Members
          </div>
          {filteredMembers.map((member, index) => (
            <button
              key={member._id}
              type="button"
              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-indigo-500/10 transition text-sm ${
                index === mentionIndex
                  ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                  : 'text-zinc-700 dark:text-zinc-300'
              }`}
              onMouseEnter={() => setMentionIndex(index)}
              onClick={() => insertMention(member.name)}
            >
              <img
                src={member.imageUrl}
                className="w-6 h-6 rounded-full object-cover"
                alt=""
              />
              <span className="font-semibold">{member.name}</span>
            </button>
          ))}
        </div>
      )}

      {showEmojiAutocomplete && filteredEmojis.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 ml-16 w-64 bg-white dark:bg-[#2B2D31] rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 py-1 z-50 max-h-52 overflow-y-auto">
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-500 dark:text-zinc-400">
            Matching Emojis
          </div>
          {filteredEmojis.map((emoji, index) => (
            <button
              key={emoji.id}
              type="button"
              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-indigo-500/10 transition text-sm ${
                index === emojiIndex
                  ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                  : 'text-zinc-700 dark:text-zinc-300'
              }`}
              onMouseEnter={() => setEmojiIndex(index)}
              onClick={() => insertEmojiAutocomplete(emoji)}
            >
              {emoji.isCustom ? (
                <img
                  src={emoji.url ?? undefined}
                  className="w-6 h-6 rounded-[2px] object-contain"
                  alt=""
                />
              ) : (
                <span className="w-6 h-6 flex items-center justify-center text-xl">{emoji.native}</span>
              )}
              <span className="font-semibold">:{emoji.name}:</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
