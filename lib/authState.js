// Shared path for the saved customer session (storageState). Per-theme so runs
// never collide. auth.setup.js writes it once; 06_account_auth.spec.js reuses it.
export const AUTH_STATE = `runs/${process.env.THEME_ID || 'default'}/.auth/state.json`;
