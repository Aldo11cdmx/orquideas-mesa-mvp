import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Imperio · Pedidos",
    short_name: "Imperio",
    start_url: "/",
    display: "standalone",
    background_color: "#e7e5e1",
    theme_color: "#35322f",
    icons: []
  };
}
