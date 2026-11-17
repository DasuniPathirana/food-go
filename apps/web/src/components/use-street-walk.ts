"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LineString } from "geojson";
import { mapDistance, parseStreetRoute, prepareWalk, validMapPoint, walkPosition, type MapPoint, type PreparedWalk } from "@/lib/map-game";

export type WalkPhase = "idle" | "routing" | "walking" | "paused" | "arrived" | "unavailable";

export function useStreetWalk({ start, enabled }: { start: MapPoint; enabled: boolean }) {
  const [position, setPosition] = useState<MapPoint>(start);
  const [route, setRoute] = useState<LineString | null>(null);
  const [phase, setPhase] = useState<WalkPhase>("idle");
  const [heading, setHeading] = useState(0);
  const [travelled, setTravelled] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [sessionMetres, setSessionMetres] = useState(0);
  const [speed, setSpeedState] = useState<1 | 4>(1);
  const [message, setMessage] = useState("");
  const [attribution, setAttribution] = useState("");
  const current = useRef(start);
  const allowed = useRef(enabled);
  const previousMode = useRef(enabled);
  const prepared = useRef<PreparedWalk | null>(null);
  const distance = useRef(0);
  const sessionDistance = useRef(0);
  const request = useRef<AbortController | null>(null);
  const revision = useRef(0);
  allowed.current = enabled;

  const move = useCallback((point: MapPoint) => { current.current = point; setPosition(point); }, []);
  const cancel = useCallback(() => {
    revision.current++; request.current?.abort(); request.current = null;
    prepared.current = null; distance.current = 0;
    setRoute(null); setPhase("idle"); setTravelled(0); setTotalDistance(0); setMessage(""); setAttribution("");
  }, []);
  const place = useCallback((point: MapPoint) => {
    if (!validMapPoint(point)) return;
    cancel(); move(point);
  }, [cancel, move]);

  useEffect(() => {
    if (enabled || previousMode.current !== enabled) cancel();
    previousMode.current = enabled;
    move(start);
  }, [start.longitude, start.latitude, enabled, cancel, move]);
  useEffect(() => () => { request.current?.abort(); }, []);

  const findRoute = useCallback(async (destination: MapPoint, simulate: boolean) => {
    if ((simulate && !allowed.current) || !validMapPoint(destination)) return;
    cancel();
    const origin = current.current;
    if (mapDistance(origin, destination) < 3) {
      setMessage("Choose a destination a little further along the street."); return;
    }
    const controller = new AbortController(), attempt = revision.current;
    request.current = controller;
    setPhase("routing"); setMessage("Finding a walking route…");
    try {
      const query = new URLSearchParams({
        from: `${origin.longitude.toFixed(6)},${origin.latitude.toFixed(6)}`,
        to: `${destination.longitude.toFixed(6)},${destination.latitude.toFixed(6)}`,
      });
      const response = await fetch("/api/map/route?" + query, {
        credentials: "same-origin", cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(18000)]),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const error = response.status === 404 ? "A pedestrian route could not be found here. Try another street."
          : response.status === 429 ? "Walking routes are busy. Wait a moment and try again."
            : response.status === 400 ? "Choose a closer street destination."
              : "Street routing is temporarily unavailable. You can still explore the map.";
        throw new Error(error);
      }
      const parsed = parseStreetRoute(body);
      if (!parsed) throw new Error("The walking route could not be read. Try another destination.");
      const walk = prepareWalk(parsed.geometry);
      if (!walk) throw new Error("Choose a destination further along the street.");
      const firstStep = walkPosition(walk, 0), first = firstStep.point, last = walkPosition(walk, walk.distance).point;
      if (mapDistance(origin, first) > 250 || mapDistance(destination, last) > 250)
        throw new Error("The nearest walkable street is too far from that point. Choose a point on a street.");
      if (attempt !== revision.current || (simulate && !allowed.current)) return;
      prepared.current = walk; distance.current = 0;
      if (simulate) move(first);
      setRoute(parsed.geometry); setTotalDistance(walk.distance); setTravelled(0); setHeading(firstStep.heading); setAttribution(parsed.attribution);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const paused = !simulate || document.visibilityState === "hidden" || reduced;
      setPhase(paused ? "paused" : "walking");
      setMessage(!simulate ? "Walking route ready. Your explorer follows your live position."
        : paused ? "Street route ready. Start walking when ready." : "Following the walking route.");
    } catch (failure) {
      if (controller.signal.aborted || attempt !== revision.current) return;
      setPhase("unavailable");
      setMessage(failure instanceof Error ? failure.message : "Street routing is temporarily unavailable.");
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, [cancel, move]);
  const walkTo = useCallback((point: MapPoint) => findRoute(point, true), [findRoute]);
  const planTo = useCallback((point: MapPoint) => findRoute(point, false), [findRoute]);

  const pause = useCallback(() => {
    setPhase(currentPhase => currentPhase === "walking" ? "paused" : currentPhase);
    setMessage("Street walk paused.");
  }, []);
  const resume = useCallback(() => {
    if (!allowed.current || !prepared.current || distance.current >= prepared.current.distance) return;
    setPhase("walking"); setMessage("Following the walking route.");
  }, []);
  const setSpeed = useCallback((value: 1 | 4) => { if (value === 1 || value === 4) setSpeedState(value); }, []);

  useEffect(() => {
    if (phase !== "walking" || !enabled || !prepared.current) return;
    let frame = 0, previous = 0, published = 0;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const tick = (time: number) => {
      const walk = prepared.current;
      if (!walk) return;
      const elapsed = previous ? Math.min((time - previous) / 1000, 0.25) : 0;
      previous = time;
      const before = distance.current;
      distance.current = Math.min(walk.distance, before + elapsed * 1.4 * speed);
      sessionDistance.current += distance.current - before;
      if (time - published >= (motionPreference.matches ? 300 : 50) || distance.current === walk.distance) {
        const next = walkPosition(walk, distance.current);
        move(next.point); setHeading(next.heading); setTravelled(distance.current);
        setSessionMetres(sessionDistance.current); published = time;
      }
      if (distance.current === walk.distance) {
        setPhase("arrived"); setMessage("Your explorer reached the end of this street route."); return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hidden = () => {
      if (document.visibilityState === "hidden") {
        setPhase("paused"); setMessage("Street walk paused while this page is hidden.");
      }
    };
    const reduceMotion = () => {
      if (motionPreference.matches) {
        cancelAnimationFrame(frame);
        setPhase("paused"); setMessage("Street walk paused for reduced motion. Resume when ready.");
      }
    };
    document.addEventListener("visibilitychange", hidden);
    motionPreference.addEventListener("change", reduceMotion);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", hidden); motionPreference.removeEventListener("change", reduceMotion); };
  }, [phase, enabled, speed, move]);

  return { position, route, phase, heading, travelled, totalDistance, sessionMetres, speed, setSpeed, walkTo, planTo, pause, resume, cancel, place, message, attribution };
}
