import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import type { ApplianceStatus } from "../types/market";

const DESKTOP_STATUS: ApplianceStatus = {
  enabled: false,
  displayActive: true,
  displayPower: "unmanaged",
};
const isTauri = () => "__TAURI_INTERNALS__" in window;

export function useApplianceMode() {
  const [status, setStatus] = useState<ApplianceStatus>(DESKTOP_STATUS);
  const [ready, setReady] = useState(!isTauri());
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: UnlistenFn | undefined;
    void listen<ApplianceStatus>("appliance-status", (event) => {
      if (!disposed) setStatus(event.payload);
    })
      .then((stop) => {
        unlisten = stop;
        return invoke<ApplianceStatus>("get_appliance_status");
      })
      .then((value) => {
        if (!disposed) {
          setStatus(value);
          setReady(true);
        }
      })
      .catch(() => {
        if (!disposed) {
          setStatus(DESKTOP_STATUS);
          setReady(true);
        }
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
  return { status, ready };
}
