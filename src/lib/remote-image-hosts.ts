/**
 * Remote image hosts allowed by `next.config.ts`.
 *
 * Keep this list in sync with the actual image providers used by the catalog.
 * `pathname` uses the same `/**` suffix as Next.js remotePatterns.
 */
export const remoteImageHosts = [
  { hostname: "burst.shopifycdn.com", pathname: "/photos/**" },
  { hostname: "images.pexels.com", pathname: "/photos/**" },
  {
    hostname: "thumb.wikimedia.org",
    pathname: "/wikipedia/commons/thumb/**",
  },
  { hostname: "upload.wikimedia.org", pathname: "/wikipedia/commons/**" },
] as const;

/**
 * Returns true for local image paths and HTTPS URLs that match one of the
 * configured hosts. Anything else falls back to the category glyph before
 * `next/image` gets a chance to throw an "unconfigured host" error.
 */
export function isAllowedRemoteImageSrc(src: string) {
  if (src.startsWith("//")) {
    return false;
  }

  if (src.startsWith("/")) {
    return true;
  }

  try {
    const url = new URL(src);

    if (url.protocol !== "https:" || url.port !== "") {
      return false;
    }

    return remoteImageHosts.some(({ hostname, pathname }) => {
      if (url.hostname !== hostname) {
        return false;
      }

      const prefix = pathname.replace(/\/\*\*$/, "");
      return url.pathname === prefix || url.pathname.startsWith(`${prefix}/`);
    });
  } catch {
    return false;
  }
}
