"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { AccessToken } from "livekit-server-sdk";
import { internal } from "./_generated/api";

export const getToken = action({
  args: {
    serverId: v.id("servers"),
    channelId: v.id("channels"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.channels.getVoiceCredentials, {
      serverId: args.serverId,
      channelId: args.channelId,
    });

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      throw new Error("LiveKit credentials not configured");
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.userId,
      name: user.name,
    });

    at.addGrant({
      roomJoin: true,
      room: args.channelId,
      canPublish: true,
      canSubscribe: true,
    });

    return {
      token: await at.toJwt(),
      serverUrl: wsUrl,
    };
  },
});
