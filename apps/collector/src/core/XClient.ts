/**
 * X (Twitter) API v2 client — posts tweets via OAuth 1.0a user-context auth.
 *
 * Designed for the Cloudflare Workers runtime: signs with Web Crypto
 * (`crypto.subtle`) so there's no Node `crypto` dependency.
 *
 * For `POST /2/tweets` the request body is JSON, and per RFC 5849 §3.4.1.3
 * body params are only folded into the signature base string when the
 * Content-Type is `application/x-www-form-urlencoded`. JSON bodies are
 * therefore excluded — the signature only covers method + URL + OAuth
 * params themselves.
 */

export interface XClientCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export interface XPostResult {
  id: string;
  text: string;
}

export class XClient {
  constructor(private creds: XClientCredentials) {}

  async postTweet(text: string): Promise<XPostResult> {
    const url = "https://api.twitter.com/2/tweets";
    const method = "POST";
    const authHeader = await this.buildAuthHeader(method, url);

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`X API ${response.status}: ${body}`);
    }

    const json = (await response.json()) as { data: XPostResult };
    return json.data;
  }

  private async buildAuthHeader(method: string, url: string): Promise<string> {
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.creds.apiKey,
      oauth_nonce: generateNonce(),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: this.creds.accessToken,
      oauth_version: "1.0",
    };

    const baseString = buildSignatureBaseString(method, url, oauthParams);
    const signingKey =
      rfc3986(this.creds.apiSecret) +
      "&" +
      rfc3986(this.creds.accessTokenSecret);
    const signature = await hmacSha1Base64(signingKey, baseString);

    const headerParams: Record<string, string> = {
      ...oauthParams,
      oauth_signature: signature,
    };

    const headerValue = Object.keys(headerParams)
      .sort()
      .map((k) => `${rfc3986(k)}="${rfc3986(headerParams[k])}"`)
      .join(", ");

    return `OAuth ${headerValue}`;
  }
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// RFC 3986 percent-encoding. encodeURIComponent leaves !*'() alone; OAuth 1.0a
// (RFC 5849 §3.6) requires those to be encoded too.
function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!*'()]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function buildSignatureBaseString(
  method: string,
  url: string,
  params: Record<string, string>,
): string {
  const encodedParams = Object.keys(params)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(params[k])}`)
    .join("&");

  return [method.toUpperCase(), rfc3986(url), rfc3986(encodedParams)].join("&");
}

async function hmacSha1Base64(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    enc.encode(message),
  );
  return bytesToBase64(new Uint8Array(signature));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
