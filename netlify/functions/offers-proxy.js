// ✅ Serverless function to fetch AdBlue offers safely (no CORS / JSONP issues)
import fetch from "node-fetch";

export async function handler(event) {
  const url =
    "https://d1y3y09sav47f5.cloudfront.net/public/offers/feed.php?user_id=481160&api_key=89a09f95e53dde3a5e593491e1134540&s1=&s2=";

  try {
    const response = await fetch(url);
    const text = await response.text();

    // Try to convert JSON-like response to valid JSON if needed
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // sometimes CloudFront returns JSONP, so clean it
      data = JSON.parse(text.replace(/^[^(]*\(|\);?$/g, ""));
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error("Offer proxy error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
