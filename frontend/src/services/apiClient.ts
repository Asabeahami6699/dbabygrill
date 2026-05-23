// frontend/src/services/apiClient.ts
import axios from 'axios';
import {
  getValidToken,
  clearTokenCache,
} from './tokenManager';
import { notifyNetworkError } from '../lib/networkNotifier';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,

  // important for redirects/session persistence
  withCredentials: true,
});

// ========================================
// REQUEST INTERCEPTOR
// ========================================
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await getValidToken();

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        // No session yet — let the request go without auth
        // The response interceptor will handle 401 if needed
        console.warn('[api] no token available, sending unauthenticated');
      }
    } catch (error) {
      console.error('[api] token attach error:', error);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ========================================
// RESPONSE INTERCEPTOR
// ========================================
api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    const isNetworkError =
      !error.response &&
      (error.code === 'ERR_NETWORK' ||
        error.message === 'Network Error' ||
        !navigator.onLine);

    if (isNetworkError) {
      notifyNetworkError(
        navigator.onLine
          ? 'Could not reach the server. Check your connection and try again.'
          : 'No internet connection. Check your network and try again.'
      );
    } else if (error.response?.status === 503 && error.response?.data?.code === 'AUTH_SERVICE_UNAVAILABLE') {
      notifyNetworkError(
        error.response?.data?.error ||
          'Authentication service is temporarily unavailable. Please try again.'
      );
    }

    console.error(
      '[api] response error:',
      error?.response?.status,
      error?.response?.data
    );

    // ========================================
    // DO NOT instantly logout on ONE 401
    // especially after Paystack redirect
    // ========================================
    if (
      error.response?.status === 401 &&
      !originalRequest?._retry
    ) {
      originalRequest._retry = true;

      try {
        // Try getting fresh token again
        const freshToken =
          await getValidToken();

        if (freshToken) {
          originalRequest.headers.Authorization =
            `Bearer ${freshToken}`;

          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error(
          '[api] token refresh failed:',
          refreshError
        );
      }

      // ONLY clear auth if retry also fails
      clearTokenCache();
    }

    return Promise.reject(error);
  }
);