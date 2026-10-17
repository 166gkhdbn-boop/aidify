/**
 * Keys whose values are treated as secrets in the JSON viewer
 * (rendered as "••••••" when masking is on).
 */
export const SECRET_MASK_KEYS = [
  "password",
  "passwd",
  "secret",
  "client_secret",
  "token",
  "access_token",
  "refresh_token",
  "api_key",
  "apikey",
  "private_key",
  "privatekey",
];
