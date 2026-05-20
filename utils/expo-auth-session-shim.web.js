// Web shim for expo-auth-session — not supported on web, export no-ops
export const useAuthRequest = () => [null, null, async () => {}];
export const makeRedirectUri = () => '';
export const startAsync = async () => ({ type: 'cancel' });
export const loadAsync = async () => ({});
export default {};
