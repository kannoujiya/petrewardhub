// CJS Netlify function with native fetch (Node 18+)
exports.handler = async (event) => {
  try {
    const { s1 = "", s2 = "" } = event.queryStringParameters || {};
    const upstream =
      "https://d1y3y09sav47f5.cloudfront.net/public/offers/feed.php"
      + "?user_id=481160&api_key=89a09f95e53dde3a5e593491e1134540"
      + `&s1=${encodeURIComponent(s1)}&s2=${encodeURIComponent(s2)}`;

    const resp = await fetch(upstream);
    const text = await resp.text();

    let data;
    try { data = JSON.parse(text); }
    catch { data = JSON.parse(text.replace(/^[^(]*\(|\);?$/g, "")); } // strip JSONP if any

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: e.message }) };
  }
};
