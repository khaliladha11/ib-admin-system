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
  useAnimalTags,
  useScanLookup,
  useScanResult,
  useServerReviews,
  useSyncQueue,
  useQrLabels,
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
  SyncQueueItem,
  SyncQueueView,
  ServerReviewView,
  TimelineEvent,
} from './queries';
export { classifyScanText, type ScanResult } from './scan-lookup';
export type { QrLabelState, QrLabelView, TagView } from './tag-queries';
export type {
  AnimalInput,
  AttachTagInput,
  AnimalPatch,
  EventInput,
  FarmerInput,
  FarmerPatch,
  RecordEventResult,
  Repo,
  ServiceRequestInput,
} from './repo';
export { MAX_NEW_QR_CODES } from './repo';
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
