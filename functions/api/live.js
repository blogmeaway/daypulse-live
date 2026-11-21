export async function onRequestGet(context) {
  const cf = context.request.cf || {};
  const city = cf.city || "New York";
  const country = cf.country || "US";
  const lat = cf.latitude || "40.7128";
  const lon = cf.longitude || "-74.0060";

  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&daily=sunset&timezone=auto&forecast_days=1`;
    const res = await fetch(weatherUrl);
    const weather = await res.json();

    return new Response(
      JSON.stringify({
        location: { city, country, lat, lon },
        weather
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=900"
        }
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Weather unavailable" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
