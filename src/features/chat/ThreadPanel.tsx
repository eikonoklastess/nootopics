import { useEffect, useRef } from 'react';
import type { ChatMessage, ServerMember, ThreadReply } from './types';
import { renderMessageText } from './utils';

interface ThreadPanelProps {
  activeThread: ChatMessage;
  customEmojiUrls: Record<string, string | null | undefined>;
  onClose: () => void;
  onReplyChange: (value: string) => void;
  onReplySubmit: (event: React.FormEvent) => void;
  replies: ThreadReply[];
  replyValue: string;
  serverMembers: ServerMember[];
  targetReplyId?: ThreadReply['_id'] | null;
}

export function ThreadPanel({
  activeThread,
  customEmojiUrls,
  onClose,
  onReplyChange,
  onReplySubmit,
  replies,
  replyValue,
  serverMembers,
  targetReplyId = null,
}: ThreadPanelProps) {
  const replyRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!targetReplyId) {
      return;
    }

    const targetElement = replyRefs.current[targetReplyId];
    if (!targetElement) {
      return;
    }

    requestAnimationFrame(() => {
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  }, [replies, targetReplyId]);

  return (
    <div className="absolute inset-0 md:left-auto md:right-0 md:top-0 md:bottom-0 w-full md:w-96 bg-white dark:bg-[#2B2D31] border-l border-zinc-200 dark:border-zinc-700 flex flex-col z-40 shadow-2xl">
      <div className="h-12 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
          <span className="font-bold text-sm">Thread</span>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition text-zinc-500" aria-label="Close thread">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-[#232428]">
        <div className="flex items-start gap-3">
          <img src={activeThread.user?.imageUrl} className="w-8 h-8 rounded-full object-cover" alt="" />
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-bold text-sm">{activeThread.user?.name}</span>
              <span className="text-[10px] text-zinc-400">
                {new Date(activeThread._creationTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {activeThread.deleted
                ? 'Message deleted'
                : renderMessageText(
                    activeThread.content,
                    serverMembers,
                    customEmojiUrls,
                    !!activeThread.isEdited,
                  )}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {replies.length > 0 ? (
          replies.map((reply) => (
            <div
              key={reply._id}
              ref={(element) => {
                replyRefs.current[reply._id] = element;
              }}
              className={`flex items-start gap-3 rounded-lg px-2 py-1.5 ${
                targetReplyId === reply._id
                  ? 'bg-indigo-500/10 ring-1 ring-indigo-400/70 dark:bg-indigo-500/15'
                  : ''
              }`}
            >
              <img src={reply.user?.imageUrl} className="w-7 h-7 rounded-full object-cover shrink-0" alt="" />
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold text-[13px]">{reply.user?.name}</span>
                  <span className="text-[10px] text-zinc-400">
                    {new Date(reply._creationTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-[13px] text-zinc-700 dark:text-zinc-300">
                  {reply.deleted
                    ? 'Message deleted'
                    : renderMessageText(
                        reply.content,
                        serverMembers,
                        customEmojiUrls,
                        !!reply.isEdited,
                      )}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-400 text-center mt-8">
            No replies yet. Start the conversation!
          </p>
        )}
      </div>

      <div className="px-3 py-3 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
        <form onSubmit={onReplySubmit} className="flex items-center gap-2 bg-[#EBEDEF] dark:bg-[#383A40] rounded-xl px-3 py-2">
          <input
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-500"
            placeholder="Reply..."
            value={replyValue}
            onChange={(event) => onReplyChange(event.target.value)}
          />
          <button type="submit" className="p-1.5 text-indigo-500 hover:text-indigo-400 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
