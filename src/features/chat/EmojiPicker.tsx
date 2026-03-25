import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import type { ServerEmoji } from './types';

interface EmojiPickerProps {
  onSelect: (value: string) => void;
  serverEmojis: ServerEmoji[];
}

interface EmojiSelection {
  id: string;
  name: string;
  native?: string;
}

export function EmojiPicker({ onSelect, serverEmojis }: EmojiPickerProps) {
  const customEmojis = serverEmojis.length > 0 ? [
    {
      id: 'custom_server_emojis',
      name: 'Server Emojis',
      emojis: serverEmojis.map((e) => ({
        id: e.storageId,
        name: e.name,
        keywords: [e.name],
        skins: [{ src: e.url ?? "" }]
      }))
    }
  ] : [];

  const handleEmojiSelect = (emoji: EmojiSelection) => {
    if (emoji.native) {
      onSelect(emoji.native);
    } else {
      onSelect(`<:${emoji.name}:${emoji.id}>`);
    }
  };

  return (
    <div className="shadow-2xl rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
      <Picker 
        data={data} 
        custom={customEmojis}
        onEmojiSelect={handleEmojiSelect}
        theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
        previewPosition="none"
        skinTonePosition="none"
      />
    </div>
  );
}
