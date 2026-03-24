import { useEffect, useRef } from 'react';
import { StatusIndicator } from '../../components/StatusIndicator';
import type { ChatMessage, ServerMember } from './types';
import {
  isUserMentioned,
  renderMessageText,
  shouldShowUnreadDivider,
} from './utils';

interface MessageFeedProps {
  cancelEditing: () => void;
  currentUserClerkId: string | undefined;
  editContent: string;
  editingId: ChatMessage['_id'] | null;
  formatSize: (bytes: number) => string;
  lastReadSnapshot: number | null;
  messages: ChatMessage[];
  onDelete: (messageId: ChatMessage['_id']) => void;
  onEditContentChange: (value: string) => void;
  onOpenThread: (message: ChatMessage) => void;
  onPin?: (messageId: ChatMessage['_id']) => void;
  onUnpin?: (messageId: ChatMessage['_id']) => void;
  onStartEditing: (message: ChatMessage) => void;
  onSubmitEdit: (event: React.FormEvent) => void;
  customEmojiUrls: Record<string, string | null | undefined>;
  serverMembers: ServerMember[];
  targetMessageId: ChatMessage['_id'] | null;
}

export function MessageFeed({
  cancelEditing,
  currentUserClerkId,
  editContent,
  editingId,
  formatSize,
  lastReadSnapshot,
  messages,
  onDelete,
  onEditContentChange,
  onOpenThread,
  onPin,
  onUnpin,
  onStartEditing,
  onSubmitEdit,
  customEmojiUrls,
  serverMembers,
  targetMessageId,
}: MessageFeedProps) {
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!targetMessageId) {
      return;
    }

    const targetElement = messageRefs.current[targetMessageId];
    if (!targetElement) {
      return;
    }

    requestAnimationFrame(() => {
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  }, [messages, targetMessageId]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col-reverse gap-y-6">
      {messages.map((message, index) => {
        const isOwn = currentUserClerkId === message.user?.clerkId;
        const isEditing = editingId === message._id;
        const isTarget = targetMessageId === message._id;
        const isMentioned =
          !message.deleted &&
          isUserMentioned(message.content, currentUserClerkId, serverMembers);

        return (
          <div
            key={message._id}
            ref={(element) => {
              messageRefs.current[message._id] = element;
            }}
          >
            {shouldShowUnreadDivider(messages, index, lastReadSnapshot) && (
              <div className="flex items-center gap-2 my-4">
                <div className="flex-1 h-px bg-rose-500/70" />
                <span className="text-[11px] font-bold uppercase text-rose-500 shrink-0">
                  New Messages
                </span>
                <div className="flex-1 h-px bg-rose-500/70" />
              </div>
            )}

            <div
              className={`group relative flex items-start gap-3 mt-4 rounded-lg px-4 py-2 transition-colors ${
                isMentioned
                  ? 'bg-amber-500/10 dark:bg-amber-500/10 border-l-2 border-amber-500'
                  : 'hover:bg-black/5 dark:hover:bg-black/10'
              } ${
                isTarget
                  ? 'bg-indigo-500/10 ring-1 ring-indigo-400/70 dark:bg-indigo-500/15'
                  : ''
              }`}
            >
              <div className="shrink-0 pt-0.5 relative cursor-pointer">
                <img
                  src={message.user?.imageUrl}
                  className="w-10 h-10 rounded-full bg-indigo-500 hover:opacity-80 transition object-cover"
                  alt="Avatar"
                />
                <StatusIndicator status={message.user?.status} />
              </div>

              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-x-3 mb-1">
                  <span className="font-bold text-[15px] hover:underline cursor-pointer text-zinc-800 dark:text-zinc-100 tracking-wide">
                    {message.user?.name || 'Unknown'}
                  </span>
                  <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                    {new Date(message._creationTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {isEditing ? (
                  <form onSubmit={onSubmitEdit} className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={editContent}
                      onChange={(event) => onEditContentChange(event.target.value)}
                      className="flex-1 bg-[#EBEDEF] dark:bg-[#383A40] rounded-lg px-3 py-1.5 text-[15px] text-zinc-800 dark:text-zinc-200 outline-none border border-indigo-500"
                    />
                    <button
                      type="submit"
                      className="text-xs text-emerald-500 hover:text-emerald-400 font-semibold"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="text-xs text-zinc-400 hover:text-zinc-300 font-semibold"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    {message.pinned && !message.deleted && (
                      <div className="flex items-center gap-1.5 mb-1 text-emerald-500 font-semibold text-xs">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        <span>Pinned</span>
                      </div>
                    )}
                    <p className="text-[15px] text-zinc-700 dark:text-zinc-300 leading-relaxed break-words">
                      {message.deleted
                        ? 'Message deleted'
                        : renderMessageText(
                            message.content,
                            serverMembers,
                            customEmojiUrls,
                            !!message.isEdited,
                          )}
                    </p>

                    {!message.deleted && message.files && message.files.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {message.files.map((file, fileIndex) => {
                          if (file.type.startsWith('image/')) {
                            return (
                              <a
                                key={fileIndex}
                                href={file.url ?? undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <img
                                  src={file.url ?? undefined}
                                  alt={file.name}
                                  className="max-w-xs max-h-64 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition cursor-pointer"
                                />
                              </a>
                            );
                          }

                          if (file.type.startsWith('video/')) {
                            return (
                              <video
                                key={fileIndex}
                                src={file.url ?? undefined}
                                controls
                                className="max-w-sm max-h-64 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm"
                              />
                            );
                          }

                          if (file.type.startsWith('audio/')) {
                            return (
                              <audio
                                key={fileIndex}
                                src={file.url ?? undefined}
                                controls
                                className="max-w-sm"
                              />
                            );
                          }

                          return (
                            <a
                              key={fileIndex}
                              href={file.url ?? undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 bg-[#EBEDEF] dark:bg-[#2B2D31] rounded-lg px-4 py-3 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition max-w-xs border border-zinc-200 dark:border-zinc-700"
                            >
                              <svg
                                className="w-8 h-8 text-indigo-500 shrink-0"
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
                              <div className="overflow-hidden">
                                <p className="text-sm font-semibold text-indigo-500 truncate">
                                  {file.name}
                                </p>
                                <p className="text-[11px] text-zinc-400">
                                  {formatSize(file.size)}
                                </p>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {message.replyCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenThread(message)}
                    className="flex items-center gap-1.5 mt-1.5 text-xs text-indigo-500 hover:text-indigo-400 font-semibold hover:underline transition"
                  >
                    <svg
                      className="w-3.5 h-3.5"
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
                    {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
                  </button>
                )}
              </div>

              {!isEditing && !message.deleted && (
                <div className="absolute -top-3 right-4 hidden group-hover:flex items-center gap-0.5 bg-white dark:bg-[#2B2D31] border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg p-0.5">
                  <button
                    onClick={() => onOpenThread(message)}
                    className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    title="Reply in Thread"
                  >
                    <svg
                      className="w-4 h-4"
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
                  </button>
                  
                  {!message.pinned && onPin && (
                    <button
                      onClick={() => onPin(message._id)}
                      className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400"
                      title="Pin Message"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                    </button>
                  )}
                  {message.pinned && onUnpin && (
                    <button
                      onClick={() => onUnpin(message._id)}
                      className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400"
                      title="Unpin Message"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" clipRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00-.098-.056zm-.08-.057c.231.144.53.144.761 0 1.257-.783 2.502-1.748 3.52-2.88C18.423 16.444 20 13.513 20 10.5a8 8 0 10-16 0c0 3.013 1.577 5.944 4.259 8.914 1.018 1.132 2.263 2.097 3.52 2.88zM15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  )}

                  {isOwn && (
                    <>
                      <button
                        onClick={() => onStartEditing(message)}
                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                        title="Edit"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDelete(message._id)}
                        className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded transition text-zinc-500 hover:text-rose-500"
                        title="Delete"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
