import { describe, expect, it } from 'vitest';

import { errorIdOf, fieldA11y } from './a11y';

describe('fieldA11y', () => {
  it('ada error: aria-invalid + aria-describedby ke pesan error', () => {
    expect(fieldA11y('nama', 'Isi nama.')).toEqual({
      'aria-invalid': true,
      'aria-describedby': errorIdOf('nama'),
    });
  });
  it('tanpa error: tidak ada atribut', () => {
    expect(fieldA11y('nama', null)).toEqual({});
  });
});
