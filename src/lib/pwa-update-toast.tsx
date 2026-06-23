import { useEffect } from "react";
import { toast } from "sonner";
import { registerPWA } from "./pwa-register";

export function PWAUpdater() {
  useEffect(() => {
    let activate: (() => Promise<void>) | null = null;
    registerPWA(() => {
      toast("Update available", {
        description: "A new version of ZeroSync is ready.",
        duration: Infinity,
        action: {
          label: "Reload",
          onClick: () => {
            activate?.();
          },
        },
      });
    }).then((fn) => {
      activate = fn;
    });
  }, []);
  return null;
}
