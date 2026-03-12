"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";

function lerp(start: number, end: number, amount: number) {
  return start * (1 - amount) + end * amount;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function easeInCubic(value: number) {
  return value * value * value;
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) * (1 - value) * (1 - value);
}

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
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
  activationProgress?: number | null;
  activationUntwistThreshold?: number;
  activationMaxSpinSpeed?: number;
  mode?: "idle" | "listening" | "thinking" | "speaking";
  voiceLevelRef: RefObject<number>;
};

export function TopologyRing({
  active,
  activationProgress = null,
  activationUntwistThreshold = 0.9,
  activationMaxSpinSpeed = 0.34,
  mode = "idle",
  voiceLevelRef,
}: TopologyRingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const activationProgressRef = useRef(activationProgress);
  const activationUntwistThresholdRef = useRef(activationUntwistThreshold);
  const activationMaxSpinSpeedRef = useRef(activationMaxSpinSpeed);
  const modeRef = useRef(mode);

  activeRef.current = active;
  activationProgressRef.current = activationProgress;
  activationUntwistThresholdRef.current = activationUntwistThreshold;
  activationMaxSpinSpeedRef.current = activationMaxSpinSpeed;
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
    const maxPixelRatio = 1.75;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const tubularSegments = 180;
    const radialSegments = 24;
    let ringGeometry = new THREE.TubeGeometry(
      new TwistedRingCurve(0),
      tubularSegments,
      0.35,
      radialSegments,
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
    let ringY = 2.4;
    let rotationX = 0;
    let rotationY = 0;
    let rotationZ = 0;
    let targetRotationX = 0;
    let activationStartedAt: number | null = null;
    let wasActive = activeRef.current;
    let lastGeometryProgress = -1;
    let lastMorphAmount = -1;
    let lastMorphPhase = -1;
    let lastGeometryBuild = 0;
    const bootY = 2.4;
    const readyY = 6.4;
    const twistYOffset = 2.9;
    const bootScale = 0.46;
    const readyScale = 0.34;
    const activationDuration = 1480;

    const resize = () => {
      if (!containerRef.current) {
        return;
      }

      const { clientWidth, clientHeight } = containerRef.current;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
      renderer.setSize(clientWidth, clientHeight);
    };

    const rebuildGeometry = (force = false) => {
      const now = performance.now();
      const buildInterval =
        modeRef.current === "speaking"
          ? 34
          : modeRef.current === "thinking"
            ? 42
            : 52;
      const shouldRebuild =
        Math.abs(curveProgress - lastGeometryProgress) > 0.008 ||
        Math.abs(morphAmount - lastMorphAmount) > 0.012 ||
        Math.abs(morphPhase - lastMorphPhase) > 0.16;

      if (!force && (!shouldRebuild || now - lastGeometryBuild < buildInterval)) {
        return;
      }

      ringGeometry.dispose();
      ringGeometry = new THREE.TubeGeometry(
        new TwistedRingCurve(curveProgress, morphAmount, morphPhase),
        tubularSegments,
        0.35,
        radialSegments,
        true,
      );
      ribbon.geometry = ringGeometry;
      lastGeometryProgress = curveProgress;
      lastMorphAmount = morphAmount;
      lastMorphPhase = morphPhase;
      lastGeometryBuild = now;
    };

    const animate = () => {
      frameId = window.requestAnimationFrame(animate);

      const now = performance.now();
      const externalActivationProgress = activationProgressRef.current;
      const hasExternalActivationProgress =
        externalActivationProgress !== null && externalActivationProgress !== undefined;

      if (!hasExternalActivationProgress && activeRef.current && !wasActive) {
        activationStartedAt = now;
      } else if (!hasExternalActivationProgress && !activeRef.current && wasActive) {
        activationStartedAt = null;
      }

      wasActive = activeRef.current;

      const activeMode = modeRef.current;
      const isThinking = activeMode === "thinking";
      const isListening = activeMode === "listening";
      const isSpeaking = activeMode === "speaking";
      const untwistThreshold = clamp01(activationUntwistThresholdRef.current);
      const maxSpinSpeed = Math.max(activationMaxSpinSpeedRef.current, 0.001);
      const activationLinearProgress =
        hasExternalActivationProgress
          ? clamp01(externalActivationProgress)
          : activeRef.current && activationStartedAt !== null
            ? clamp01((now - activationStartedAt) / activationDuration)
            : activeRef.current
              ? 1
              : 0;
      const isActivating =
        activeRef.current &&
        activationLinearProgress < 1 &&
        (hasExternalActivationProgress || activationStartedAt !== null);
      const voiceReactive = activeRef.current && !isActivating && !isThinking;
      const voiceLevel = clamp01(
        voiceLevelRef.current * (isSpeaking ? 4.8 : isListening ? 2.4 : 2.25),
      );
      const voiceEnergy = Math.pow(voiceLevel, isSpeaking ? 0.7 : 0.96);
      const voiceWave = Math.sin(morphPhase * 0.32 + now * 0.0024) * voiceEnergy;
      const voicePulse =
        voiceReactive && isSpeaking
          ? 0.038 + voiceEnergy * 0.19
          : voiceReactive && isListening
            ? 0.008 + voiceEnergy * 0.045
            : 0;
      const untwistStart = Math.min(untwistThreshold * 0.42, 0.72);
      const untwistSpan = Math.max(1 - untwistStart, 0.001);
      const activationSpinRamp = easeInCubic(
        clamp01(activationLinearProgress / untwistThreshold),
      );
      const activationUntwistWindow = clamp01(
        (activationLinearProgress - untwistStart) / untwistSpan,
      );
      const activationShapeProgress = easeInOutCubic(activationUntwistWindow);
      const activationSpinSlowdown = easeOutCubic(
        clamp01((activationLinearProgress - untwistThreshold) / Math.max(1 - untwistThreshold, 0.001)),
      );
      const targetProgress = !activeRef.current
        ? 0
        : isActivating
          ? activationShapeProgress
          : isThinking
            ? 0.62
            : 1;
      const baseY = activeRef.current ? readyY : bootY;
      const twistOffset = (1 - curveProgress) * twistYOffset;
      const targetY =
        baseY -
        twistOffset +
        (voiceReactive && isSpeaking
          ? -0.2 + voiceWave * 1.46
          : voiceReactive && isListening
            ? -0.03 + voiceWave * 0.36
            : 0);
      const targetScale = !activeRef.current
        ? bootScale
        : isActivating
          ? lerp(bootScale, readyScale, easeOutCubic(activationLinearProgress))
          : readyScale + voicePulse;
      const targetMorph =
        !activeRef.current
          ? 0
          : isActivating
            ? lerp(
                lerp(0.01, 0.036, activationSpinRamp),
                0.008,
                activationSpinSlowdown,
              )
            : isThinking
              ? 0.028
              : voiceReactive && isSpeaking
                ? 0.18 + voiceEnergy * 0.72
                : voiceReactive && isListening
                  ? 0.052 + voiceEnergy * 0.16
                  : 0;

      curveProgress = lerp(
        curveProgress,
        targetProgress,
        isActivating ? 0.14 : isThinking ? 0.085 : activeRef.current ? 0.06 : 0.12,
      );
      morphAmount = lerp(
        morphAmount,
        targetMorph,
        isActivating
          ? 0.18
          : voiceReactive && isSpeaking
            ? 0.34
            : voiceReactive && isListening
              ? 0.16
            : isThinking
              ? 0.16
              : 0.12,
      );
      morphPhase +=
        isActivating
          ? lerp(
              lerp(0.03, maxSpinSpeed, activationSpinRamp),
              0.028,
              activationSpinSlowdown,
            )
          : isThinking
            ? 0.11
            : voiceReactive && isSpeaking
                ? 0.42 + voiceEnergy * 1.08
                : voiceReactive && isListening
                  ? 0.09 + voiceEnergy * 0.14
                  : 0.03;
      ringY = lerp(ringY, targetY, activeRef.current ? 0.085 : 0.12);
      ringScale = lerp(
        ringScale,
        targetScale,
        voiceReactive && isSpeaking ? 0.2 : voiceReactive && isListening ? 0.1 : 0.1,
      );

      if (!activeRef.current) {
        rotationX -= 0.04;
      } else if (isActivating) {
        rotationX -= lerp(
          lerp(0.028, maxSpinSpeed, activationSpinRamp),
          0.018,
          activationSpinSlowdown,
        );
      } else if (isThinking) {
        rotationX -= 0.024;
      } else {
        targetRotationX = Math.round(rotationX / Math.PI) * Math.PI;
        rotationX = lerp(rotationX, targetRotationX, 0.1);
      }

      rotationY = lerp(
        rotationY,
        voiceReactive && isSpeaking
          ? voiceWave * 0.42 + Math.sin(morphPhase * 0.11) * 0.08 * voiceEnergy
          : voiceReactive && isListening
            ? voiceWave * 0.08
            : 0,
        voiceReactive && isSpeaking ? 0.18 : 0.12,
      );
      rotationZ = lerp(
        rotationZ,
        voiceReactive && isSpeaking
          ? Math.sin(morphPhase * 0.2) * 0.22 * voiceEnergy
          : voiceReactive && isListening
            ? Math.sin(morphPhase * 0.16) * 0.03 * voiceEnergy
            : 0,
        voiceReactive && isSpeaking ? 0.16 : 0.1,
      );

      rebuildGeometry();

      ringMaterial.opacity =
        voiceReactive && isSpeaking
          ? 0.94 + voiceEnergy * 0.11
          : isThinking
            ? 0.975
          : voiceReactive && isListening
            ? 0.96 + voiceEnergy * 0.04
            : activeRef.current
              ? 0.96
              : 0.95;
      ringMaterial.color.set(
        voiceReactive && isSpeaking
          ? 0xfff4e8
          : voiceReactive && isListening
            ? 0xffeedc
            : isThinking
              ? 0xfff1df
              : 0xffe8d1,
      );
      ribbon.rotation.x = rotationX;
      ribbon.rotation.y = rotationY;
      ribbon.rotation.z = rotationZ;
      ribbon.position.y = ringY;
      ribbon.scale.setScalar(ringScale);

      renderer.render(scene, camera);
    };

    resize();
    rebuildGeometry(true);
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
