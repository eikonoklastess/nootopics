const MAX_MESSAGE_PREVIEW_LENGTH = 180;

export function normalizeName(value: string | undefined) {
  return value?.trim().toLowerCase().replace(/^#/, "") ?? "";
}

export function buildMessagePreview(content: string) {
  const normalized = content.trim().replace(/\s+/g, " ");
  if (normalized.length <= MAX_MESSAGE_PREVIEW_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_MESSAGE_PREVIEW_LENGTH - 1).trimEnd()}…`;
}
