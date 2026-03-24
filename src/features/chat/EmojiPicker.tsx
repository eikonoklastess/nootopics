import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAppStore } from '../../store/useAppStore';
import type { ServerEmoji } from './types';

interface EmojiPickerProps {
  onSelect: (value: string) => void;
}

interface EmojiSelection {
  id: string;
  name: string;
  native?: string;
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const { activeServerId, activeSpace } = useAppStore();

  const serverEmojis =
    (useQuery(
      api.emojis.list,
      activeSpace === "server" && activeServerId
        ? { serverId: activeServerId }
        : "skip"
    ) as ServerEmoji[] | undefined) ?? [];

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
        theme="dark"
        previewPosition="none"
        skinTonePosition="none"
      />
    </div>
  );
}
