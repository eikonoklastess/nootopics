import { useMutation, useQuery } from 'convex/react';
import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import type { Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { NavigationSidebar } from '../../components/NavigationSidebar';
import { ServerSidebar } from '../../components/ServerSidebar';
import { useFileUpload } from '../../hooks/useFileUpload';
import { usePresence } from '../../hooks/usePresence';
import { useAppStore } from '../../store/useAppStore';
import { ChatComposer } from './ChatComposer';
import { ChatSearchBox } from './ChatSearchBox';
import { MessageFeed } from './MessageFeed';
import { parseSearchQuery } from './search';
import { PinnedMessagesPanel } from './PinnedMessagesPanel';
import { ThreadCreatorPanel } from './ThreadCreatorPanel';
import { ThreadPanel } from './ThreadPanel';
import { findAllTokens } from './utils';
import { NotificationsPanel, type NotificationItem } from './NotificationsPanel';
import { useDesktopNotifications } from './useDesktopNotifications';
import type {
  ChatMessage,
  MessageSearchResult,
  ServerMember,
  ThreadReply,
} from './types';
import { useChannelReadTracking } from './useChannelReadTracking';

type ConversationTarget =
  | { channelId: Id<'channels'>; directConversationId?: never }
  | { channelId?: never; directConversationId: Id<'directConversations'> }
  | null;

function PresenceSync() {
  usePresence(5 * 60 * 1000);
  return null;
}

export function ChatPage() {
  const {
    activeSpace,
    activeChannelId,
    activeServerId,
    activeDirectConversationId,
    clearMessageContext,
    messageContext,
    setActiveChannelId,
    setActiveDirectConversationId,
    setMessageContext,
  } = useAppStore();
  const { user: clerkUser } = useUser();
  const [content, setContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [editingId, setEditingId] = useState<Id<'messages'> | null>(null);
  const [editContent, setEditContent] = useState('');
  const [activeThread, setActiveThread] = useState<ChatMessage | null>(null);
  const [threadContent, setThreadContent] = useState('');
  const [showThreadCreator, setShowThreadCreator] = useState(false);
  const [threadName, setThreadName] = useState('');
  const [threadFirstMessage, setThreadFirstMessage] = useState('');
  const [pendingThreadParentId, setPendingThreadParentId] =
    useState<Id<'messages'> | null>(null);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [flashMessageId, setFlashMessageId] = useState<Id<'messages'> | null>(null);
  const [flashReplyId, setFlashReplyId] = useState<Id<'messages'> | null>(null);
  const [pendingReplyJumpId, setPendingReplyJumpId] = useState<Id<'messages'> | null>(
    null,
  );
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const liveParsedSearch = parseSearchQuery(searchQuery);
  const debouncedParsedSearch = parseSearchQuery(debouncedSearchQuery);
  const fileUpload = useFileUpload();
  const dragCounter = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeConversationTarget = getActiveConversationTarget({
    activeSpace,
    activeChannelId,
    activeDirectConversationId,
  });
  const activeConversationKey = activeConversationTarget
    ? 'channelId' in activeConversationTarget
      ? `channel:${activeConversationTarget.channelId}`
      : `direct:${activeConversationTarget.directConversationId}`
    : null;
  const hasAnchoredMessageContext =
    !!messageContext &&
    doesMessageContextMatchConversation(messageContext, activeConversationTarget);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchQuery(deferredSearchQuery);
    }, 220);

    return () => clearTimeout(timeout);
  }, [deferredSearchQuery]);

  const anchoredMessages =
    (useQuery(
      api.messages.listAround,
      activeConversationTarget && hasAnchoredMessageContext && messageContext
        ? {
            ...activeConversationTarget,
            messageId: messageContext.anchorMessageId,
          }
        : 'skip',
    ) as ChatMessage[] | undefined) ?? undefined;
  const latestMessages =
    (useQuery(
      api.messages.list,
      activeConversationTarget && !hasAnchoredMessageContext
        ? activeConversationTarget
        : 'skip',
    ) as ChatMessage[] | undefined) ?? undefined;
  const messages = anchoredMessages ?? latestMessages ?? [];

  const channels =
    useQuery(
      api.channels.list,
      activeSpace === 'server' && activeServerId ? { serverId: activeServerId } : 'skip',
    ) ?? [];
  const activeChannel = channels.find((channel) => channel._id === activeChannelId);
  const directConversation =
    (useQuery(
      api.directMessages.get,
      activeSpace === 'direct' && activeDirectConversationId
        ? { directConversationId: activeDirectConversationId }
        : 'skip',
    ) as
      | {
          _id: Id<'directConversations'>;
          otherUser: ServerMember | null;
        }
      | undefined) ?? undefined;

  const sendMessage = useMutation(api.messages.send);
  const editMessage = useMutation(api.messages.edit);
  const removeMessage = useMutation(api.messages.remove);
  const pinMessage = useMutation(api.messages.pin);
  const unpinMessage = useMutation(api.messages.unpin);
  const typingHeartbeat = useMutation(api.typing.heartbeat);
  const typingStop = useMutation(api.typing.stop);
  const typers =
    useQuery(
      api.typing.list,
      activeConversationTarget ? activeConversationTarget : 'skip',
    ) ?? [];
  const markAsRead = useMutation(api.readPositions.markAsRead);
  const lastReadTime = useQuery(
    api.readPositions.getLastReadTime,
    activeConversationTarget ? activeConversationTarget : 'skip',
  );
  const serverMembers =
    (useQuery(
      api.users.listByServer,
      activeSpace === 'server' && activeServerId ? { serverId: activeServerId } : 'skip',
    ) as ServerMember[] | undefined) ?? [];
  const directMembers =
    (useQuery(
      api.directMessages.listMembers,
      activeSpace === 'direct' && activeDirectConversationId
        ? { directConversationId: activeDirectConversationId }
        : 'skip',
    ) as ServerMember[] | undefined) ?? [];
  const conversationMembers =
    activeSpace === 'direct' ? directMembers : serverMembers;
  const threadReplies =
    (useQuery(
      api.threads.listReplies,
      activeThread ? { threadId: activeThread._id } : 'skip',
    ) as ThreadReply[] | undefined) ?? [];
  const shouldRunSearch =
    activeSpace === 'server' &&
    !!activeServerId &&
    (debouncedParsedSearch.searchText.length > 0 || debouncedParsedSearch.hasFilters);
  const rawSearchResults = useQuery(
    api.search.searchMessages,
    shouldRunSearch && activeServerId
      ? {
          serverId: activeServerId,
          searchText: debouncedParsedSearch.searchText,
          authorName: debouncedParsedSearch.filters.authorName,
          channelName: debouncedParsedSearch.filters.channelName,
          has: debouncedParsedSearch.filters.has,
          before: debouncedParsedSearch.filters.before,
          after: debouncedParsedSearch.filters.after,
          limit: 20,
        }
      : 'skip',
  ) as MessageSearchResult[] | undefined;
  const searchResults = rawSearchResults ?? [];
  const threadReply = useMutation(api.threads.reply);
  const notifications =
    (useQuery(api.notifications.list) as NotificationItem[] | undefined) ?? [];
  const markNotificationRead = useMutation(api.notifications.markRead);
  const unreadNotifications = notifications.filter((notification) => !notification.read);

  useDesktopNotifications(notifications);

  const lastReadSnapshot = useChannelReadTracking({
    activeConversationKey,
    activeConversationTarget,
    lastReadTime,
    markAsRead,
    messageCount: messages.length,
  });

  const isSearchLoading =
    activeSpace === 'server' &&
    !!activeServerId &&
    (searchQuery.trim() !== debouncedSearchQuery.trim() ||
      (shouldRunSearch && rawSearchResults === undefined));

  useEffect(() => {
    if (!pendingThreadParentId) {
      return;
    }

    const createdThread = messages.find(
      (message) => message._id === pendingThreadParentId,
    );
    if (createdThread) {
      setActiveThread(createdThread);
      setPendingThreadParentId(null);
    }
  }, [messages, pendingThreadParentId]);

  useEffect(() => {
    setActiveThread(null);
    setThreadContent('');
    setPendingReplyJumpId(null);
    setFlashReplyId(null);
    setShowPinnedMessages(false);
  }, [activeConversationKey]);

  useEffect(() => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setPendingReplyJumpId(null);
    setFlashMessageId(null);
    setFlashReplyId(null);
  }, [activeSpace, activeServerId]);

  useEffect(() => {
    if (
      !messageContext ||
      !doesMessageContextMatchConversation(messageContext, activeConversationTarget)
    ) {
      return;
    }

    const anchorMessage = messages.find(
      (message) => message._id === messageContext.anchorMessageId,
    );
    if (!anchorMessage) {
      return;
    }

    setFlashMessageId(messageContext.highlightMessageId);
    if (pendingReplyJumpId) {
      setActiveThread(anchorMessage);
      setShowThreadCreator(false);
    }
  }, [activeConversationTarget, messageContext, messages, pendingReplyJumpId]);

  useEffect(() => {
    if (!pendingReplyJumpId) {
      return;
    }

    const replyMatch = threadReplies.find((reply) => reply._id === pendingReplyJumpId);
    if (!replyMatch) {
      return;
    }

    setFlashReplyId(pendingReplyJumpId);
    setPendingReplyJumpId(null);
  }, [pendingReplyJumpId, threadReplies]);

  useEffect(() => {
    if (!flashMessageId) {
      return;
    }

    const timeout = setTimeout(() => {
      setFlashMessageId(null);
    }, 2600);

    return () => clearTimeout(timeout);
  }, [flashMessageId]);

  useEffect(() => {
    if (!flashReplyId) {
      return;
    }

    const timeout = setTimeout(() => {
      setFlashReplyId(null);
    }, 2600);

    return () => clearTimeout(timeout);
  }, [flashReplyId]);

  const handleTyping = useCallback(() => {
    if (!activeConversationTarget) {
      return;
    }

    void typingHeartbeat(activeConversationTarget).catch(() => {});
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
    }
    typingTimer.current = setTimeout(() => {
      void typingStop(activeConversationTarget).catch(() => {});
    }, 2500);
  }, [activeConversationTarget, typingHeartbeat, typingStop]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if ((!content.trim() && !fileUpload.hasPending) || !activeConversationTarget) {
      return;
    }

    const uploadedFiles = await fileUpload.uploadAll();
    const mentionIds =
      findAllTokens(content.trim(), conversationMembers)
        .filter((token) => token.type === 'mention')
        .map((token) => {
          const matchedMember = conversationMembers.find(
            (member) => member.name.toLowerCase() === token.data?.name?.toLowerCase(),
          );
          return matchedMember?._id;
        })
        .filter((id): id is Id<'users'> => !!id) ?? [];

    await sendMessage({
      ...activeConversationTarget,
      content: content.trim(),
      mentions: mentionIds.length > 0 ? mentionIds : undefined,
      files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
    });
    clearMessageContext();
    setContent('');
    void markAsRead(activeConversationTarget).catch(() => {});
    void typingStop(activeConversationTarget).catch(() => {});
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
    }
  };

  const handleThreadReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeThread || !activeConversationTarget || !threadContent.trim()) {
      return;
    }

    await threadReply({
      ...activeConversationTarget,
      threadId: activeThread._id,
      content: threadContent.trim(),
    });
    setThreadContent('');
  };

  const handleCreateThread = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeConversationTarget || !threadName.trim() || !threadFirstMessage.trim()) {
      return;
    }

    const parentId = await sendMessage({
      ...activeConversationTarget,
      content: `🧵 **${threadName.trim()}**\n${threadFirstMessage.trim()}`,
    });
    setPendingThreadParentId(parentId);
    setShowThreadCreator(false);
    setThreadName('');
    setThreadFirstMessage('');
  };

  const handleEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingId || !editContent.trim()) {
      return;
    }

    await editMessage({
      messageId: editingId,
      content: editContent,
    });
    setEditingId(null);
    setEditContent('');
  };

  const handleDelete = async (messageId: Id<'messages'>) => {
    await removeMessage({ messageId });
  };

  const handleSearchSelect = (result: MessageSearchResult) => {
    const anchorMessageId = result.anchorMessageId;

    setPendingReplyJumpId(result.threadReplyMessageId);
    setFlashMessageId(anchorMessageId);
    setFlashReplyId(result.threadReplyMessageId);
    setActiveThread(null);
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setMessageContext({
      anchorMessageId,
      channelId: result.channelId,
      highlightMessageId: anchorMessageId,
      threadReplyMessageId: result.threadReplyMessageId,
    });
    setActiveChannelId(result.channelId, { preserveMessageContext: true });
  };

  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current += 1;
    if (event.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    if (event.dataTransfer.files.length > 0) {
      fileUpload.addFiles(event.dataTransfer.files);
    }
  };

  const closeThreadPanels = () => {
    setActiveThread(null);
    setThreadContent('');
    setShowThreadCreator(false);
    setShowPinnedMessages(false);
    setThreadName('');
    setThreadFirstMessage('');
  };

  const activeConversationLabel =
    activeSpace === 'direct'
      ? directConversation?.otherUser?.name ?? 'Direct message'
      : activeChannel?.name ?? 'channel';

  const emptyStateLabel =
    activeSpace === 'direct'
      ? 'Select a direct message to start chatting'
      : 'Select a channel to start chatting';

  const handleNotificationSelect = async (notification: NotificationItem) => {
    await markNotificationRead({ notificationId: notification._id });
    setShowNotifications(false);
    setFlashMessageId(notification.messageId);
    setPendingReplyJumpId(null);
    setFlashReplyId(null);

    if (notification.channelId) {
      setMessageContext({
        anchorMessageId: notification.messageId,
        channelId: notification.channelId,
        highlightMessageId: notification.messageId,
        threadReplyMessageId: null,
      });
      setActiveChannelId(notification.channelId, { preserveMessageContext: true });
      return;
    }

    if (notification.directConversationId) {
      setActiveDirectConversationId(notification.directConversationId, {
        preserveMessageContext: true,
      });
      setMessageContext({
        anchorMessageId: notification.messageId,
        directConversationId: notification.directConversationId,
        highlightMessageId: notification.messageId,
        threadReplyMessageId: null,
      });
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden antialiased text-black dark:text-white bg-white dark:bg-[#313338]">
      <PresenceSync />

      <div className="hidden md:flex h-full w-[72px] z-30 flex-col fixed inset-y-0">
        <NavigationSidebar />
      </div>

      <div className="hidden md:flex h-full w-60 z-20 flex-col fixed inset-y-0 md:left-[72px]">
        <ServerSidebar />
      </div>

      <main
        className="h-full w-full md:pl-[312px] bg-white dark:bg-[#313338] flex flex-col relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-indigo-500/10 border-2 border-dashed border-indigo-500 rounded-xl flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto text-indigo-500 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                Drop files to upload
              </p>
            </div>
          </div>
        )}

        {!activeConversationTarget ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            <h2>{emptyStateLabel}</h2>
          </div>
        ) : (
          <>
            <header className="h-12 border-b border-neutral-200 dark:border-neutral-800 flex items-center px-4 font-semibold shrink-0 shadow-sm z-10 bg-white dark:bg-[#313338]">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-zinc-500">
                  {activeSpace === 'direct' ? '@' : '#'}
                </span>
                <span className="truncate">{activeConversationLabel}</span>
              </div>

              <button
                className="relative ml-3 rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                onClick={() => setShowNotifications((prev) => !prev)}
                title="Notifications"
                type="button"
              >
                <span role="img" aria-label="notifications">
                  🔔
                </span>
                {unreadNotifications.length > 0 && (
                  <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
                )}
              </button>

              {activeSpace === 'server' && (
                <div className="ml-auto w-full max-w-xl pl-4 flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowPinnedMessages((prev) => !prev);
                      setActiveThread(null);
                      setShowThreadCreator(false);
                    }}
                    className={`p-2 shrink-0 rounded-full transition ${showPinnedMessages ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                    title="Pinned Messages"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </button>
                  <div className="flex-1 w-full min-w-0">
                    <ChatSearchBox
                      hasAnchoredContext={hasAnchoredMessageContext}
                      isLoading={isSearchLoading}
                      onChange={setSearchQuery}
                      onClearContext={() => {
                        clearMessageContext();
                        setPendingReplyJumpId(null);
                        setFlashMessageId(null);
                        setFlashReplyId(null);
                      }}
                      onSelect={handleSearchSelect}
                      parsedQuery={liveParsedSearch}
                      query={searchQuery}
                      results={searchResults}
                    />
                  </div>
                </div>
              )}
            </header>

            <MessageFeed
              cancelEditing={() => {
                setEditingId(null);
                setEditContent('');
              }}
              currentUserClerkId={clerkUser?.id}
              editContent={editContent}
              editingId={editingId}
              formatSize={formatSize}
              lastReadSnapshot={lastReadSnapshot}
              messages={messages}
              onDelete={handleDelete}
              onPin={(messageId) => pinMessage({ messageId })}
              onUnpin={(messageId) => unpinMessage({ messageId })}
              onEditContentChange={setEditContent}
              onOpenThread={(message) => {
                setPendingReplyJumpId(null);
                setFlashReplyId(null);
                setActiveThread(message);
                setShowThreadCreator(false);
              }}
              onStartEditing={(message) => {
                setEditingId(message._id);
                setEditContent(message.content);
              }}
              onSubmitEdit={handleEdit}
              serverMembers={conversationMembers}
              targetMessageId={flashMessageId}
            />

            {typers.length > 0 && (
              <div className="px-6 py-1 shrink-0 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 animate-pulse">
                <div className="flex items-center gap-1">
                  <span className="inline-flex gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
                <span className="font-semibold">
                  {typers.map((typer: { name: string }) => typer.name).join(', ')}
                </span>
                <span>{typers.length === 1 ? 'is' : 'are'} typing...</span>
              </div>
            )}

            {showNotifications && (
              <NotificationsPanel
                notifications={notifications}
                onClose={() => setShowNotifications(false)}
                onSelect={(notification) => {
                  void handleNotificationSelect(notification);
                }}
              />
            )}

            <ChatComposer
              content={content}
              fileUpload={fileUpload}
              isUploading={fileUpload.isUploading}
              onContentChange={setContent}
              onOpenThreadCreator={() => {
                setActiveThread(null);
                setShowThreadCreator(true);
              }}
              onSend={handleSend}
              onTyping={handleTyping}
              placeholder={
                activeSpace === 'direct' ? 'Message this conversation' : 'Message this channel'
              }
              serverMembers={conversationMembers}
            />

            {activeThread && (
              <ThreadPanel
                activeThread={activeThread}
                onClose={() => {
                  setPendingReplyJumpId(null);
                  setFlashReplyId(null);
                  setActiveThread(null);
                  setThreadContent('');
                }}
                onReplyChange={setThreadContent}
                onReplySubmit={handleThreadReply}
                replies={threadReplies}
                replyValue={threadContent}
                targetReplyId={flashReplyId}
              />
            )}

            {showPinnedMessages && (
              <PinnedMessagesPanel
                activeChannelId={activeConversationTarget?.channelId}
                activeDirectConversationId={activeConversationTarget?.directConversationId}
                onClose={() => setShowPinnedMessages(false)}
                onJumpToMessage={(messageId) => {
                  setMessageContext({
                    anchorMessageId: messageId,
                    channelId: activeConversationTarget?.channelId,
                    directConversationId: activeConversationTarget?.directConversationId,
                    highlightMessageId: messageId,
                    threadReplyMessageId: null,
                  });
                  setFlashMessageId(messageId);
                  setShowPinnedMessages(false);
                }}
                onUnpin={(messageId) => unpinMessage({ messageId })}
                serverMembers={conversationMembers}
              />
            )}

            <ThreadCreatorPanel
              firstMessage={threadFirstMessage}
              isOpen={showThreadCreator}
              name={threadName}
              onClose={closeThreadPanels}
              onFirstMessageChange={setThreadFirstMessage}
              onNameChange={setThreadName}
              onSubmit={handleCreateThread}
            />
          </>
        )}
      </main>
    </div>
  );
}

function doesMessageContextMatchConversation(
  messageContext: {
    channelId?: Id<'channels'>;
    directConversationId?: Id<'directConversations'>;
  },
  activeConversationTarget: ConversationTarget,
) {
  if (!activeConversationTarget) {
    return false;
  }

  if ('channelId' in activeConversationTarget) {
    return messageContext.channelId === activeConversationTarget.channelId;
  }

  return (
    messageContext.directConversationId ===
    activeConversationTarget.directConversationId
  );
}

function getActiveConversationTarget(args: {
  activeSpace: 'server' | 'direct' | null;
  activeChannelId: Id<'channels'> | null;
  activeDirectConversationId: Id<'directConversations'> | null;
}): ConversationTarget {
  if (args.activeSpace === 'server' && args.activeChannelId) {
    return { channelId: args.activeChannelId };
  }
  if (args.activeSpace === 'direct' && args.activeDirectConversationId) {
    return { directConversationId: args.activeDirectConversationId };
  }
  return null;
}

function formatSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
