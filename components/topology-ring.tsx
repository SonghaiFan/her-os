"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

function lerp(start: number, end: number, amount: number) {
  return start * (1 - amount) + end * amount;
}

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

class TwistedRingCurve extends THREE.Curve<THREE.Vector3> {
  progress: number;

  constructor(progress = 0) {
    super();
    this.progress = progress;
  }

  override getPoint(t: number, target = new THREE.Vector3()) {
    const theta = t * Math.PI * 2;
    const radius = 3.5;
    const length = lerp(10, radius, this.progress);
    const twistFactor = lerp(Math.PI, 0, this.progress);

    const x = length * Math.cos(theta);
    const twistAngle = twistFactor * Math.cos(theta);
    const y = radius * Math.sin(theta) * Math.cos(twistAngle);
    const z = radius * Math.sin(theta) * Math.sin(twistAngle);

    return target.set(x, y, z);
  }
}

type TopologyRingProps = {
  active: boolean;
  phase: "idle" | "booting" | "ready";
  mode?: "idle" | "listening" | "speaking";
};

export function TopologyRing({
  active,
  phase,
  mode = "idle",
}: TopologyRingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const phaseRef = useRef(phase);
  const modeRef = useRef(mode);

  activeRef.current = active;
  phaseRef.current = phase;
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
    let transitionProgress = 0;
    let collapseStarted = false;
    let targetRotationX = 0;

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
      const currentPhase = phaseRef.current;
      const intensity =
        activeMode === "speaking" ? 1.08 : activeMode === "listening" ? 1.04 : 1;
      const targetY = currentPhase === "ready" ? 7.9 : 3.7;
      const baseScale = currentPhase === "ready" ? 0.55 : 0.32;

      ringMaterial.opacity = 0.95;
      ringMaterial.color.set(
        activeMode === "speaking"
          ? 0xfff2e3
          : activeMode === "listening"
            ? 0xffead7
            : 0xffe8d1,
      );

      if (!activeRef.current) {
        ribbon.rotation.x -= 0.04;
        ribbon.rotation.y = 0;
        ribbon.rotation.z = 0;
        ribbon.position.y = lerp(ribbon.position.y, targetY, 0.12);
        ribbon.scale.setScalar(lerp(ribbon.scale.x, baseScale, 0.12));
      } else {
        if (!collapseStarted) {
          collapseStarted = true;
          targetRotationX = Math.round(ribbon.rotation.x / Math.PI) * Math.PI;
        }

        if (transitionProgress < 1) {
          transitionProgress = Math.min(1, transitionProgress + 0.0135);
          const easedProgress = easeInOutCubic(transitionProgress);

          ringGeometry.dispose();
          ringGeometry = new THREE.TubeGeometry(
            new TwistedRingCurve(easedProgress),
            300,
            0.35,
            32,
            true,
          );
          ribbon.geometry = ringGeometry;

          ribbon.rotation.x = lerp(ribbon.rotation.x, targetRotationX, 0.1);
          ribbon.rotation.y = 0;
          ribbon.rotation.z = 0;
          ribbon.position.y = lerp(ribbon.position.y, targetY, 0.085);
          ribbon.scale.setScalar(lerp(ribbon.scale.x, baseScale * intensity, 0.1));
        } else {
          ribbon.position.y = targetY;
          ribbon.rotation.y = 0;
          ribbon.rotation.z = 0;
          ribbon.scale.setScalar(baseScale * intensity);
        }
      }

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
  }, []);

  return <div className="topology-ring" ref={containerRef} aria-hidden="true" />;
}
