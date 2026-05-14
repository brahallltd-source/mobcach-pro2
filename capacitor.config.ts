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
    // الرابط الصحيح للمنصة الجديدة
    url: 'https://gs365cash.com/login',
    allowNavigation: ['gs365cash.com', '*.gs365cash.com'],
    cleartext: true,
  },
};

export default config;