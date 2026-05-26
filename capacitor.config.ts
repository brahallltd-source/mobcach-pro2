import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig & {
  bundledWebRuntime: boolean;
  server?: {
    url?: string;
    allowNavigation?: string[];
    cleartext?: boolean;
  };
} = {
  // تحديث معرف التطبيق ليتوافق مع الهوية الجديدة
  appId: 'com.gs365cash.app',
  appName: 'GS365 Cash',
  webDir: 'public',
  bundledWebRuntime: false,
  server: {
    // Keep root domain only to avoid WebView start-route 404s.
    url: 'https://gs365cash.com',
    allowNavigation: ['gs365cash.com', '*.gs365cash.com'],
    cleartext: true,
  },
};

export default config;