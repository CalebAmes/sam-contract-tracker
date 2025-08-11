export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));

    const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
    const today = new Date().toISOString().slice(0, 10);

    const email = (body.email || "").trim().toLowerCase();
    const website = (body.website || "").trim(); // honeypot

    const utm = `s=${body.utm_source || ""}|m=${body.utm_medium || ""}|c=${
      body.utm_campaign || ""
    }|d=${body.utm_content || ""}`;

    // Honeypot: if filled, silently accept without storing
    if (website) {
      return json({ ok: true });
    }

    // Rate limit by IP per hour (20/hr)
    const hourKey = `rl:${ip}:${new Date().toISOString().slice(0, 13)}`; // YYYY-MM-DDTHH
    const hits = parseInt((await env.WAITLIST_KV.get(hourKey)) || "0", 10);
    if (hits > 20) {
      return json({ ok: true });
    }
    await env.WAITLIST_KV.put(hourKey, String(hits + 1), {
      expirationTtl: 3600,
    });

    // Turnstile verification (if TURNSTILE_SECRET is set)
    if (env.TURNSTILE_SECRET && env.ENFORCE_TURNSTILE === "1") {
      const token = (
        body.turnstile_token ||
        body["cf-turnstile-response"] ||
        ""
      ).trim();
      if (!token) {
        return json({ ok: true });
      }
      const passed = await verifyTurnstile(env.TURNSTILE_SECRET, token, ip);
      if (!passed) {
        return json({ ok: true });
      }
    }

    if (!email) {
      return json({ ok: true });
    }

    // Optional MX check
    if (env.CHECK_MX === "1") {
      const domain = email.split("@")[1] || "";
      if (!(await hasMx(domain))) {
        return json({ ok: true });
      }
    }

    // Deduplicate by email
    const exists = await env.WAITLIST_KV.get(`email:${email}`);
    if (!exists) {
      await env.WAITLIST_KV.put(
        `email:${email}`,
        JSON.stringify({ email, utm, ts: Date.now(), ip: ip })
      );
      await Promise.all([
        increment(env, `conv:${today}:total`),
        increment(env, `conv:${today}:${utm}`),
      ]);

      // Fire-and-forget: send welcome email via Resend (if configured)
      if (env.RESEND_API_KEY && (env.RESEND_FROM || "").includes("@")) {
        try {
          await sendWelcomeEmail(env, email);
        } catch (_) {}
      }

      if (env.FORWARD_WAITLIST_URL) {
        try {
          await fetch(env.FORWARD_WAITLIST_URL, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, source: "marketing", utm }),
          });
        } catch (_) {}
      }
    }

    return json({ ok: true });
  } catch (err) {
    return json({ ok: true });
  }
}

async function verifyTurnstile(secret, token, ip) {
  try {
    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);
    if (ip) form.append("remoteip", ip);
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: form,
      }
    );
    const data = await res.json().catch(() => ({}));
    return !!data.success;
  } catch (_) {
    return false;
  }
}

async function hasMx(domain) {
  if (!domain) return false;
  try {
    const resp = await fetch(
      `https://1.1.1.1/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
      {
        headers: { accept: "application/dns-json" },
      }
    );
    const json = await resp.json();
    return Array.isArray(json.Answer) && json.Answer.length > 0;
  } catch (_) {
    return false;
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

async function sendWelcomeEmail(env, toEmail) {
  const from = "SAM Tracker <hello@samtracker.com>";
  const subject = "You’re on the list! 🎯 Welcome to SAM Tracker";
  const text = [
    "Hi there,",
    "",
    "I’m Caleb, the founder of SAM Tracker. Thanks for joining the waitlist! I’m excited to have you on board.",
    "",
    "You’re now on the inside track for early access. Here’s what’s coming:",
    "• Priority access: Use our AI analyzer before we open to the public.",
    "• Exclusive updates: Behind-the-scenes progress and insights.",
    "• Simpler sales prep: Turn a 40-page SAM.gov posting into a clear, step-by-step playbook in seconds.",
    "",
    "Quick favor (takes 30 seconds):",
    "Just hit reply and tell me:",
    "1. What’s the #1 thing you struggle with when looking for reseller opportunities?",
    "2. (Optional) Paste a SAM.gov link that’s been challenging for you.",
    "",
    "Your feedback will directly shape SAM Tracker.",
    "",
    "Talk soon,",
    "Caleb",
    "Founder, SAM Tracker",
  ].join("\n");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from, to: toEmail, subject, text }),
  });
}
