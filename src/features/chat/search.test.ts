import { describe, expect, it } from 'vitest';
import { buildSearchSnippet, parseSearchQuery } from './search';

describe('parseSearchQuery', () => {
  it('parses free text and structured filters together', () => {
    expect(
      parseSearchQuery('release notes from:"Alice Example" in:#general has:image'),
    ).toEqual({
      filters: {
        authorName: 'Alice Example',
        channelName: 'general',
        has: 'image',
      },
      hasFilters: true,
      raw: 'release notes from:"Alice Example" in:#general has:image',
      searchText: 'release notes',
      terms: ['release', 'notes'],
    });
  });

  it('normalizes date filters into timestamps', () => {
    const parsed = parseSearchQuery('after:2026-03-01 before:2026-03-03 deploy');

    expect(parsed.searchText).toBe('deploy');
    expect(parsed.filters.afterLabel).toBe('2026-03-01');
    expect(parsed.filters.beforeLabel).toBe('2026-03-03');
    expect(parsed.filters.after).toBeTypeOf('number');
    expect(parsed.filters.before).toBeTypeOf('number');
    expect(parsed.filters.before).toBeGreaterThan(parsed.filters.after ?? 0);
  });

  it('treats unknown flags and invalid filters as text', () => {
    const parsed = parseSearchQuery('owner:bob has:zip before:not-a-date status');

    expect(parsed.filters).toEqual({});
    expect(parsed.searchText).toBe('owner:bob has:zip before:not-a-date status');
  });
});

describe('buildSearchSnippet', () => {
  it('centers the excerpt around the first search term match', () => {
    const snippet = buildSearchSnippet(
      'This is a long message about product launches and release notes that should center around notes in the excerpt.',
      ['notes'],
      60,
    );

    expect(snippet).toContain('notes');
    expect(snippet.startsWith('...')).toBe(true);
  });
});
