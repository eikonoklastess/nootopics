import { create } from 'zustand';
import type { Id } from '../../convex/_generated/dataModel';

interface MessageContext {
  anchorMessageId: Id<'messages'>;
  channelId?: Id<'channels'>;
  directConversationId?: Id<'directConversations'>;
  highlightMessageId: Id<'messages'>;
  threadReplyMessageId: Id<'messages'> | null;
}

interface AppState {
  activeSpace: 'server' | 'direct' | null;
  activeServerId: Id<'servers'> | null;
  activeChannelId: Id<'channels'> | null;
  activeDirectConversationId: Id<'directConversations'> | null;
  messageContext: MessageContext | null;
  setActiveServerId: (id: Id<'servers'> | null) => void;
  setActiveChannelId: (
    id: Id<'channels'> | null,
    options?: { preserveMessageContext?: boolean },
  ) => void;
  setActiveDirectConversationId: (
    id: Id<'directConversations'> | null,
    options?: { preserveMessageContext?: boolean },
  ) => void;
  showDirectMessages: () => void;
  setMessageContext: (context: MessageContext) => void;
  clearMessageContext: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeSpace: null,
  activeServerId: null,
  activeChannelId: null,
  activeDirectConversationId: null,
  messageContext: null,
  setActiveServerId: (id) =>
    set({
      activeSpace: id ? 'server' : null,
      activeServerId: id,
      activeChannelId: null,
      activeDirectConversationId: null,
      messageContext: null,
    }),
  setActiveChannelId: (id, options) =>
    set((state) => ({
      activeSpace: id ? 'server' : state.activeSpace,
      activeChannelId: id,
      activeDirectConversationId: null,
      messageContext: options?.preserveMessageContext
        ? state.messageContext
        : null,
    })),
  setActiveDirectConversationId: (id, options) =>
    set((state) => ({
      activeSpace: id ? 'direct' : 'direct',
      activeChannelId: null,
      activeDirectConversationId: id,
      messageContext: options?.preserveMessageContext
        ? state.messageContext
        : null,
    })),
  showDirectMessages: () =>
    set({
      activeSpace: 'direct',
      activeChannelId: null,
      activeDirectConversationId: null,
      messageContext: null,
    }),
  setMessageContext: (context) => set({ messageContext: context }),
  clearMessageContext: () => set({ messageContext: null }),
}));
