"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Sparkles, X, Compass } from "lucide-react";
import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  Scene,
  TorusGeometry,
  WebGLRenderer,
} from "three";
import type { WorldLoot } from "@/lib/world-data";
import styles from "./ar-reward-view.module.css";

export function ARRewardView({
  loot,
  playerLocation,
  signedIn,
  onClose,
  onClaimSuccess,
}: {
  loot: WorldLoot;
  playerLocation: { longitude: number; latitude: number; accuracyMetres: number };
  signedIn: boolean;
  onClose: () => void;
  onClaimSuccess?: (result: { title: string; xpAwarded: number; coinsAwarded: number; claimCode?: string | null }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraState, setCameraState] = useState<"loading" | "ready" | "fallback">("loading");
  const [aimAligned, setAimAligned] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState("");
  const [claimed, setClaimed] = useState<{ xpAwarded: number; coinsAwarded: number; claimCode?: string | null } | null>(null);
  const offsetRef = useRef({ x: 0.45, y: 0.12 });

  // Live rear-camera stream
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("fallback");
      setAimAligned(true);
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(media => {
        if (cancelled) {
          media.getTracks().forEach(t => t.stop());
          return;
        }
        stream = media;
        if (videoRef.current) {
          videoRef.current.srcObject = media;
          void videoRef.current.play().catch(() => {});
        }
        setCameraState("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setCameraState("fallback");
          setAimAligned(true);
        }
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Optional device orientation parallax to align reward into reticle
  useEffect(() => {
    const onOrient = (event: DeviceOrientationEvent) => {
      if (typeof event.gamma !== "number" || typeof event.beta !== "number") return;
      const nx = Math.max(-0.8, Math.min(0.8, event.gamma / 40));
      const ny = Math.max(-0.6, Math.min(0.6, (event.beta - 45) / 40));
      offsetRef.current = { x: nx, y: ny };
      if (Math.hypot(nx, ny) < 0.35) setAimAligned(true);
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, []);

  // WebGL 3D floating reward crystal/crate overlay over camera stream
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      setAimAligned(true);
      return;
    }
    const scene = new Scene();
    const camera = new PerspectiveCamera(50, canvas.clientWidth / Math.max(1, canvas.clientHeight), 0.1, 100);
    camera.position.z = 5.5;

    scene.add(new AmbientLight("#fff9eb", 1.1));
    const keyLight = new DirectionalLight("#ffe082", 1.8);
    keyLight.position.set(3, 5, 6);
    scene.add(keyLight);

    const rig = new Group();
    scene.add(rig);

    const isCrystal = loot.modelStyle === "golden_crystal" || loot.modelStyle === "mystery_ring";
    const core = isCrystal
      ? new Mesh(
          new OctahedronGeometry(1.15, 0),
          new MeshStandardMaterial({
            color: "#ffe46b",
            emissive: "#f59e0b",
            emissiveIntensity: 0.75,
            roughness: 0.15,
            metalness: 0.3,
          })
        )
      : new Mesh(
          new BoxGeometry(1.45, 1.35, 1.45),
          new MeshStandardMaterial({
            color: "#fb923c",
            emissive: "#b45309",
            emissiveIntensity: 0.55,
            roughness: 0.3,
            metalness: 0.25,
          })
        );
    if (isCrystal) core.scale.set(0.85, 1.55, 0.85);
    rig.add(core);

    const ring = new Mesh(
      new TorusGeometry(1.65, 0.06, 10, 40),
      new MeshStandardMaterial({
        color: "#2cf6d8",
        emissive: "#00f0ff",
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.85,
        blending: AdditiveBlending,
      })
    );
    rig.add(ring);

    let raf = 0;
    const start = performance.now();
    const renderFrame = (now: number) => {
      const w = canvas.clientWidth || 360;
      const h = canvas.clientHeight || 480;
      if (canvas.width !== w || canvas.height !== h) {
        renderer.setSize(w, h, false);
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
      }
      const t = (now - start) * 0.001;
      rig.position.x += (offsetRef.current.x * 1.4 - rig.position.x) * 0.12;
      rig.position.y += (Math.sin(t * 2.2) * 0.18 + offsetRef.current.y - rig.position.y) * 0.12;
      core.rotation.y = t * 1.25;
      ring.rotation.x = Math.PI / 2.6 + Math.sin(t * 1.4) * 0.2;
      ring.rotation.z = t * 0.8;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(renderFrame);
    };
    raf = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
    };
  }, [loot.modelStyle]);

  function lockOnReward() {
    offsetRef.current = { x: 0, y: 0 };
    setAimAligned(true);
  }

  async function grabInAr() {
    if (!signedIn || claiming || claimed) return;
    setClaiming(true);
    setError("");
    try {
      const res = await fetch("/api/world/claim", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lootId: loot.id,
          latitude: playerLocation.latitude,
          longitude: playerLocation.longitude,
          arScanConfirmed: true,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Could not collect AR loot right now.");
      setClaimed({
        xpAwarded: payload.xpAwarded,
        coinsAwarded: payload.coinsAwarded,
        claimCode: payload.claimCode ?? null,
      });
      window.dispatchEvent(new Event("food-go:progress"));
      onClaimSuccess?.({
        title: loot.title,
        xpAwarded: payload.xpAwarded,
        coinsAwarded: payload.coinsAwarded,
        claimCode: payload.claimCode ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not collect AR loot.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className={styles.arOverlay} role="dialog" aria-modal="true" aria-label={`AR Camera Grab for ${loot.title}`}>
      <div
        className={styles.cameraViewport}
        onPointerMove={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          const dx = (e.clientX - (rect.left + rect.width / 2)) / rect.width;
          const dy = (e.clientY - (rect.top + rect.height / 2)) / rect.height;
          if (Math.hypot(dx, dy) < 0.25) setAimAligned(true);
        }}
        onClick={lockOnReward}
      >
        <video ref={videoRef} className={styles.videoFeed} playsInline muted style={{ display: cameraState === "ready" ? "block" : "none" }} />
        {cameraState !== "ready" && (
          <div className={styles.simulatedEnvironment}>
            <div className={styles.gridLines} aria-hidden="true" />
          </div>
        )}

        <canvas
          ref={canvasRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 4 }}
        />

        <div className={styles.hudHeader}>
          <span className={styles.capabilityBadge}>
            <Camera size={14} style={{ display: "inline", marginRight: 5 }} />
            {cameraState === "ready" ? "AR Camera Scanner Active" : "AR Spatial Lock Mode"}
          </span>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close AR scanner">
            <X size={20} />
          </button>
        </div>

        <div className={styles.reticle} aria-hidden="true" />
      </div>

      <div className={styles.bottomPanel}>
        <div>
          <h2 className={styles.itemTitle}>{loot.title}</h2>
          <p className={styles.itemDesc}>
            {loot.venueName ? `${loot.venueName} · ` : "Food Go Special Drop · "}
            +{loot.xpReward} XP and +{loot.coinReward} Coins · Tap the floating 3D object to centre and grab it.
          </p>
        </div>

        {error && (
          <p role="alert" style={{ color: "#ffb4a2", margin: 0, fontSize: 13, fontWeight: 700 }}>
            {error}
          </p>
        )}

        {claimed ? (
          <div className={styles.successMessage}>
            <CheckCircle2 size={20} style={{ display: "inline", marginRight: 6 }} />
            Collected +{claimed.xpAwarded} XP and +{claimed.coinsAwarded} Coins!
            {claimed.claimCode ? ` Offer code: ${claimed.claimCode}` : ""}
          </div>
        ) : !signedIn ? (
          <p className={styles.fallbackNotice}>Sign in with a verified account in Explorer Passport to claim AR rewards.</p>
        ) : (
          <button
            type="button"
            className={styles.claimButton}
            disabled={claiming}
            onClick={() => {
              if (!aimAligned) lockOnReward();
              else void grabInAr();
            }}
          >
            {claiming ? (
              "Verifying location & grabbing…"
            ) : !aimAligned ? (
              <>
                <Compass size={18} />
                Centre 3D Reward to Lock On
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Grab in AR (+{loot.xpReward} XP)
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
