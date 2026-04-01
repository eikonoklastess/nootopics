import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import '@livekit/components-styles';
import { useLiveKitToken } from './useLiveKitToken';
import type { Id } from '../../../convex/_generated/dataModel';
import { ParticipantGrid } from './ParticipantGrid';
import { Controls } from './Controls';

interface VoiceChannelProps {
  serverId: Id<"servers">;
  channelId: Id<"channels">;
}

export function VoiceChannel({ serverId, channelId }: VoiceChannelProps) {
  const { data, isLoading, error } = useLiveKitToken(serverId, channelId);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#313338] text-zinc-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        <span className="ml-3">Connecting to Voice...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#313338] text-red-400">
        Failed to connect to voice channel.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#313338] h-full overflow-hidden">
      <LiveKitRoom
        video={false} // Initially off
        audio={true}  // Initially on
        token={data.token}
        serverUrl={data.serverUrl}
        className="flex-1 flex flex-col"
        data-lk-theme="default"
      >
        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center">
          <ParticipantGrid />
        </div>
        <Controls />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
