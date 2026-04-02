import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ClinicFlow",
    short_name: "ClinicFlow",
    description: "מערכת ניהול למכון פיזיותרפיה וריפוי בעיסוק",
    start_url: "/",
    display: "standalone",
    background_color: "#f6efe6",
    theme_color: "#146c63",
    lang: "he",
    dir: "rtl",
    orientation: "portrait",
    icons: [
      {
        src: "/icon?size=192",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon?size=512",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
