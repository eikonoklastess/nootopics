import type { Id } from '../../../convex/_generated/dataModel';

export type PresenceStatus = 'ONLINE' | 'IDLE' | 'DND' | 'OFFLINE';

export interface ServerMember {
  _id: Id<'users'>;
  clerkId: string;
  imageUrl: string;
  name: string;
  memberId?: Id<'members'>;
  role?: 'ADMIN' | 'MODERATOR' | 'GUEST';
}

export interface ChatUser {
  _id?: Id<'users'>;
  clerkId: string;
  imageUrl: string;
  name: string;
  status?: PresenceStatus;
}

export interface DirectConversationSummary {
  _creationTime: number;
  _id: Id<'directConversations'>;
  lastMessageTime: number | null;
  otherUser: ChatUser | null;
}

export interface ChatAttachment {
  name: string;
  size: number;
  storageId: Id<'_storage'>;
  type: string;
  url?: string | null;
}

export interface ServerEmoji {
  _id: Id<'emojis'>;
  format: 'gif' | 'png';
  name: string;
  storageId: Id<'_storage'>;
  url?: string | null;
}

export interface ChatMessage {
  _creationTime: number;
  _id: Id<'messages'>;
  content: string;
  deleted: boolean;
  files?: ChatAttachment[];
  isEdited?: boolean;
  pinned?: boolean;
  replyCount: number;
  threadId?: Id<'messages'>;
  user: ChatUser | null;
}

export interface ThreadReply {
  _creationTime: number;
  _id: Id<'messages'>;
  content: string;
  deleted: boolean;
  files?: ChatAttachment[];
  isEdited?: boolean;
  threadId?: Id<'messages'>;
  user: ChatUser | null;
}

export type SearchHasFilter =
  | 'file'
  | 'image'
  | 'video'
  | 'audio'
  | 'thread'
  | 'reply';

export interface ParsedSearchFilters {
  after?: number;
  afterLabel?: string;
  authorName?: string;
  before?: number;
  beforeLabel?: string;
  channelName?: string;
  has?: SearchHasFilter;
}

export interface ParsedSearchQuery {
  filters: ParsedSearchFilters;
  hasFilters: boolean;
  raw: string;
  searchText: string;
  terms: string[];
}

export interface MessageSearchResult {
  _creationTime: number;
  _id: Id<'messages'>;
  anchorMessageId: Id<'messages'>;
  channelId: Id<'channels'>;
  channelName: string;
  content: string;
  deleted: boolean;
  hasFiles: boolean;
  isThreadReply: boolean;
  replyCount: number;
  threadReplyMessageId: Id<'messages'> | null;
  user: ChatUser | null;
}
