// Salin teks ke papan klip. navigator.clipboard butuh HTTPS/localhost; selain itu pakai cara lama.
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- cadangan untuk HTTP biasa
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}
