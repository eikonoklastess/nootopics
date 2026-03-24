import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import type { ChatMessage, ServerMember } from './types';
import { renderMessageText } from './utils';

interface PinnedMessagesPanelProps {
  activeChannelId?: Id<'channels'> | null;
  activeDirectConversationId?: Id<'directConversations'> | null;
  onClose: () => void;
  onJumpToMessage: (messageId: Id<'messages'>) => void;
  onUnpin: (messageId: Id<'messages'>) => void;
  serverMembers: ServerMember[];
}

export function PinnedMessagesPanel({
  activeChannelId,
  activeDirectConversationId,
  onClose,
  onJumpToMessage,
  onUnpin,
  serverMembers,
}: PinnedMessagesPanelProps) {
  const target = activeChannelId
    ? { channelId: activeChannelId }
    : activeDirectConversationId
    ? { directConversationId: activeDirectConversationId }
    : null;

  const pinnedMessages = useQuery(
    api.messages.listPinned,
    target ? target : 'skip'
  ) as ChatMessage[] | undefined;

  return (
    <div className="absolute top-0 right-0 bottom-0 w-96 bg-white dark:bg-[#2B2D31] border-l border-zinc-200 dark:border-zinc-700 flex flex-col z-40 shadow-2xl">
      <div className="h-12 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          <span className="font-bold text-sm">Pinned Messages</span>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition text-zinc-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto w-full flex flex-col pt-2 pb-6">
        {!pinnedMessages ? (
          <div className="p-6 text-center text-zinc-500 text-sm">Loading...</div>
        ) : pinnedMessages.length === 0 ? (
          <div className="p-6 text-center text-zinc-500 text-sm mt-8">
            <div className="flex justify-center mb-4">
              <svg className="w-16 h-16 text-zinc-300 dark:text-zinc-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            Hmm, there are no pinned messages here yet.
          </div>
        ) : (
          <div className="flex flex-col gap-1 w-full p-2">
            {pinnedMessages.map((msg) => (
              <div key={msg._id} className="group flex flex-col gap-2 rounded-lg bg-zinc-50 dark:bg-[#313338] hover:bg-zinc-100 dark:hover:bg-[#383A40] transition p-3 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={msg.user?.imageUrl} className="w-7 h-7 rounded-full object-cover shrink-0" alt="" />
                    <span className="font-bold text-[13px] truncate">{msg.user?.name}</span>
                    <span className="text-[10px] text-zinc-400 shrink-0">
                      {new Date(msg._creationTime).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {/* Actions inside header row on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onJumpToMessage(msg._id);
                      }}
                      className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded text-zinc-500 dark:text-zinc-400 transition"
                      title="Jump to message"
                    >
                      <span className="text-xs font-semibold px-1">Jump</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnpin(msg._id);
                      }}
                      className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded text-zinc-500 dark:text-zinc-400 hover:text-rose-500 transition"
                      title="Unpin"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="pl-9 pr-2">
                  <p className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed break-words break-all">
                    {msg.deleted ? 'Message deleted' : renderMessageText(msg.content, serverMembers, !!msg.isEdited)}
                  </p>
                  
                  {!msg.deleted && msg.files && msg.files.length > 0 && (
                     <div className="flex flex-wrap gap-2 mt-2">
                       {msg.files.map((file, idx) => {
                         if (file.type.startsWith('image/')) {
                           return (
                             <img
                               key={idx}
                               src={file.url ?? undefined}
                               alt={file.name}
                               className="max-h-32 rounded border border-zinc-200 dark:border-zinc-700 object-contain"
                             />
                           );
                         }
                         return (
                           <div key={idx} className="text-xs text-indigo-500 underline truncate max-w-full">
                             {file.name}
                           </div>
                         );
                       })}
                     </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
