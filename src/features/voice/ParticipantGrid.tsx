import { useParticipants } from '@livekit/components-react';
import { ParticipantTile } from './ParticipantTile';

export function ParticipantGrid() {
  const participants = useParticipants();

  if (participants.length === 0) {
    return <div className="text-zinc-400">Waiting for others to join...</div>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full h-full content-center justify-items-center max-w-6xl">
      {participants.map((p) => (
        <ParticipantTile key={p.identity} participant={p} />
      ))}
    </div>
  );
}
