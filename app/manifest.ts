import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cart Pilot",
    short_name: "Cart Pilot",
    description: "A conversational electronics shopping assistant.",
    start_url: "/shop",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#c4472b",
    icons: [
      {
        src: "/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
