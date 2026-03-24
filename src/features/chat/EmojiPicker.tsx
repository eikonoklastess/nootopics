import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAppStore } from '../../store/useAppStore';

interface EmojiPickerProps {
  onSelect: (value: string) => void;
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const { activeServerId, activeSpace } = useAppStore();

  const serverEmojis = useQuery(
    api.emojis.list,
    activeSpace === "server" && activeServerId
      ? { serverId: activeServerId }
      : "skip"
  );

  const convexSiteUrl = import.meta.env.VITE_CONVEX_URL.replace('.convex.cloud', '.convex.site');

  const customEmojis = serverEmojis && serverEmojis.length > 0 ? [
    {
      id: 'custom_server_emojis',
      name: 'Server Emojis',
      emojis: serverEmojis.map((e) => ({
        id: e.storageId,
        name: e.name,
        keywords: [e.name],
        skins: [{ src: `${convexSiteUrl}/getEmoji?storageId=${e.storageId}` }]
      }))
    }
  ] : [];

  const handleEmojiSelect = (emoji: any) => {
    if (emoji.native) {
      // Standard unicode emoji
      onSelect(emoji.native);
    } else {
      // Custom emoji
      // emoji.id is exactly what we supplied: the storageId.
      // emoji.name is the name.
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
