import { useEffect, useLayoutEffect } from 'react';
import type { Id } from '../../convex/_generated/dataModel';
import { useAppStore } from '../store/useAppStore';

export function useUrlSync() {
  const {
    activeSpace,
    activeServerId,
    activeChannelId,
    activeDirectConversationId,
    setActiveServerId,
    setActiveChannelId,
    setActiveDirectConversationId,
    showDirectMessages,
  } = useAppStore();

  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const space = params.get('space');
    const serverId = params.get('server');
    const channelId = params.get('channel');
    const dmId = params.get('dm');

    if (space === 'direct' && dmId) {
      showDirectMessages();
      setActiveDirectConversationId(dmId as Id<'directConversations'>);
    } else if (serverId) {
      setActiveServerId(serverId as Id<'servers'>);
      if (channelId) {
        setActiveChannelId(channelId as Id<'channels'>);
      }
    }
  }, []); // mount-only hydrate from URL; zustand setters are stable

  useEffect(() => {
    const params = new URLSearchParams();

    if (activeSpace === 'direct' && activeDirectConversationId) {
      params.set('space', 'direct');
      params.set('dm', activeDirectConversationId);
    } else if (activeSpace === 'server' && activeServerId) {
      params.set('server', activeServerId);
      if (activeChannelId) {
        params.set('channel', activeChannelId);
      }
    }

    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;

    window.history.replaceState(null, '', newUrl);
  }, [
    activeSpace,
    activeServerId,
    activeChannelId,
    activeDirectConversationId,
  ]);
}
