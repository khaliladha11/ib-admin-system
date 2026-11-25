import type { ESTRUS_SIGNS } from '@ib/shared';

export const EVENT_FORM_TYPES = ['BH', 'IB', 'PKB', 'BB'] as const;
export type EventFormType = (typeof EVENT_FORM_TYPES)[number];

export const TYPE_LABEL: Record<EventFormType, string> = {
  BH: 'Birahi',
  IB: 'IB',
  PKB: 'PKB',
  BB: 'Berat',
};

export const SIGN_LABEL: Record<(typeof ESTRUS_SIGNS)[number], string> = {
  lendir_bening: 'Keluar lendir bening',
  gelisah: 'Gelisah, sering melenguh',
  menaiki_sapi_lain: 'Menaiki sapi lain',
  diam_dinaiki: 'Diam saat dinaiki',
  vulva_bengkak: 'Vulva bengkak dan merah',
  nafsu_makan_turun: 'Nafsu makan turun',
};
