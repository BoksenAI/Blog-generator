// server/services/pexelsService.js
export async function fetchPexelsImages(query, count = 3) {
  console.log("[Pexels] Called fetchPexelsImages()");
  console.log("[Pexels] API key exists:", !!process.env.PEXELS_API_KEY);
  console.log("[Pexels] Query:", query);

  const response = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape&size=large`,
    {
      headers: {
        Authorization: process.env.PEXELS_API_KEY,
      },
    },
  );

  console.log("[Pexels] Status:", response.status);

  const rawText = await response.text();
  console.log(
    "[Pexels] Raw response (first 300 chars):",
    rawText.slice(0, 300),
  );

  if (!response.ok) {
    throw new Error(
      `[Pexels] Failed: ${response.status} ${rawText.slice(0, 300)}`,
    );
  }

  const data = JSON.parse(rawText);

  // IMPORTANT: handle empty results safely
  if (!data.photos || data.photos.length === 0) {
    return [];
  }

  return data.photos.map((photo) => ({
    image_url: photo.src.large2x,
    photographer: photo.photographer,
  }));
}
