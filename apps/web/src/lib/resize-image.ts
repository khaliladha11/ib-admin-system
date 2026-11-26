// Kecilkan foto dari kamera HP sebelum disimpan: sisi terpanjang 1024px, JPEG kualitas 0,8
// (biasanya 100–200 KB), agar IndexedDB tidak cepat penuh.
export const PHOTO_MAX_SIDE = 1024;

export async function resizeImage(file: Blob): Promise<{ data: ArrayBuffer; type: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Foto gagal diproses'));
      },
      'image/jpeg',
      0.8,
    );
  });
  return { data: await blob.arrayBuffer(), type: 'image/jpeg' };
}
