// frontend/src/api/authToken.ts
//
// Single source of truth for token caching.
// Re-exports everything from tokenManager so that AuthContext (which imports
// from here) and apiClient (which imports from tokenManager) share the
// exact same cache state. Previously they were two separate module instances,
// meaning clearTokenCache() in one didn't clear the other — causing stale
// tokens from a previous user to be sent after switching accounts.

export {
  getValidToken,
  clearTokenCache,
  primeTokenCache,
} from '../services/tokenManager';