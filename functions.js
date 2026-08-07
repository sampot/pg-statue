/** Optional Playgrounds Infrastructure stub (not required for local open). */
export default {
  async fetch(request) {
    return Response.json({
      ok: true,
      name: "pg-statue",
      path: new URL(request.url).pathname,
    });
  },
};
