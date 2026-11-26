// Lapisan data local-first. Komponen memakai hook (baca) dan useRepo() (tulis);
// tidak ada komponen yang memanggil fetch langsung.
export { createDataLayer, type DataLayer, type DataLayerOptions } from './context';
export { IbDb, type Session, type SessionUser, type SyncState } from './db';
export { LocalValidationError, NotSignedInError, WarningsNeedConfirmation } from './errors';
export {
  useAnimal,
  useAnimals,
  useAdminSummary,
  useAnimalPhotoUrl,
  useFarmerViews,
  useFollowUps,
  useInseminatorsFor,
  useLocations,
  useRequestActivity,
  useUsers,
  useAnimalTimeline,
  useEventDefaults,
  useHasPin,
  useServiceRequestViews,
  useDataLayer,
  useFarmers,
  useReminders,
  useRepo,
  useServiceRequests,
  useSession,
  useSyncStatus,
} from './hooks';
export { dismissRejected, type OutboxEntry } from './outbox';
export { isUnlocked, lockApp, unlockApp, useUnlocked } from './lock';
export {
  clearPin,
  hasPin,
  PIN_MAX_FAILURES,
  PIN_PATTERN,
  setPin,
  verifyPin,
  type PinResult,
} from './pin';
export { DataProvider } from './provider';
export type {
  AnimalFilter,
  AnimalTimeline,
  ActivityEntry,
  AdminSummary,
  AnimalView,
  FarmerView,
  FollowUp,
  EventDefaults,
  ServiceRequestView,
  StockView,
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
export { childrenMap, covers, descendantsOf } from './locations';
export {
  assignableRoles,
  createUser,
  resetPassword,
  updateUser,
  type CreateUserInput,
  type UpdateUserInput,
} from './users-api';
export { clearLocalData, signIn, signOut } from './sync/auth';
export type { SyncResult } from './sync/engine';
