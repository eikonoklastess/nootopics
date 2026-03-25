import { describe, expect, it } from 'vitest';
import {
  findMentionMatches,
  formatThreadMessage,
  getFilteredMembers,
  isUserMentioned,
  shouldShowUnreadDivider,
} from './utils';
import type { ChatMessage, ServerMember } from './types';

const members: ServerMember[] = [
  { _id: 'a' as ServerMember['_id'], clerkId: 'clerk_a', imageUrl: '', name: 'Alice Example' },
  { _id: 'b' as ServerMember['_id'], clerkId: 'clerk_b', imageUrl: '', name: 'Bob' },
];

const messages: ChatMessage[] = [
  {
    _creationTime: 300,
    _id: 'm3' as ChatMessage['_id'],
    content: 'Newest',
    deleted: false,
    replyCount: 0,
    user: null,
  },
  {
    _creationTime: 200,
    _id: 'm2' as ChatMessage['_id'],
    content: 'Middle',
    deleted: false,
    replyCount: 0,
    user: null,
  },
  {
    _creationTime: 100,
    _id: 'm1' as ChatMessage['_id'],
    content: 'Oldest',
    deleted: false,
    replyCount: 0,
    user: null,
  },
];

describe('chat utils', () => {
  it('finds only known mentions', () => {
    expect(findMentionMatches('hello @Alice Example and @Missing', members)).toEqual([
      {
        content: '@Alice Example',
        data: { name: 'Alice Example' },
        end: 20,
        start: 6,
        type: 'mention',
      },
    ]);
  });

  it('detects whether the signed-in user is mentioned', () => {
    expect(isUserMentioned('hi @Bob', 'clerk_b', members)).toBe(true);
    expect(isUserMentioned('hi @Alice Example', 'clerk_b', members)).toBe(false);
  });

  it('filters members case-insensitively and caps the list', () => {
    expect(getFilteredMembers(members, 'ali')).toEqual([members[0]]);
  });

  it('computes the unread divider position from a frozen snapshot', () => {
    expect(shouldShowUnreadDivider(messages, 0, 150, 'clerk_a')).toBe(false);
    expect(shouldShowUnreadDivider(messages, 1, 150, 'clerk_a')).toBe(true);
  });

  it('formats deleted thread messages safely', () => {
    expect(formatThreadMessage({ content: 'hello', deleted: false })).toBe('hello');
    expect(formatThreadMessage({ content: 'hello', deleted: true })).toBe(
      'Message deleted',
    );
  });
});
