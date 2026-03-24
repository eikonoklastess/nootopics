import { describe, expect, it } from 'vitest';
import {
  computeUnreadCountFromCounters,
  getParentMessageId,
} from './messages';

describe('computeUnreadCountFromCounters', () => {
  it('returns a non-negative unread count when both counters are present', () => {
    expect(computeUnreadCountFromCounters(12, 4)).toBe(8);
    expect(computeUnreadCountFromCounters(3, 9)).toBe(0);
  });

  it('returns null when either side is missing', () => {
    expect(computeUnreadCountFromCounters(undefined, 4)).toBeNull();
    expect(computeUnreadCountFromCounters(12, undefined)).toBeNull();
  });

  it('normalizes top-level and reply parent ids for indexed reads', () => {
    expect(getParentMessageId({ parentMessageId: null, threadId: undefined })).toBeNull();
    expect(
      getParentMessageId({
        parentMessageId: undefined,
        threadId: 'message_1' as never,
      }),
    ).toBe('message_1');
  });
});
