// Lapisan data local-first. Komponen memakai hook (baca) dan useRepo() (tulis);
// tidak ada komponen yang memanggil fetch langsung.
export { createDataLayer, type DataLayer, type DataLayerOptions } from './context';
export { IbDb, type Session, type SessionUser, type SyncState } from './db';
export { LocalValidationError, NotSignedInError, WarningsNeedConfirmation } from './errors';
export {
  useAnimal,
  useAnimals,
  useAnimalTimeline,
  useDataLayer,
  useFarmers,
  useReminders,
  useRepo,
  useServiceRequests,
  useSession,
  useSyncStatus,
} from './hooks';
export { dismissRejected, type OutboxEntry } from './outbox';
export { DataProvider } from './provider';
export type {
  AnimalFilter,
  AnimalTimeline,
  AnimalView,
  ReminderView,
  ServiceRequestFilter,
  SyncStatusView,
  TimelineEvent,
} from './queries';
export type {
  AnimalInput,
  AnimalPatch,
  EventInput,
  FarmerInput,
  FarmerPatch,
  RecordEventResult,
  Repo,
  ServiceRequestInput,
} from './repo';
export { ApiRequestError, NetworkError } from './sync/api';
export { clearLocalData, signIn, signOut } from './sync/auth';
export type { SyncResult } from './sync/engine';
