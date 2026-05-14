import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig & { bundledWebRuntime: boolean } = {
  appId: 'com.gosport365.app',
  appName: 'GoSport365',
  webDir: 'public',
  bundledWebRuntime: false,
  server: {
    url: 'https://gosport365.com/login',
    cleartext: true,
  },
};

export default config;
