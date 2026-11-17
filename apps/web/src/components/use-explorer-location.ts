"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { validMapPoint, type MapPoint } from "@/lib/map-game";
import { advanceExplorerLocationMotion, createExplorerLocationMotion, type ExplorerLocationFix } from "@/lib/explorer-location-motion";

type LocationStatus = "manual" | "requesting" | "live" | "denied" | "unavailable" | "error" | "paused";

/** Live coordinates remain in this mounted explorer and start only from enable(). */
export function useExplorerLocation(initial: MapPoint) {
  const [position, setPosition] = useState<MapPoint>(initial);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [walking, setWalking] = useState(false);
  const [distanceMetres, setDistanceMetres] = useState(0);
  const [mode, setMode] = useState<"manual" | "live">("manual");
  const [status, setStatus] = useState<LocationStatus>("manual");
  const [message, setMessage] = useState("Choose a place to position your explorer, or enable live location.");
  const watch = useRef<number | null>(null);
  const generation = useRef(0);
  const motion = useRef(createExplorerLocationMotion());
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    generation.current++;
    if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current);
    watch.current = null;
    if (idleTimer.current !== null) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    motion.current = createExplorerLocationMotion();
  }, []);

  const resetMotion = useCallback(() => {
    setWalking(false); setDistanceMetres(0); setHeading(null);
  }, []);

  const stop = useCallback(() => {
    clear();
    resetMotion();
    setMode("manual"); setStatus("manual"); setAccuracy(null);
    setMessage("Live location is off. Choose a place to position your explorer.");
  }, [clear, resetMotion]);

  const place = useCallback((point: MapPoint) => {
    if (!validMapPoint(point)) return;
    stop(); setPosition(point);
    setMessage("Explorer positioned. Choose a nearby destination and walk its street route.");
  }, [stop]);

  const enable = useCallback(() => {
    clear();
    resetMotion();
    setAccuracy(null);
    if (!window.isSecureContext || !navigator.geolocation) {
      setMode("manual"); setStatus("unavailable");
      setMessage("Live location needs a secure browser connection. You can still choose a place manually.");
      return;
    }
    const request = generation.current;
    setMode("live"); setStatus("requesting"); setMessage("Waiting for your browser's location permission…");
    try {
      const id = navigator.geolocation.watchPosition(fix => {
        if (generation.current !== request) return;
        const point = { longitude: fix.coords.longitude, latitude: fix.coords.latitude };
        if (!validMapPoint(point) || !Number.isFinite(fix.coords.accuracy) || fix.coords.accuracy < 0
          || !Number.isFinite(fix.timestamp) || (motion.current.latest && fix.timestamp <= motion.current.latest.timestamp)) return;
        // The map receives the actual fix. Filtering affects cosmetic walking
        // telemetry only, so routing and accuracy never use an invented point.
        setPosition(point); setAccuracy(fix.coords.accuracy);
        const receivedAt = Date.now();
        const sample: ExplorerLocationFix = { ...point, timestamp: fix.timestamp, accuracy: fix.coords.accuracy,
          heading: fix.coords.heading, speed: fix.coords.speed };
        const next = advanceExplorerLocationMotion(motion.current, sample, receivedAt);
        motion.current = next;
        setHeading(next.heading); setDistanceMetres(next.distanceMetres);
        if (idleTimer.current !== null) clearTimeout(idleTimer.current);
        idleTimer.current = null;
        const remaining = next.walkingUntil - receivedAt;
        setWalking(remaining > 0);
        if (remaining > 0) idleTimer.current = setTimeout(() => {
          if (generation.current !== request) return;
          idleTimer.current = null; setWalking(false);
        }, remaining);
        setStatus("live");
        setMessage(`Live location on. Accuracy about ${Math.max(1, Math.round(fix.coords.accuracy))} metres.`);
      }, failure => {
        if (generation.current !== request) return;
        clear(); resetMotion(); setMode("manual"); setAccuracy(null);
        setStatus(failure.code === 1 ? "denied" : failure.code === 2 ? "unavailable" : "error");
        setMessage(failure.code === 1
          ? "Location permission was declined. Search for a place or choose a point on the map."
          : failure.code === 2
            ? "Your position is unavailable. You can position the explorer manually."
            : "Your position took too long to arrive. Try live location again or choose a place.");
      }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
      if (generation.current === request) watch.current = id;
      else navigator.geolocation.clearWatch(id);
    } catch {
      clear(); resetMotion(); setMode("manual"); setStatus("unavailable");
      setMessage("This browser could not enable location. Search for a place to continue.");
    }
  }, [clear, resetMotion]);

  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState !== "hidden" || watch.current === null) return;
      clear(); resetMotion(); setMode("manual"); setStatus("paused"); setAccuracy(null);
      setMessage("Live location paused while this page was hidden. Enable it again when ready.");
    };
    document.addEventListener("visibilitychange", hidden);
    return () => { document.removeEventListener("visibilitychange", hidden); clear(); };
  }, [clear, resetMotion]);

  return { position, accuracy, heading, walking, distanceMetres, mode, status, message, enable, stop, place };
}
