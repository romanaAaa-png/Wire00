import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.doublevpn.manager',
  appName: 'Double Tunnel VPN',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
