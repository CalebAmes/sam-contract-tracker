var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/convert.js
async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const emailRaw = (body.email || "").trim().toLowerCase();
    const utm = `s=${body.utm_source || ""}|m=${body.utm_medium || ""}|c=${body.utm_campaign || ""}|d=${body.utm_content || ""}`;
    if (emailRaw) {
      const exists = await env.WAITLIST_KV.get(`email:${emailRaw}`);
      if (!exists) {
        await env.WAITLIST_KV.put(
          `email:${emailRaw}`,
          JSON.stringify({ email: emailRaw, utm, ts: Date.now() })
        );
        await Promise.all([
          increment(env, `conv:${today}:total`),
          increment(env, `conv:${today}:${utm}`)
        ]);
      }
    } else {
      await Promise.all([
        increment(env, `conv:${today}:total`),
        increment(env, `conv:${today}:${utm}`)
      ]);
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: err && err.message }, 500);
  }
}
__name(onRequestPost, "onRequestPost");
async function increment(env, key) {
  const current = await env.WAITLIST_KV.get(key);
  const next = (current ? parseInt(current, 10) : 0) + 1;
  await env.WAITLIST_KV.put(key, String(next));
}
__name(increment, "increment");
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
__name(json, "json");

// api/visit.js
async function onRequestPost2({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const key = /* @__PURE__ */ __name((suffix) => `views:${today}:${suffix}`, "key");
    const utm = `s=${body.s || ""}|m=${body.m || ""}|c=${body.c || ""}|d=${body.d || ""}`;
    await Promise.all([increment2(env, key("total")), increment2(env, key(utm))]);
    return json2({ ok: true });
  } catch (err) {
    return json2({ ok: false, error: err && err.message }, 500);
  }
}
__name(onRequestPost2, "onRequestPost");
async function increment2(env, key) {
  const current = await env.WAITLIST_KV.get(key);
  const next = (current ? parseInt(current, 10) : 0) + 1;
  await env.WAITLIST_KV.put(key, String(next));
}
__name(increment2, "increment");
function json2(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
__name(json2, "json");

// api/waitlist.js
async function onRequestPost3({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const email = (body.email || "").trim().toLowerCase();
    const website = (body.website || "").trim();
    const utm = `s=${body.utm_source || ""}|m=${body.utm_medium || ""}|c=${body.utm_campaign || ""}|d=${body.utm_content || ""}`;
    if (website) {
      return json3({ ok: true });
    }
    const hourKey = `rl:${ip}:${(/* @__PURE__ */ new Date()).toISOString().slice(0, 13)}`;
    const hits = parseInt(await env.WAITLIST_KV.get(hourKey) || "0", 10);
    if (hits > 20) {
      return json3({ ok: true });
    }
    await env.WAITLIST_KV.put(hourKey, String(hits + 1), {
      expirationTtl: 3600
    });
    if (env.TURNSTILE_SECRET && env.ENFORCE_TURNSTILE === "1") {
      const token = (body.turnstile_token || body["cf-turnstile-response"] || "").trim();
      if (!token) {
        return json3({ ok: true });
      }
      const passed = await verifyTurnstile(env.TURNSTILE_SECRET, token, ip);
      if (!passed) {
        return json3({ ok: true });
      }
    }
    if (!email) {
      return json3({ ok: true });
    }
    if (env.CHECK_MX === "1") {
      const domain = email.split("@")[1] || "";
      if (!await hasMx(domain)) {
        return json3({ ok: true });
      }
    }
    const exists = await env.WAITLIST_KV.get(`email:${email}`);
    if (!exists) {
      await env.WAITLIST_KV.put(
        `email:${email}`,
        JSON.stringify({ email, utm, ts: Date.now(), ip })
      );
      await Promise.all([
        increment3(env, `conv:${today}:total`),
        increment3(env, `conv:${today}:${utm}`)
      ]);
      if (env.RESEND_API_KEY && (env.RESEND_FROM || "").includes("@")) {
        try {
          await sendWelcomeEmail(env, email);
        } catch (_) {
        }
      }
      if (env.FORWARD_WAITLIST_URL) {
        try {
          await fetch(env.FORWARD_WAITLIST_URL, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, source: "marketing", utm })
          });
        } catch (_) {
        }
      }
    }
    return json3({ ok: true });
  } catch (err) {
    return json3({ ok: true });
  }
}
__name(onRequestPost3, "onRequestPost");
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
        body: form
      }
    );
    const data = await res.json().catch(() => ({}));
    return !!data.success;
  } catch (_) {
    return false;
  }
}
__name(verifyTurnstile, "verifyTurnstile");
async function hasMx(domain) {
  if (!domain) return false;
  try {
    const resp = await fetch(
      `https://1.1.1.1/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
      {
        headers: { accept: "application/dns-json" }
      }
    );
    const json5 = await resp.json();
    return Array.isArray(json5.Answer) && json5.Answer.length > 0;
  } catch (_) {
    return false;
  }
}
__name(hasMx, "hasMx");
async function increment3(env, key) {
  const current = await env.WAITLIST_KV.get(key);
  const next = (current ? parseInt(current, 10) : 0) + 1;
  await env.WAITLIST_KV.put(key, String(next));
}
__name(increment3, "increment");
function json3(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
__name(json3, "json");
async function sendWelcomeEmail(env, toEmail) {
  const from = env.RESEND_FROM || "SAM Tracker <hello@samtracker.com>";
  const subject = "You\u2019re on the list! \u{1F3AF} Welcome to SAM Tracker";
  const text = [
    "Hi there,",
    "",
    "I\u2019m Caleb, the founder of SAM Tracker. Thanks for joining the waitlist! I\u2019m excited to have you on board.",
    "",
    "You\u2019re now on the inside track for early access. Here\u2019s what\u2019s coming:",
    "\u2022 Priority access: Use our AI analyzer before we open to the public.",
    "\u2022 Exclusive updates: Behind-the-scenes progress and insights.",
    "\u2022 Simpler sales prep: Turn a 40-page SAM.gov posting into a clear, step-by-step playbook in seconds.",
    "",
    "Quick favor (takes 30 seconds):",
    "Just hit reply and tell me:",
    "1. What\u2019s the #1 thing you struggle with when looking for reseller opportunities?",
    "2. (Optional) Paste a SAM.gov link that\u2019s been challenging for you.",
    "",
    "Your feedback will directly shape SAM Tracker.",
    "",
    "Talk soon,",
    "Caleb",
    "Founder, SAM Tracker"
  ].join("\n");
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`
    },
    body: JSON.stringify({ from, to: toEmail, subject, text })
  });
}
__name(sendWelcomeEmail, "sendWelcomeEmail");

// api/stats.js
async function onRequest({ request, env }) {
  try {
    const url = new URL(request.url);
    const day = url.searchParams.get("day") || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const [vTotal, cTotal] = await Promise.all([
      getNum(env, `views:${day}:total`),
      getNum(env, `conv:${day}:total`)
    ]);
    const utmViews = await listPrefix(env, `views:${day}:s=`);
    const utmConvs = await listPrefix(env, `conv:${day}:s=`);
    const map = /* @__PURE__ */ new Map();
    utmViews.forEach(
      ({ key, val }) => map.set(key.split(`${day}:`)[1], { views: val, convs: 0 })
    );
    utmConvs.forEach(({ key, val }) => {
      const k = key.split(`${day}:`)[1];
      map.set(k, { ...map.get(k) || { views: 0, convs: 0 }, convs: val });
    });
    const rows = [...map.entries()].map(([k, o]) => ({
      utm: k,
      views: o.views,
      conversions: o.convs,
      cvr: o.views ? +(o.convs / o.views * 100).toFixed(2) : 0
    })).sort((a, b) => b.conversions - a.conversions).slice(0, 50);
    return json4({
      day,
      totals: {
        views: vTotal,
        conversions: cTotal,
        cvr: vTotal ? +(cTotal / vTotal * 100).toFixed(2) : 0
      },
      by_utm: rows
    });
  } catch (err) {
    return json4({ ok: false, error: err && err.message }, 500);
  }
}
__name(onRequest, "onRequest");
async function getNum(env, key) {
  const cur = await env.WAITLIST_KV.get(key);
  return cur ? parseInt(cur, 10) : 0;
}
__name(getNum, "getNum");
async function listPrefix(env, prefix) {
  const { keys } = await env.WAITLIST_KV.list({ prefix });
  const out = [];
  for (const k of keys) {
    const val = parseInt(await env.WAITLIST_KV.get(k.name) || "0", 10);
    out.push({ key: k.name, val });
  }
  return out;
}
__name(listPrefix, "listPrefix");
function json4(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
__name(json4, "json");

// ../../.wrangler/tmp/pages-VYJLKI/functionsRoutes-0.4698054211180569.mjs
var routes = [
  {
    routePath: "/api/convert",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/visit",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/waitlist",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/stats",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  }
];

// ../../../../../../.nvm/versions/node/v20.18.0/lib/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../../../.nvm/versions/node/v20.18.0/lib/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
