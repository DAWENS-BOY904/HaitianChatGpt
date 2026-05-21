import { Linking } from 'react-native';

export const openBrowserAsync = async (url: string, _options?: object) => {
  try {
    await Linking.openURL(url);
    return { type: 'opened' as const };
  } catch (_e) {
    return { type: 'cancel' as const };
  }
};

export const dismissBrowser = () => {};

export default { openBrowserAsync, dismissBrowser };
