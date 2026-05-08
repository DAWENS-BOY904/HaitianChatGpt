/**
 * Web shim for react-native-purchases.
 * This module is substituted on the web platform so the bundler
 * does not try to resolve the native-only package.
 */

const LOG_LEVEL = {
  VERBOSE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  SILENT: 5,
};

const PURCHASE_TYPE = {
  INAPP: 'inapp',
  SUBS: 'subs',
};

const INTRO_ELIGIBILITY_STATUS = {
  INTRO_ELIGIBILITY_STATUS_UNKNOWN: 0,
  INTRO_ELIGIBILITY_STATUS_INELIGIBLE: 1,
  INTRO_ELIGIBILITY_STATUS_ELIGIBLE: 2,
};

const Purchases = {
  configure: (_params: any) => {
    console.warn('[Purchases] react-native-purchases is not available on web.');
  },
  getOfferings: async () => {
    console.warn('[Purchases] react-native-purchases is not available on web.');
    return { current: null, all: {} };
  },
  purchasePackage: async (_pkg: any) => {
    throw new Error('react-native-purchases is not available on web.');
  },
  restorePurchases: async () => {
    throw new Error('react-native-purchases is not available on web.');
  },
  getCustomerInfo: async () => {
    throw new Error('react-native-purchases is not available on web.');
  },
  setLogLevel: (_level: any) => {},
  isConfigured: false,
  LOG_LEVEL,
  PURCHASE_TYPE,
  INTRO_ELIGIBILITY_STATUS,
};

export { LOG_LEVEL, PURCHASE_TYPE, INTRO_ELIGIBILITY_STATUS };
export default Purchases;
