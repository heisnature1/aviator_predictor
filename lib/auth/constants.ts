/**
 * Cookie & header names shared by server modules and the browser API client.
 * Kept dependency-free so client bundles never pull in server-only imports.
 */

export const SESSION_COOKIE = 'av_session';
export const CSRF_COOKIE = 'av_csrf';
export const CSRF_HEADER = 'x-csrf-token';
