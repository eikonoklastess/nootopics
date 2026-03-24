import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/getEmoji",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const requestedId = url.searchParams.get("storageId");

    if (!requestedId) {
      return new Response("Missing storageId parameter", { status: 400 });
    }

    // Use storage IDs only. If malformed IDs are passed, return 404 instead
    // of throwing so chat rendering keeps working.
    let fileUrl: string | null = null;
    try {
      fileUrl = await ctx.storage.getUrl(requestedId as any);
    } catch {
      fileUrl = null;
    }

    if (!fileUrl) {
      return new Response("Image not found", { status: 404 });
    }

    // Redirect the browser straight to the internal Convex file storage bucket
    // so we don't have to proxy the bytes through this HTTP handler.
    return new Response(null, {
      status: 302,
      headers: {
        Location: fileUrl,
      },
    });
  }),
});

export default http;
