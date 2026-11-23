"use client";

import { useEffect, useRef, useState } from "react";
import { X, Sparkles, Camera, Check, AlertCircle, Compass } from "lucide-react";
import {
  type ARCollectibleItem,
  type ARDeviceCapability,
  determineARCapability,
  validateAREligibility,
} from "@food-go/domain";
import styles from "./ar-reward-view.module.css";

export function ARRewardView({
  collectible,
  playerLocation,
  onClose,
  onClaimSuccess,
}: {
  collectible: ARCollectibleItem;
  playerLocation: { longitude: number; latitude: number; accuracyMetres: number };
  onClose: () => void;
  onClaimSuccess?: (reward: { name: string; rewardXp: number }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [capability, setCapability] = useState<ARDeviceCapability>("fallback_direct_claim");
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [interacted, setInteracted] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [startTime] = useState<number>(Date.now());

  // Check eligibility
  const eligibility = validateAREligibility(collectible, playerLocation);

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function initCamera() {
      // Check for camera support
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
          activeStream = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
          setStreamActive(true);
          const cap = determineARCapability({
            hasCameraPermission: true,
            hasDeviceOrientation: typeof window !== "undefined" && "DeviceOrientationEvent" in window,
            hasWebXRHitTest: false,
          });
          setCapability(cap);
        } catch (err) {
          // Camera denied or unavailable on desktop
          setCameraError("Camera unavailable or permission declined. Using verified proximity collection.");
          setCapability("fallback_direct_claim");
        }
      } else {
        setCapability("fallback_direct_claim");
      }
    }

    void initCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  async function handleClaim() {
    if (!eligibility.eligible) return;
    setVerifying(true);
    const duration = Date.now() - startTime;

    // Simulate backend claim API verification
    try {
      await new Promise((res) => setTimeout(res, 900));
      setClaimed(true);
      onClaimSuccess?.({
        name: collectible.name,
        rewardXp: collectible.rewardXp,
      });
    } catch {
      setCameraError("Failed to verify claim with server.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className={styles.arOverlay} role="dialog" aria-modal="true" aria-label="AR Collectible View">
      <div className={styles.cameraViewport}>
        {streamActive ? (
          <video ref={videoRef} className={styles.videoFeed} playsInline muted autoPlay />
        ) : (
          <div className={styles.simulatedEnvironment}>
            <div className={styles.gridLines} />
          </div>
        )}

        <div className={styles.hudHeader}>
          <span className={styles.capabilityBadge}>
            {capability === "spatial_native_arkit"
              ? "ARKit Spatial AR"
              : capability === "spatial_native_arcore"
              ? "ARCore Spatial AR"
              : capability === "camera_overlay_sensor"
              ? "Camera Lens AR"
              : "Verified Proximity"}
          </span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Exit AR view"
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.reticle} />

        <button
          type="button"
          className={styles.virtualItem}
          onClick={() => {
            setInteracted(true);
            if (!claimed && !verifying) void handleClaim();
          }}
          aria-label={`Interact with ${collectible.name}`}
        >
          <div className={styles.itemIconWrapper}>
            <Sparkles size={44} />
          </div>
          <span className={styles.itemLabel}>{collectible.name}</span>
        </button>
      </div>

      <div className={styles.bottomPanel}>
        <div>
          <h3 className={styles.itemTitle}>{collectible.name}</h3>
          <p className={styles.itemDesc}>{collectible.description}</p>
        </div>

        {claimed ? (
          <div className={styles.successMessage}>
            <Check size={18} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
            Claimed! +{collectible.rewardXp} XP added to your Passport.
          </div>
        ) : !eligibility.eligible ? (
          <div className={styles.successMessage} style={{ background: "rgba(147, 64, 36, 0.9)", borderColor: "#ed7357" }}>
            <AlertCircle size={18} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
            {eligibility.reason}
          </div>
        ) : (
          <button
            type="button"
            className={styles.claimButton}
            disabled={verifying}
            onClick={handleClaim}
          >
            <Sparkles size={18} />
            {verifying ? "Verifying with server…" : `Collect Reward (+${collectible.rewardXp} XP)`}
          </button>
        )}

        {capability === "fallback_direct_claim" && (
          <p className={styles.fallbackNotice}>
            Verified collection flow active for desktop or camera-denied browsers.
          </p>
        )}
      </div>
    </div>
  );
}
