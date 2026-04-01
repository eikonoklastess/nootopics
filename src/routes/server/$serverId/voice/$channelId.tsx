import { createFileRoute } from '@tanstack/react-router';
import { VoiceChannel } from '../../../../features/voice/VoiceChannel';
import { Id } from '../../../../../convex/_generated/dataModel';

export const Route = createFileRoute('/server/$serverId/voice/$channelId')({
  component: RouteComponent,
});

function RouteComponent() {
  const { serverId, channelId } = Route.useParams();
  return <VoiceChannel serverId={serverId as Id<"servers">} channelId={channelId as Id<"channels">} />;
}
