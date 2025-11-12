import Script from "next/script";

function shouldEnableAnalytics() {
  const isProduction = process.env.NODE_ENV === "production";
  const explicitlyEnabled =
    process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "1";
  // Enable in production by default; allow explicit opt-in in non-prod
  return isProduction || explicitlyEnabled;
}

export default function Umami() {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  const baseUrl = process.env.NEXT_PUBLIC_UMAMI_URL;
  // Accept either a full script URL or a base URL; if base, append /script.js
  const scriptUrl =
    baseUrl && baseUrl.endsWith(".js")
      ? baseUrl
      : baseUrl
      ? `${baseUrl.replace(/\/+$/, "")}/script.js`
      : undefined;

  if (!websiteId || !scriptUrl || !shouldEnableAnalytics()) {
    return null;
  }

  return (
    <Script
      src={scriptUrl}
      data-website-id={websiteId}
      strategy="afterInteractive"
    />
  );
}


