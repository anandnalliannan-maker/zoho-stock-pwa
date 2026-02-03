// lib/zoho.js
// Zoho OAuth + Zoho Sheet API helper (server-side only)

let cached = {
  accessToken: null,
  expiresAt: 0,
  apiDomain: "https://sheet.zoho.com",
};

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function getZohoAccessToken() {
  const now = Date.now();

  // reuse token if it is valid for at least 60 more seconds
  if (cached.accessToken && cached.expiresAt - now > 60_000) {
    return { accessToken: cached.accessToken, apiDomain: cached.apiDomain };
  }

  const clientId = requireEnv("ZOHO_CLIENT_ID");
  const clientSecret = requireEnv("ZOHO_CLIENT_SECRET");
  const refreshToken = requireEnv("ZOHO_REFRESH_TOKEN");

  const tokenUrl = new URL("https://accounts.zoho.com/oauth/v2/token");
  tokenUrl.searchParams.set("refresh_token", refreshToken);
  tokenUrl.searchParams.set("grant_type", "refresh_token");
  tokenUrl.searchParams.set("client_id", clientId);
  tokenUrl.searchParams.set("client_secret", clientSecret);

  const res = await fetch(tokenUrl.toString(), { method: "POST" });
  const data = await res.json();

  if (!res.ok || !data.access_token) {
    throw new Error(
      `Zoho token refresh failed: ${res.status} ${JSON.stringify(data)}`
    );
  }

  // expires_in is seconds
  const expiresInSec = Number(data.expires_in || 3600);

  cached.accessToken = data.access_token;
  cached.expiresAt = now + expiresInSec * 1000;
  // Some Zoho tokens return an api_domain for CRM; always keep Sheet domain here.
  cached.apiDomain = "https://sheet.zoho.com";

  return { accessToken: cached.accessToken, apiDomain: cached.apiDomain };
}

export async function zohoSheetPost(resourceId, paramsObj) {
  const { accessToken, apiDomain } = await getZohoAccessToken();

  // Zoho Sheet Data API style: POST https://sheet.zoho.com/api/v2/<resource_id>?<params>
  // Use query params because some endpoints reject POST bodies.
  const url = new URL(`${apiDomain}/api/v2/${encodeURIComponent(resourceId)}`);
  for (const [k, v] of Object.entries(paramsObj || {})) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      // Authorization header format per Zoho Sheet API docs
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
  });

  const rawText = await res.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { rawText };
  }

  if (!res.ok || data?.status === "failure") {
    throw new Error(
      `Zoho Sheet API failed: ${res.status} ${JSON.stringify(data)}`
    );
  }

  return data;
}

export async function fetchAllRecords({ resourceId, worksheetName }) {
  // Uses worksheet.records.fetch (Zoho returns max 1000 rows per call)
  // We'll page until we get less than 1000.
  const pageSize = 1000;
  let startIndex = 1;
  let all = [];

  while (true) {
    const data = await zohoSheetPost(resourceId, {
      method: "worksheet.records.fetch",
      worksheet_name: worksheetName,
      records_start_index: startIndex,
      count: pageSize,
    });

    const records = Array.isArray(data.records) ? data.records : [];
    all = all.concat(records);

    if (records.length < pageSize) break;
    startIndex += pageSize;
  }

  return all;
}
