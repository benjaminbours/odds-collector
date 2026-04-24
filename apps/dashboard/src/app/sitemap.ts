import type { MetadataRoute } from "next";
import { LEAGUES } from "@odds-collector/shared";
import { toSlug } from "@/lib/url-utils";

const BASE_URL = "https://market.oddslab.gg";

export default function sitemap(): MetadataRoute.Sitemap {
  const leagueUrls = LEAGUES.map((league) => ({
    url: `${BASE_URL}/leagues/${toSlug(league.id)}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/steam-moves`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    ...leagueUrls,
  ];
}
