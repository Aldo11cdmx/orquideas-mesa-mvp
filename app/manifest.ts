import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Orquídeas · Pedidos",
    short_name: "Orquídeas",
    start_url: "/demo",
    display: "standalone",
    background_color: "#f6f0e4",
    theme_color: "#153f35",
    icons: []
  };
}
