// server/services/pexelsService.js

export async function fetchPexelsImages(query, count = 3) {
  const response = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(
      query
    )}&per_page=${count}`,
    {
      headers: {
        Authorization: process.env.PEXELS_API_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch images from Pexels");
  }

  const data = await response.json();

  return data.photos.map((photo) => ({
    image_url: photo.src.large,
    photographer: photo.photographer,
  }));
}
