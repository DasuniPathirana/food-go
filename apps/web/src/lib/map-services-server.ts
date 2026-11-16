import "server-only";
import { createMapServices } from "./map-services";
import { publicCatalogueClient, readCatalogueConfig } from "./catalogue";

const services = createMapServices({
  env: process.env,
  async acquireLease(service) {
    const config = readCatalogueConfig(process.env);
    if (config.mode !== "supabase" || !config.configured) throw new Error("Shared map service unavailable");
    const { data, error } = await publicCatalogueClient(config).rpc("food_go_map_service_lease", { p_service: service })
      .abortSignal(AbortSignal.timeout(4000));
    if (error) throw new Error("Shared map service unavailable");
    return data === true;
  },
});
export const searchMapPlaces = services.search;
export const planMapWalk = services.route;
