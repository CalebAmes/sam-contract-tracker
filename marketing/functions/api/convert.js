export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const today = new Date().toISOString().slice(0, 10);

    const emailRaw = (body.email || "").trim().toLowerCase();
    const utm = `s=${body.utm_source || ""}|m=${body.utm_medium || ""}|c=${
      body.utm_campaign || ""
    }|d=${body.utm_content || ""}`;

    if (emailRaw) {
      const exists = await env.WAITLIST_KV.get(`email:${emailRaw}`);
      if (!exists) {
        await env.WAITLIST_KV.put(
          `email:${emailRaw}`,
          JSON.stringify({ email: emailRaw, utm, ts: Date.now() })
        );
        await Promise.all([
          increment(env, `conv:${today}:total`),
          increment(env, `conv:${today}:${utm}`),
        ]);
      }
    } else {
      await Promise.all([
        increment(env, `conv:${today}:total`),
        increment(env, `conv:${today}:${utm}`),
      ]);
    }

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
