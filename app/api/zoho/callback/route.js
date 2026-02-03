import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "Missing ?code from Zoho OAuth redirect." },
      { status: 400 }
    );
  }

  const redirectUri = new URL("/api/zoho/callback", req.url).toString();

  const params = new URLSearchParams({
    code,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch("https://accounts.zoho.com/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await tokenRes.json();

  return NextResponse.json({
    message:
      "Copy refresh_token from this response and paste into .env.local as ZOHO_REFRESH_TOKEN. Then restart the server.",
    data,
  });
}
