// Atribut aksesibilitas untuk isian form: tandai tidak valid dan tautkan ke pesan errornya,
// agar pembaca layar membacakan "tidak valid" beserta alasannya.
export const errorIdOf = (fieldId: string) => `${fieldId}-error`;

export function fieldA11y(
  fieldId: string,
  error: string | null | undefined,
): { 'aria-invalid'?: true; 'aria-describedby'?: string } {
  return error ? { 'aria-invalid': true, 'aria-describedby': errorIdOf(fieldId) } : {};
}
