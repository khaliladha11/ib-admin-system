// Error dari lapisan data lokal. Pesannya siap ditampilkan ke pengguna (Bahasa Indonesia).

/** Data tidak valid, atau melanggar aturan yang sama dengan server (setara 400/403/404/422). */
export class LocalValidationError extends Error {
  override readonly name = 'LocalValidationError';
  constructor(
    message: string,
    readonly issues: string[] = [message],
  ) {
    super(message);
  }
}

/** Ada peringatan; ulangi dengan `confirmWarnings: true` bila data sudah benar (setara 409 server). */
export class WarningsNeedConfirmation extends Error {
  override readonly name = 'WarningsNeedConfirmation';
  constructor(readonly warnings: string[]) {
    super('Periksa peringatan, lalu simpan lagi bila data sudah benar.');
  }
}

/** Belum ada sesi tersimpan di perangkat ini. */
export class NotSignedInError extends Error {
  override readonly name = 'NotSignedInError';
  constructor() {
    super('Silakan masuk terlebih dahulu.');
  }
}

/** Ubah ZodError menjadi LocalValidationError dengan pesan per kolom. */
export function fromZodIssues(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const messages = issues.map((i) =>
    i.path.length > 0 ? `${i.path.map(String).join('.')}: ${i.message}` : i.message,
  );
  return new LocalValidationError(messages.join(' '), messages);
}
