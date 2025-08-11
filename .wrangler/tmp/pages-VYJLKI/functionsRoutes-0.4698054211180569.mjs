import { onRequestPost as __api_convert_js_onRequestPost } from "/Users/calebgilbert/src/setton/tools/sam-contract-tracker/marketing/functions/api/convert.js"
import { onRequestPost as __api_visit_js_onRequestPost } from "/Users/calebgilbert/src/setton/tools/sam-contract-tracker/marketing/functions/api/visit.js"
import { onRequestPost as __api_waitlist_js_onRequestPost } from "/Users/calebgilbert/src/setton/tools/sam-contract-tracker/marketing/functions/api/waitlist.js"
import { onRequest as __api_stats_js_onRequest } from "/Users/calebgilbert/src/setton/tools/sam-contract-tracker/marketing/functions/api/stats.js"

export const routes = [
    {
      routePath: "/api/convert",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_convert_js_onRequestPost],
    },
  {
      routePath: "/api/visit",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_visit_js_onRequestPost],
    },
  {
      routePath: "/api/waitlist",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_waitlist_js_onRequestPost],
    },
  {
      routePath: "/api/stats",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_stats_js_onRequest],
    },
  ]