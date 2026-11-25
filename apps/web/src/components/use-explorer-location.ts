"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { validMapPoint, type MapPoint } from "@/lib/map-game";
import { advanceExplorerLocationMotion, createExplorerLocationMotion, type ExplorerLocationFix } from "@/lib/explorer-location-motion";
import { createLocationFilter, filterExplorerLocation } from "@/lib/explorer-location-filter";

type LocationStatus = "manual" | "requesting" | "live" | "weak" | "denied" | "unavailable" | "error" | "paused";

/** Live coordinates remain in this mounted explorer and start only from enable(). */
export function useExplorerLocation(initial: MapPoint) {
  const [position, setPosition] = useState<MapPoint>(initial);
  const [rawPosition, setRawPosition] = useState<MapPoint | null>(null);
  const [fix, setFix] = useState<ExplorerLocationFix | null>(null);
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
  const filter = useRef(createLocationFilter());
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    setFix(null);
    generation.current++;
    if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current);
    watch.current = null;
    if (idleTimer.current !== null) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    motion.current = createExplorerLocationMotion();
    filter.current = createLocationFilter();
  }, []);

  const resetMotion = useCallback(() => {
    setWalking(false); setDistanceMetres(0); setHeading(null);
  }, []);

  const stop = useCallback(() => {
    clear();
    resetMotion();
    setMode("manual"); setStatus("manual"); setAccuracy(null); setRawPosition(null);
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
    setRawPosition(null);
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
        const receivedAt = Date.now();
        const sample: ExplorerLocationFix = { ...point, timestamp: fix.timestamp, accuracy: fix.coords.accuracy,
          heading: fix.coords.heading, speed: fix.coords.speed };
        const filtered = filterExplorerLocation(filter.current, sample, receivedAt);
        if (filtered === filter.current) return;
        filter.current = filtered;
        // An accuracy circle always describes the actual device fix. The
        // independently stabilised player is cosmetic and cannot prove a visit.
        if (filtered.quality !== "stale") { setRawPosition(point); setAccuracy(fix.coords.accuracy); }
        if (filtered.display) setPosition(filtered.display);
        if (filtered.quality !== "ready") {
          setFix(null);
          motion.current = createExplorerLocationMotion();
          if (idleTimer.current !== null) clearTimeout(idleTimer.current);
          idleTimer.current = null; setWalking(false); setStatus("weak");
          setMessage(filtered.quality === "inaccurate"
            ? "GPS accuracy is low. Keeping your explorer in place until a clearer fix arrives."
            : filtered.quality === "jump" ? "GPS moved unexpectedly. Keeping your explorer in place while the signal settles."
              : "Waiting for a fresh GPS fix. Your explorer is staying in place.");
          return;
        }
        const next = advanceExplorerLocationMotion(motion.current, sample, receivedAt);
        setFix(sample);
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
        clear(); resetMotion(); setMode("manual"); setAccuracy(null); setRawPosition(null);
        setStatus(failure.code === 1 ? "denied" : failure.code === 2 ? "unavailable" : "error");
        setMessage(failure.code === 1
          ? "Location permission was declined. Search for a place or choose a point on the map."
          : failure.code === 2
            ? "Your position is unavailable. You can position the explorer manually."
            : "Your position took too long to arrive. Try live location again or choose a place.");
      }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
      if (generation.current === request) watch.current = id;
      else navigator.geolocation.clearWatch(id);
    } catch {
      clear(); resetMotion(); setMode("manual"); setStatus("unavailable"); setRawPosition(null);
      setMessage("This browser could not enable location. Search for a place to continue.");
    }
  }, [clear, resetMotion]);

  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState !== "hidden" || watch.current === null) return;
      clear(); resetMotion(); setMode("manual"); setStatus("paused"); setAccuracy(null); setRawPosition(null);
      setMessage("Live location paused while this page was hidden. Enable it again when ready.");
    };
    document.addEventListener("visibilitychange", hidden);
    return () => { document.removeEventListener("visibilitychange", hidden); clear(); };
  }, [clear, resetMotion]);

  return { position, rawPosition, fix, accuracy, heading, walking, distanceMetres, mode, status, message, enable, stop, place };
}
