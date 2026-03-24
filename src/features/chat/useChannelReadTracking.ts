import { useEffect, useRef, useState } from 'react';
import type { Id } from '../../../convex/_generated/dataModel';

interface UseChannelReadTrackingOptions {
  activeConversationKey: string | null;
  activeConversationTarget:
    | { channelId: Id<'channels'>; directConversationId?: never }
    | { channelId?: never; directConversationId: Id<'directConversations'> }
    | null;
  lastReadTime: number | undefined;
  markAsRead: (
    args:
      | { channelId: Id<'channels'>; directConversationId?: never }
      | { channelId?: never; directConversationId: Id<'directConversations'> },
  ) => Promise<unknown>;
  messageCount: number;
}

export function useChannelReadTracking({
  activeConversationKey,
  activeConversationTarget,
  lastReadTime,
  markAsRead,
  messageCount,
}: UseChannelReadTrackingOptions) {
  const [lastReadSnapshot, setLastReadSnapshot] = useState<number | null>(null);
  const hasMarkedRead = useRef(false);
  const initialMessageCount = useRef<number | null>(null);

  useEffect(() => {
    setLastReadSnapshot(null);
    hasMarkedRead.current = false;
    initialMessageCount.current = null;
  }, [activeConversationKey]);

  useEffect(() => {
    if (!activeConversationTarget || lastReadTime === undefined) {
      return;
    }

    if (lastReadSnapshot === null) {
      setLastReadSnapshot(lastReadTime);
    }

    if (!hasMarkedRead.current) {
      hasMarkedRead.current = true;
      void markAsRead(activeConversationTarget).catch(() => {});
    }
  }, [activeConversationTarget, lastReadSnapshot, lastReadTime, markAsRead]);

  useEffect(() => {
    if (!activeConversationTarget || !hasMarkedRead.current) {
      return;
    }

    if (initialMessageCount.current === null) {
      initialMessageCount.current = messageCount;
      return;
    }

    if (messageCount > initialMessageCount.current) {
      initialMessageCount.current = messageCount;
      setLastReadSnapshot(Date.now());
      void markAsRead(activeConversationTarget).catch(() => {});
    }
  }, [activeConversationTarget, markAsRead, messageCount]);

  return lastReadSnapshot;
}
