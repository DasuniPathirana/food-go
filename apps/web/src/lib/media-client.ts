"use client";

export type MediaScope = "community" | "venue" | "dish" | "promotion";

/** Resizes images client-side into lightweight WebP/JPEG payloads before uploading through /api/media. */
export async function uploadImageAsset(file: File, scope: MediaScope): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPEG, PNG or WebP image file.");
  }

  const bitmap = await createImageBitmap(file);
  const maxDim = scope === "community" ? 1280 : 1400;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height, 1));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not process this photo.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/webp", 0.82);
  const useJpeg = !dataUrl.startsWith("data:image/webp");
  const encodedUrl = useJpeg ? canvas.toDataURL("image/jpeg", 0.82) : dataUrl;
  const contentType = useJpeg ? "image/jpeg" : "image/webp";
  const base64 = encodedUrl.split(",")[1] ?? "";

  if (!base64 || base64.length > 1300000) {
    throw new Error("Image is too large after compression. Try a smaller photo.");
  }

  const response = await fetch("/api/media", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope, contentType, base64 }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.url) {
    throw new Error(payload?.error || "Photo upload failed. Please sign in and try again.");
  }
  return String(payload.url);
}
