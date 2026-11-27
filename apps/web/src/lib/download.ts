// Unduh teks yang dibuat di perangkat (tanpa server) sebagai file.
export function downloadText(fileName: string, text: string, type: string): void {
  download(fileName, new Blob([text], { type }));
}

/** Unduh byte (mis. file .xlsx yang dibuat di perangkat). */
export function downloadBytes(fileName: string, bytes: Uint8Array, type: string): void {
  download(fileName, new Blob([bytes as Uint8Array<ArrayBuffer>], { type }));
}

function download(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
