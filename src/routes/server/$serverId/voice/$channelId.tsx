import { createFileRoute } from '@tanstack/react-router';
import { VoiceChannel } from '@/features/voice/VoiceChannel';

export const Route = createFileRoute('/server/$serverId/voice/$channelId')({
  component: RouteComponent,
});

function RouteComponent() {
  const { serverId, channelId } = Route.useParams();
  return <VoiceChannel serverId={serverId as any} channelId={channelId as any} />;
}
