// Public account identifiers only. The password is checked by Supabase Auth.
// Create this technical account in Supabase Auth; no mailbox is required.
export const OWNER_LOGIN = 'glinamaster';
export const OWNER_AUTH_EMAIL = 'owner@bratsk-ceramics.invalid';

export function resolveLogin(value) {
  if (typeof value !== 'string' || value.trim().toLowerCase() !== OWNER_LOGIN) {
    throw new Error('Неверный логин или пароль.');
  }
  return OWNER_AUTH_EMAIL;
}
