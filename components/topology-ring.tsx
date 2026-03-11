"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

function lerp(start: number, end: number, amount: number) {
  return start * (1 - amount) + end * amount;
}

class TwistedRingCurve extends THREE.Curve<THREE.Vector3> {
  progress: number;
  voiceMorph: number;
  voicePhase: number;

  constructor(progress = 0, voiceMorph = 0, voicePhase = 0) {
    super();
    this.progress = progress;
    this.voiceMorph = voiceMorph;
    this.voicePhase = voicePhase;
  }

  override getPoint(t: number, target = new THREE.Vector3()) {
    const theta = t * Math.PI * 2;
    const radius = 3.5;
    const length = lerp(10, radius, this.progress);
    const twistFactor = lerp(Math.PI, 0, this.progress);
    const circularMorph =
      this.progress > 0.98
        ? Math.sin(theta * 5 + this.voicePhase) * this.voiceMorph
        : 0;
    const warpedLength = length * (1 + circularMorph * 0.08);
    const warpedRadius = radius * (1 + circularMorph * 0.14);

    const x = warpedLength * Math.cos(theta);
    const twistAngle = twistFactor * Math.cos(theta);
    const loopOffset = warpedRadius * Math.sin(theta);
    const y = loopOffset * Math.cos(twistAngle);
    const z = loopOffset * Math.sin(twistAngle);

    return target.set(x, y, z);
  }
}

type TopologyRingProps = {
  active: boolean;
  mode?: "idle" | "listening" | "speaking";
  voiceLevelRef: MutableRefObject<number>;
};

export function TopologyRing({
  active,
  mode = "idle",
  voiceLevelRef,
}: TopologyRingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const modeRef = useRef(mode);

  activeRef.current = active;
  modeRef.current = mode;

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    camera.position.z = 35;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    let ringGeometry = new THREE.TubeGeometry(
      new TwistedRingCurve(0),
      300,
      0.35,
      32,
      true,
    );
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe8d1,
      transparent: true,
      opacity: 0.95,
    });
    const ribbon = new THREE.Mesh(ringGeometry, ringMaterial);
    scene.add(ribbon);

    let frameId = 0;
    let curveProgress = 0;
    let morphAmount = 0;
    let morphPhase = 0;
    let ringScale = 0.34;
    let ringY = 3.7;
    let rotationX = 0;
    let targetRotationX = 0;
    const bootY = 3.7;
    const readyY = 7.9;
    const bootScale = 0.34;
    const readyScale = 0.34;

    const resize = () => {
      if (!containerRef.current) {
        return;
      }

      const { clientWidth, clientHeight } = containerRef.current;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(clientWidth, clientHeight);
    };

    const animate = () => {
      frameId = window.requestAnimationFrame(animate);

      const activeMode = modeRef.current;
      const voiceLevel = Math.min(voiceLevelRef.current * 2.25, 1);
      const targetProgress = activeRef.current ? 1 : 0;
      const targetY = activeRef.current ? readyY : bootY;
      const targetScale = activeRef.current ? readyScale : bootScale;
      const targetMorph =
        !activeRef.current
          ? 0
          : activeMode === "speaking"
            ? 0.1 + voiceLevel * 0.36
            : activeMode === "listening"
              ? 0.055
              : 0;

      curveProgress = lerp(curveProgress, targetProgress, activeRef.current ? 0.06 : 0.12);
      morphAmount = lerp(morphAmount, targetMorph, activeMode === "speaking" ? 0.24 : 0.12);
      morphPhase +=
        activeMode === "speaking"
          ? 0.28 + voiceLevel * 0.42
          : activeMode === "listening"
            ? 0.08
            : 0.03;
      ringY = lerp(ringY, targetY, activeRef.current ? 0.085 : 0.12);
      ringScale = lerp(ringScale, targetScale, 0.1);

      if (!activeRef.current) {
        rotationX -= 0.04;
      } else {
        targetRotationX = Math.round(rotationX / Math.PI) * Math.PI;
        rotationX = lerp(rotationX, targetRotationX, 0.1);
      }

      ringGeometry.dispose();
      ringGeometry = new THREE.TubeGeometry(
        new TwistedRingCurve(curveProgress, morphAmount, morphPhase),
        300,
        0.35,
        32,
        true,
      );
      ribbon.geometry = ringGeometry;

      ringMaterial.opacity =
        activeMode === "speaking"
          ? 0.93 + voiceLevel * 0.09
          : activeMode === "listening"
            ? 0.985
            : activeRef.current
              ? 0.96
              : 0.95;
      ringMaterial.color.set(0xffe8d1);
      ribbon.rotation.x = rotationX;
      ribbon.rotation.y = 0;
      ribbon.rotation.z = 0;
      ribbon.position.y = ringY;
      ribbon.scale.setScalar(ringScale);

      renderer.render(scene, camera);
    };

    resize();
    animate();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(frameId);

      ringGeometry.dispose();
      ringMaterial.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [voiceLevelRef]);

  return <div className="topology-ring" ref={containerRef} aria-hidden="true" />;
}
