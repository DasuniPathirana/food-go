"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, X } from "lucide-react";
import styles from "./ar-reward-view.module.css";

/** Camera is presentation only. No frames are uploaded, and no reward is
 * granted here. Children contain the existing staff-confirmation form. */
export function EncounterCamera({ title, onClose, children, collectible }: {
  title: string; onClose: () => void; children: ReactNode; collectible: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const close = useRef(onClose);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    let active = true;
    let stream: MediaStream | undefined;
    const stop = () => { active = false; stream?.getTracks().forEach(track => track.stop()); if (video.current) video.current.srcObject = null; };
    const hide = () => { if (document.visibilityState === "hidden") { stop(); close.current(); } };
    const node = dialog.current;
    node?.showModal();
    document.addEventListener("visibilitychange", hide);
    const open = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Error("Camera unavailable");
        const result = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!active) { result.getTracks().forEach(track => track.stop()); return; }
        stream = result;
        if (!video.current) { stop(); return; }
        video.current.srcObject = result;
        await video.current.play();
        if (active) setStatus("ready");
      } catch {
        stream?.getTracks().forEach(track => track.stop());
        if (active) setStatus("unavailable");
      }
    };
    void open();
    return () => { stop(); document.removeEventListener("visibilitychange", hide); node?.close(); };
  }, []);
  return <dialog ref={dialog} className={styles.encounterDialog} aria-label="Camera encounter" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className={styles.encounterView}>
      <video ref={video} className={styles.encounterVideo} muted playsInline autoPlay aria-hidden="true"/>
      <div className={styles.hudHeader}><span className={styles.capabilityBadge}><Camera size={14}/> {status === "ready" ? "Camera view" : "Reward view"}</span><button type="button" className={styles.closeButton} aria-label="Close camera" onClick={onClose}><X size={22}/></button></div>
      <div className={styles.encounterCollectible}>{collectible}</div>
      <p className={styles.encounterCameraStatus} role="status">{status === "loading" ? "Requesting camera access..." : status === "ready" ? "Camera overlay. Keep aware of your surroundings." : "Camera unavailable. You can still confirm with staff."}</p>
    </div>
    <div className={styles.encounterConfirmation}><h2>{title}</h2><p>Ask staff for your confirmation code. A camera view alone cannot verify a visit.</p>{children}</div>
  </dialog>;
}
