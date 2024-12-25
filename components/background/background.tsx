"use client";

import React, { useEffect, useCallback, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { BokehPass } from "./shaders/Passes/BokehPass";
import terrainVertexShader from "./shaders/terrain/vertex";
import terrainFragmentShader from "./shaders/terrain/fragment";
import "./styles.css";

interface TerrainConfig {
  geometry: {
    segments: number;
  };
  texture: {
    linesCount: number;
    bigLineWidth: number;
    smallLineWidth: number;
    width: number;
    height: number;
  };
}

const Terrain: React.FC = () => {
  // Memoize configurations
  const terrainConfig = useMemo<TerrainConfig>(
    () => ({
      geometry: {
        segments: 500, // Reduced for better performance
      },
      texture: {
        linesCount: 5,
        bigLineWidth: 0.04,
        smallLineWidth: 0.01,
        width: 1,
        height: 128,
      },
    }),
    []
  );

  const createTerrainTexture = useCallback((config: TerrainConfig) => {
    if (typeof document === 'undefined') return null;

    const canvas = document.createElement("canvas");
    canvas.width = config.texture.width;
    canvas.height = config.texture.height;
    const context = canvas.getContext("2d");

    if (!context) return null;

    // Create texture
    const actualBigLineWidth = Math.round(
      config.texture.height * config.texture.bigLineWidth
    );
    context.globalAlpha = 1;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, config.texture.width, actualBigLineWidth);

    // Small lines
    const actualSmallLineWidth = Math.round(
      config.texture.height * config.texture.smallLineWidth
    );
    const smallLinesCount = config.texture.linesCount - 1;

    for (let i = 0; i < smallLinesCount; i++) {
      context.globalAlpha = 0.5;
      context.fillRect(
        0,
        actualBigLineWidth +
          Math.round(
            (config.texture.height - actualBigLineWidth) /
              config.texture.linesCount
          ) *
            (i + 1),
        config.texture.width,
        actualSmallLineWidth
      );
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    return texture;
  }, []);

  const initScene = useCallback(() => {
    if (typeof document === 'undefined') return null;

    const canvas = document.querySelector("canvas.webgl") as HTMLCanvasElement;
    const scene = new THREE.Scene();

    // Optimize renderer settings
    const renderer = new THREE.WebGLRenderer({
      canvas,
      powerPreference: "high-performance",
      antialias: false,
      precision: "mediump",
      alpha: false,
    });

    renderer.setClearColor(0x080024, 1);
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));

    // Create and optimize geometry
    const geometry = new THREE.PlaneGeometry(
      1,
      1,
      terrainConfig.geometry.segments,
      terrainConfig.geometry.segments
    );
    geometry.rotateX(-Math.PI * 0.5);
    geometry.computeBoundingSphere();

    const texture = createTerrainTexture(terrainConfig);

    // Create material
    const material = new THREE.ShaderMaterial({
      transparent: true,
      vertexShader: terrainVertexShader,
      fragmentShader: terrainFragmentShader,
      uniforms: {
        uTexture: { value: texture },
        uElevation: { value: 2 },
        uTextureFrequency: { value: 10.0 },
        uTime: { value: 0 },
      },
    });

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(10, 10, 10);
    scene.add(mesh);

    return { scene, renderer, geometry, material, mesh, texture };
  }, [terrainConfig, createTerrainTexture]);

  useEffect(() => {
    const sceneData = initScene();
    if (!sceneData) return;

    const { scene, renderer, geometry, material, mesh, texture } = sceneData;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0.5, 0.5, 0.5);
    scene.add(camera);

    // Add OrbitControls here
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Smooth camera movement
    controls.dampingFactor = 0.05; // Adjust damping speed
    controls.enableZoom = true; // Enable zoom
    controls.minDistance = 1; // Minimum zoom distance
    controls.maxDistance = 10; // Maximum zoom distance
    controls.enablePan = true; // Enable panning
    controls.autoRotate = false; // Optional: Auto-rotate camera

    // Then update the animation loop to include controls update

    // Effect composer setup
    const effectComposer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    const bokehPass = new BokehPass(scene, camera, {
      focus: 1.0,
      aperture: 0.025,
      maxblur: 0.01,
    });

    effectComposer.addPass(renderPass);
    effectComposer.addPass(bokehPass);

    // Animation variables
    let frameId: number;
    let lastTime = 0;
    const interval = 1000 / 30; // Cap at 30 FPS
    const clock = new THREE.Clock();

    // Handle resize
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const pixelRatio = Math.min(window.devicePixelRatio, 1.5);

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
      renderer.setPixelRatio(pixelRatio);

      effectComposer.setSize(width, height);
      effectComposer.setPixelRatio(pixelRatio);
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    // Animation loop
    const animate = (currentTime: number) => {
      frameId = requestAnimationFrame(animate);

      const deltaTime = currentTime - lastTime;

      if (deltaTime > interval) {
        lastTime = currentTime - (deltaTime % interval);

        if (typeof document !== 'undefined' && !document.hidden) {
          const elapsedTime = clock.getElapsedTime();
          if (material.uniforms) {
            material.uniforms.uTime.value = elapsedTime;
          }
          effectComposer.render();
        }
      }
    };

    animate(0);

    // Cleanup
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      geometry.dispose();
      material.dispose();
      texture?.dispose();
      renderer.dispose();
      controls.dispose();
      scene.remove(mesh);
    };
  }, [initScene]);

  return <canvas className="webgl" />;
};

export default Terrain;