"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createDeviceCompass, type CompassSample, type CompassState } from "@/lib/device-compass";

export function useDeviceCompass(enabled: boolean) {
  const [state, setState] = useState<CompassState>({ status: "inactive", heading: null, message: "" });
  const adapter = useRef<ReturnType<typeof createDeviceCompass> | null>(null);
  useEffect(() => {
    const Orientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: (absolute?: boolean) => Promise<string> };
    const controller = createDeviceCompass({
      available: typeof Orientation === "function", secure: window.isSecureContext,
      requestPermission: Orientation?.requestPermission ? () => Orientation.requestPermission!.call(Orientation, true) : undefined,
      subscribe(receive) {
        const sample = (event: Event) => receive(event as unknown as CompassSample);
        window.addEventListener("deviceorientation", sample); window.addEventListener("deviceorientationabsolute", sample);
        return () => { window.removeEventListener("deviceorientation", sample); window.removeEventListener("deviceorientationabsolute", sample); };
      }, onChange: setState,
    });
    adapter.current = controller;
    const hidden = () => { if (document.visibilityState === "hidden") controller.stop("paused"); };
    document.addEventListener("visibilitychange", hidden);
    return () => { adapter.current = null; controller.dispose(); document.removeEventListener("visibilitychange", hidden); };
  }, []);
  useEffect(() => { if (!enabled) adapter.current?.stop(); }, [enabled]);
  const start = useCallback(() => { if (enabled) void adapter.current?.start(); }, [enabled]);
  const stop = useCallback(() => adapter.current?.stop(), []);
  return { ...state, start, stop };
}
