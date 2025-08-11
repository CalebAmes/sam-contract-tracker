export async function onRequest({ request, env }) {
  try {
    const url = new URL(request.url);
    const day =
      url.searchParams.get("day") || new Date().toISOString().slice(0, 10);

    const [vTotal, cTotal] = await Promise.all([
      getNum(env, `views:${day}:total`),
      getNum(env, `conv:${day}:total`),
    ]);

    const utmViews = await listPrefix(env, `views:${day}:s=`);
    const utmConvs = await listPrefix(env, `conv:${day}:s=`);

    const map = new Map();
    utmViews.forEach(({ key, val }) =>
      map.set(key.split(`${day}:`)[1], { views: val, convs: 0 })
    );
    utmConvs.forEach(({ key, val }) => {
      const k = key.split(`${day}:`)[1];
      map.set(k, { ...(map.get(k) || { views: 0, convs: 0 }), convs: val });
    });

    const rows = [...map.entries()]
      .map(([k, o]) => ({
        utm: k,
        views: o.views,
        conversions: o.convs,
        cvr: o.views ? +((o.convs / o.views) * 100).toFixed(2) : 0,
      }))
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 50);

    return json({
      day,
      totals: {
        views: vTotal,
        conversions: cTotal,
        cvr: vTotal ? +((cTotal / vTotal) * 100).toFixed(2) : 0,
      },
      by_utm: rows,
    });
  } catch (err) {
    return json({ ok: false, error: err && err.message }, 500);
  }
}

async function getNum(env, key) {
  const cur = await env.WAITLIST_KV.get(key);
  return cur ? parseInt(cur, 10) : 0;
}

async function listPrefix(env, prefix) {
  const { keys } = await env.WAITLIST_KV.list({ prefix });
  const out = [];
  for (const k of keys) {
    const val = parseInt((await env.WAITLIST_KV.get(k.name)) || "0", 10);
    out.push({ key: k.name, val });
  }
  return out;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
