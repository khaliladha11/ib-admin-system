import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  ApiRequestError,
  LocalValidationError,
  NetworkError,
  NotSignedInError,
  WarningsNeedConfirmation,
} from '@/data';

import { describeError } from './describe-error';
import { ErrorMessage } from './error-message';

describe('describeError', () => {
  it.each([
    [
      new LocalValidationError('x', ['Isi kode straw.']),
      'Data belum bisa disimpan',
      ['Isi kode straw.'],
    ],
    [
      new WarningsNeedConfirmation(['Sapi tercatat bunting.']),
      'Periksa dulu sebelum menyimpan',
      ['Sapi tercatat bunting.'],
    ],
    [new NetworkError(), 'Tidak ada koneksi ke server', []],
    [new NotSignedInError(), 'Anda perlu masuk lagi', []],
    [new ApiRequestError(401, 'UNAUTHENTICATED', 'x'), 'Anda perlu masuk lagi', []],
    [
      new ApiRequestError(403, 'FORBIDDEN', 'Di luar wilayah.'),
      'Anda tidak punya akses untuk ini',
      ['Di luar wilayah.'],
    ],
    [
      new ApiRequestError(422, 'INVALID_EVENT', 'PKB terlalu cepat.'),
      'Server menolak data ini',
      ['PKB terlalu cepat.'],
    ],
    [new ApiRequestError(500, 'INTERNAL_ERROR', 'x'), 'Server sedang bermasalah', ['x']],
    [new Error('boom'), 'Terjadi kesalahan di aplikasi', []],
  ])('%s', (error, title, items) => {
    expect(describeError(error)).toMatchObject({ title, items });
  });

  it('tidak pernah menampilkan pesan teknis dari error tak dikenal', () => {
    expect(JSON.stringify(describeError(new TypeError('undefined is not a function')))).not.toMatch(
      /undefined/,
    );
  });
});

describe('ErrorMessage', () => {
  it('memakai role alert dan tombol Coba lagi bila diberikan', () => {
    render(<ErrorMessage error={new NetworkError()} onRetry={() => undefined} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Tidak ada koneksi ke server');
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
  });
});
