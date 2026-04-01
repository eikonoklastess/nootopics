import { useQuery } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

export function useLiveKitToken(serverId: Id<"servers">, channelId: Id<"channels">) {
  const convex = useConvex();

  return useQuery({
    queryKey: ["livekitToken", serverId, channelId],
    queryFn: async () => {
      const response = await convex.action(api.livekit.getToken, {
        serverId,
        channelId,
      });
      return response;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
