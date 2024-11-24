"use client";
import React, { useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "./styles.css";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { BokehPass } from "./shaders/Passes/BokehPass";

import terrainVertexShader from "./shaders/terrain/vertex";
import terrainFragmentShader from "./shaders/terrain/fragment";

// Add interfaces for terrain properties
interface TerrainTexture {
  linesCount: number;
  bigLineWidth: number;
  smallLineWidth: number;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;
  instance: THREE.CanvasTexture;
  update: () => void;
}

interface TerrainProps {
  texture: TerrainTexture;
  geometry: THREE.PlaneGeometry;
  material: THREE.ShaderMaterial;
  mesh: THREE.Mesh;
}

const Terrain: React.FC = () => {
  useEffect(() => {
    // Type the terrain object
    const terrain: Partial<TerrainProps> = {};

    // Canvas
    const canvas = document.querySelector("canvas.webgl") as HTMLCanvasElement;

    // Scene
    const scene = new THREE.Scene();

    // Terrain
    terrain.texture = {} as TerrainTexture;
    terrain.texture.linesCount = 5;
    terrain.texture.bigLineWidth = 0.04;
    terrain.texture.smallLineWidth = 0.01;
    terrain.texture.width = 1;
    terrain.texture.height = 128;
    terrain.texture.canvas = document.createElement("canvas");
    terrain.texture.canvas.width = terrain.texture.width;
    terrain.texture.canvas.height = terrain.texture.height;
    terrain.texture.canvas.style.position = "fixed";
    terrain.texture.canvas.style.top = "0";
    terrain.texture.canvas.style.left = "0";
    terrain.texture.canvas.style.zIndex = "1";
    document.body.append(terrain.texture.canvas);

    terrain.texture.context = terrain.texture.canvas.getContext("2d");

    terrain.texture.instance = new THREE.CanvasTexture(terrain.texture.canvas);
    terrain.texture.instance.wrapS = THREE.RepeatWrapping;
    terrain.texture.instance.wrapT = THREE.RepeatWrapping;

    terrain.texture.update = () => {
      if (!terrain.texture?.context) return;
      terrain.texture.context.clearRect(
        0,
        0,
        terrain.texture.width,
        terrain.texture.height
      );

      // Big Lines
      const actualBigLineWidth = Math.round(
        terrain.texture.height * terrain.texture.bigLineWidth
      );
      terrain.texture.context.globalAlpha = 1;
      terrain.texture.context.fillStyle = "#ffffff";
      terrain.texture.context.fillRect(
        0,
        0,
        terrain.texture.width,
        actualBigLineWidth
      );

      // Small lines
      const actualSmallLineWidth = Math.round(
        terrain.texture.height * terrain.texture.smallLineWidth
      );
      const smallLinesCount = terrain.texture.linesCount - 1;

      for (let i = 0; i < smallLinesCount; i++) {
        terrain.texture.context.globalAlpha = 0.5;
        terrain.texture.context.fillRect(
          0,
          actualBigLineWidth +
            Math.round(
              (terrain.texture.height - actualBigLineWidth) /
                terrain.texture.linesCount
            ) *
              (i + 1),
          terrain.texture.width,
          actualSmallLineWidth
        );
      }
    };
    terrain.texture.update();

    // Geometry
    terrain.geometry = new THREE.PlaneGeometry(1, 1, 1000, 1000);
    terrain.geometry.rotateX(-Math.PI * 0.5);

    // Material
    terrain.material = new THREE.ShaderMaterial({
      transparent: true,
      vertexShader: terrainVertexShader,
      fragmentShader: terrainFragmentShader,
      uniforms: {
        uTexture: { value: terrain.texture.instance },
        uElevation: { value: 2 },
        uTextureFrequency: { value: 10.0 },
        uTime: { value: 0 },
      },
    });

    // Mesh
    terrain.mesh = new THREE.Mesh(terrain.geometry, terrain.material);
    terrain.mesh.scale.set(10, 10, 10);
    scene.add(terrain.mesh);

    // Sizes
    const sizes = {
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: Math.min(window.devicePixelRatio, 2),
    };

    const handleResize = (): void => {
      sizes.width = window.innerWidth;
      sizes.height = window.innerHeight;
      sizes.pixelRatio = Math.min(window.devicePixelRatio, 2);

      // Update camera
      camera.aspect = sizes.width / sizes.height;
      camera.updateProjectionMatrix();

      // Update renderer
      renderer.setSize(sizes.width, sizes.height);
      renderer.setPixelRatio(sizes.pixelRatio);

      // Update effect composer
      effectComposer.setSize(sizes.width, sizes.height);
      effectComposer.setPixelRatio(sizes.pixelRatio);

      // Update passes
      bokehPass.renderTargetDepth.width = sizes.width * sizes.pixelRatio;
      bokehPass.renderTargetDepth.height = sizes.height * sizes.pixelRatio;
    };

    window.addEventListener("resize", handleResize);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      sizes.width / sizes.height,
      0.1,
      100
    );
    camera.position.set(1, 1, 1);
    scene.add(camera);

    // Controls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = false;
    controls.enabled = false;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
    });
    renderer.setClearColor(0x080024, 1);
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Effect composer
    const renderTarget = new THREE.WebGLMultipleRenderTargets(800, 600);
    const effectComposer = new EffectComposer(renderer);
    effectComposer.setSize(sizes.width, sizes.height);
    effectComposer.setPixelRatio(sizes.pixelRatio);
    // effectComposer.enabled = false;

    // Render pass
    const renderPass = new RenderPass(scene, camera);
    effectComposer.addPass(renderPass);

    // Bokeh pass
    const bokehPass = new BokehPass(scene, camera, {
      focus: 1.0,
      aperture: 0.025,
      maxblur: 0.01,
      width: sizes.width,
      height: sizes.height,
    });
    effectComposer.addPass(bokehPass);

    // Animate
    const clock = new THREE.Clock();

    const tick = (): void => {
      const elapsedTime = clock.getElapsedTime();

      // Update controls
      controls.update();

      // Update terrain
      if (terrain.material?.uniforms) {
        terrain.material.uniforms.uTime.value = elapsedTime;
      }

      // Render
      effectComposer.render();

      // Call tick again on the next frame
      window.requestAnimationFrame(tick);
    };

    tick();

    // Cleanup when component unmounts
    return () => {
      window.removeEventListener("resize", handleResize);
      terrain.geometry?.dispose();
      terrain.material?.dispose();
      if (terrain.texture?.instance) {
        terrain.texture.instance.dispose();
      }
    };
  }, []);

  return <canvas className="webgl" />;
};

export default Terrain;
