import { Track } from 'livekit-client';
import {
  VideoTrack,
  useTracks,
  useIsSpeaking,
} from '@livekit/components-react';
import type { Participant } from 'livekit-client';

export function ParticipantTile({ participant }: { participant: Participant }) {
  const isSpeaking = useIsSpeaking(participant);
  const isMicrophoneEnabled = participant.isMicrophoneEnabled;
  const isCameraEnabled = participant.isCameraEnabled;
  
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true })
    .filter((t) => t.participant.identity === participant.identity);

  const cameraTrack = tracks.find((t) => t.source === Track.Source.Camera);

  return (
    <div
      className={`relative flex flex-col items-center justify-center bg-zinc-800 rounded-lg overflow-hidden w-full aspect-video transition-all shadow-md ${
        isSpeaking ? 'ring-2 ring-green-500' : 'ring-1 ring-zinc-700'
      }`}
    >
      {isCameraEnabled && cameraTrack?.publication?.track ? (
        <VideoTrack
          trackRef={cameraTrack}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex items-center justify-center w-full h-full bg-[#2b2d31]">
          <div className="w-16 h-16 bg-indigo-500 rounded-full flex items-center justify-center text-3xl font-semibold text-white shadow-lg">
            {participant.name?.[0]?.toUpperCase() || '?'}
          </div>
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex items-center gap-2">
        <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-md font-medium">
          {participant.name}
        </span>
      </div>

      {!isMicrophoneEnabled && (
        <div className="absolute bottom-3 right-3 bg-red-500/90 rounded-full p-1 shadow-md text-white">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/><path d="M19 11h-1.7c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" fill="none"/></svg>
        </div>
      )}
    </div>
  );
}
