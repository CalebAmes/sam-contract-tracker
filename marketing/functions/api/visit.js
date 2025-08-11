export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const today = new Date().toISOString().slice(0, 10);
    const key = (suffix) => `views:${today}:${suffix}`;
    const utm = `s=${body.s || ""}|m=${body.m || ""}|c=${body.c || ""}|d=${
      body.d || ""
    }`;

    await Promise.all([increment(env, key("total")), increment(env, key(utm))]);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: err && err.message }, 500);
  }
}

async function increment(env, key) {
  const current = await env.WAITLIST_KV.get(key);
  const next = (current ? parseInt(current, 10) : 0) + 1;
  await env.WAITLIST_KV.put(key, String(next));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
