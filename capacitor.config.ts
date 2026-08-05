import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.zerosync.app",
  appName: "ZeroSync",
  // The built web assets live here for local fallback use.
  // In production mode we point the WebView at the live server (see below).
  webDir: "dist-spa",
  server: {
    // Route the WebView to the live Cloudflare deployment so all server
    // functions, cookie-based session auth, and API routes work exactly
    // as they do in the browser — no server-side code needed in the APK.
    url: "https://zerosync.pages.dev",
    cleartext: false,
    // Allow navigation within the same origin (prevents WebView from opening
    // external links in a new app instead of in-app).
    androidScheme: "https",
  },
  android: {
    // Allow all <a> links within zerosync.pages.dev to open inside the app.
    allowNavigation: ["*.zerosync.pages.dev"],
    // Respect the system back-gesture for in-app navigation.
    handleApplicationNotifications: true,
  },
  plugins: {
    // Status bar blends with the app's dark background.
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0F0F0F",
    },
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0F0F0F",
      showSpinner: false,
      androidSpinnerStyle: "large",
      spinnerColor: "#ffffff",
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
