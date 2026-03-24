import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import type { Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { NavigationSidebar } from '../../components/NavigationSidebar';
import { ServerSidebar } from '../../components/ServerSidebar';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useUrlSync } from '../../hooks/useUrlSync';
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
import { MemberListPanel } from './MemberListPanel';
import { NotificationsPanel, type NotificationItem } from './NotificationsPanel';
import { useDesktopNotifications } from './useDesktopNotifications';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import type {
  ChatMessage,
  MessageSearchResult,
  ServerEmoji,
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
  useUrlSync();
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
  const [showMemberList, setShowMemberList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [flashMessageId, setFlashMessageId] = useState<Id<'messages'> | null>(null);
  const [flashReplyId, setFlashReplyId] = useState<Id<'messages'> | null>(null);
  const [showMobileNavigation, setShowMobileNavigation] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<Id<'messages'> | null>(null);
  const [pendingReplyJumpId, setPendingReplyJumpId] = useState<Id<'messages'> | null>(
    null,
  );
  const [pendingMessages, setPendingMessages] = useState<ChatMessage[]>([]);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const liveParsedSearch = parseSearchQuery(searchQuery);
  const debouncedParsedSearch = parseSearchQuery(debouncedSearchQuery);
  const fileUpload = useFileUpload();
  const dragCounter = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
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
  const {
    results: paginatedMessages,
    status: paginateStatus,
    loadMore,
  } = usePaginatedQuery(
    api.messages.listPaginated,
    activeConversationTarget && !hasAnchoredMessageContext
      ? activeConversationTarget
      : 'skip',
    { initialNumItems: 50 },
  );
  const latestMessages =
    paginatedMessages.length > 0
      ? (paginatedMessages as unknown as ChatMessage[])
      : undefined;
  const messages = anchoredMessages ?? latestMessages ?? [];

  const channels =
    useQuery(
      api.channels.list,
      activeSpace === 'server' && activeServerId ? { serverId: activeServerId } : 'skip',
    ) ?? [];
  const activeChannel = channels.find((channel) => channel._id === activeChannelId);
  const serverEmojis =
    (useQuery(
      api.emojis.list,
      activeSpace === 'server' && activeServerId ? { serverId: activeServerId } : 'skip',
    ) as ServerEmoji[] | undefined) ?? [];
  const customEmojiUrls = Object.fromEntries(
    serverEmojis.map((emoji) => [String(emoji.storageId), emoji.url ?? null] as const),
  );
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
    setShowMemberList(false);
    setPendingMessages([]);
  }, [activeConversationKey]);

  useEffect(() => {
    setShowMobileNavigation(false);
    setShowMobileSidebar(false);
  }, [activeChannelId, activeDirectConversationId, activeServerId, activeSpace]);

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

  useKeyboardShortcuts({
    onEscape: () => {
      closeThreadPanels();
      setShowNotifications(false);
      setShowMemberList(false);
      setShowMobileNavigation(false);
      setShowMobileSidebar(false);
    },
    onSearch: () => {
      if (activeSpace !== 'server') return;
      setSearchQuery('');
      queueMicrotask(() => searchInputRef.current?.focus());
    },
  });

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

    let uploadedFiles;
    try {
      uploadedFiles = await fileUpload.uploadAll();
    } catch {
      return;
    }
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

    const tempId = `pending-${Date.now()}` as Id<'messages'>;
    const tempMessage: ChatMessage = {
      _id: tempId,
      _creationTime: Date.now(),
      content: content.trim(),
      deleted: false,
      isEdited: false,
      replyCount: 0,
      pinned: false,
      user: {
        _id: undefined,
        name: clerkUser?.fullName ?? clerkUser?.firstName ?? 'You',
        imageUrl: clerkUser?.imageUrl ?? '',
        clerkId: clerkUser?.id ?? '',
      },
      files: [],
    };
    setPendingMessages((prev) => [tempMessage, ...prev]);

    try {
      await sendMessage({
        ...activeConversationTarget,
        content: content.trim(),
        mentions: mentionIds.length > 0 ? mentionIds : undefined,
        files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      });
      setPendingMessages((prev) => prev.filter((m) => m._id !== tempId));
      clearMessageContext();
      setContent('');
      void markAsRead(activeConversationTarget).catch(() => {});
      void typingStop(activeConversationTarget).catch(() => {});
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
      }
    } catch {
      setPendingMessages((prev) => prev.filter((m) => m._id !== tempId));
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
    try {
      await removeMessage({ messageId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete message');
    }
    setDeleteTargetId(null);
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

  const allMessages = [...pendingMessages, ...messages];

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

      {showMobileNavigation && (
        <>
          <button
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setShowMobileNavigation(false)}
            type="button"
          />
          <div className="fixed inset-y-0 left-0 z-50 flex w-[72px] md:hidden">
            <NavigationSidebar />
          </div>
        </>
      )}

      {showMobileSidebar && (
        <>
          <button
            aria-label="Close sidebar"
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setShowMobileSidebar(false)}
            type="button"
          />
          <div className="fixed inset-y-0 left-0 z-50 flex w-60 md:hidden">
            <ServerSidebar />
          </div>
        </>
      )}

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
        <div className="flex h-12 items-center justify-between border-b border-neutral-200 px-3 shadow-sm dark:border-neutral-800 md:hidden">
          <button
            className="rounded-md p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            onClick={() => setShowMobileNavigation(true)}
            type="button"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="min-w-0 px-3 text-center text-sm font-semibold">
            <span className="block truncate">
              {activeConversationTarget ? activeConversationLabel : 'Nootopics'}
            </span>
          </div>
          <button
            className="rounded-md p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            onClick={() => setShowMobileSidebar(true)}
            type="button"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5.25h18M3 12h18M3 18.75h18" />
            </svg>
          </button>
        </div>

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
            <header className="min-h-12 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center gap-y-2 px-4 py-2 font-semibold shrink-0 shadow-sm z-10 bg-white dark:bg-[#313338] md:h-12 md:flex-nowrap md:py-0">
              <div className="hidden min-w-0 items-center gap-2 md:flex">
                <span className="text-zinc-500">
                  {activeSpace === 'direct' ? '@' : '#'}
                </span>
                <span className="truncate">{activeConversationLabel}</span>
              </div>

              <button
                className="relative ml-auto rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 md:ml-3"
                onClick={() => setShowNotifications((prev) => !prev)}
                title="Notifications"
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                {unreadNotifications.length > 0 && (
                  <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
                )}
              </button>

              {activeSpace === 'server' && (
                <button
                  type="button"
                  className={`rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${showMemberList ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100' : ''}`}
                  onClick={() => setShowMemberList((prev) => !prev)}
                  title="Member List"
                  aria-label="Toggle member list"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                </button>
              )}

              {activeSpace === 'server' && (
                <div className="w-full md:ml-auto md:max-w-xl md:pl-4">
                  <button
                    onClick={() => {
                      setShowPinnedMessages((prev) => !prev);
                      setActiveThread(null);
                      setShowThreadCreator(false);
                    }}
                    className={`mr-2 inline-flex p-2 shrink-0 rounded-full transition ${showPinnedMessages ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                    title="Pinned Messages"
                    aria-label="Pinned Messages"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                    </svg>
                  </button>
                  <div className="inline-block w-[calc(100%-3rem)] min-w-0 align-middle md:w-[calc(100%-3.5rem)]">
                    <ChatSearchBox
                      hasAnchoredContext={hasAnchoredMessageContext}
                      inputRef={searchInputRef}
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
              customEmojiUrls={customEmojiUrls}
              currentUserClerkId={clerkUser?.id}
              editContent={editContent}
              editingId={editingId}
              formatSize={formatSize}
              isLoadingMore={paginateStatus === 'LoadingMore'}
              lastReadSnapshot={lastReadSnapshot}
              messages={allMessages}
              onDelete={(messageId) => setDeleteTargetId(messageId)}
              onPin={(messageId) => pinMessage({ messageId })}
              onUnpin={(messageId) => unpinMessage({ messageId })}
              onEditContentChange={setEditContent}
              onLoadMore={
                !anchoredMessages && paginateStatus === 'CanLoadMore'
                  ? () => loadMore(50)
                  : undefined
              }
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

            {showMemberList && (
              <MemberListPanel
                members={conversationMembers}
                onClose={() => setShowMemberList(false)}
              />
            )}

            <ChatComposer
              content={content}
              errorMessage={fileUpload.error}
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
                customEmojiUrls={customEmojiUrls}
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
                serverMembers={conversationMembers}
                targetReplyId={flashReplyId}
              />
            )}

            {showPinnedMessages && (
              <PinnedMessagesPanel
                activeChannelId={activeConversationTarget?.channelId}
                activeDirectConversationId={activeConversationTarget?.directConversationId}
                customEmojiUrls={customEmojiUrls}
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

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <AlertDialogContent className="bg-white dark:bg-[#313338] border-zinc-200 dark:border-zinc-700">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => { if (deleteTargetId) void handleDelete(deleteTargetId); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
