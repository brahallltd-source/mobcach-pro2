import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig & {
  bundledWebRuntime: boolean;
  server?: {
    url?: string;
    allowNavigation?: string[];
    cleartext?: boolean;
  };
} = {
  appId: 'com.gosport365.app',
  appName: 'GS365 Cash',
  webDir: 'public',
  bundledWebRuntime: false,
  server: {
    url: 'https://gosport365.com/login',
    allowNavigation: ['gosport365.com', '*.gosport365.com'],
    cleartext: true,
  },
};

export default config;
