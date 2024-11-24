import {
  Color,
  HalfFloatType,
  MeshDepthMaterial,
  NearestFilter,
  NoBlending,
  RGBADepthPacking,
  ShaderMaterial,
  UniformsUtils,
  WebGLRenderTarget,
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
} from "three";
import {
  Pass,
  FullScreenQuad,
} from "three/examples/jsm/postprocessing/Pass.js";
import { BokehShader } from "three/examples/jsm/shaders/BokehShader.js";

interface BokehPassParams {
  focus?: number;
  aspect?: number;
  aperture?: number;
  maxblur?: number;
}

class BokehPass extends Pass {
  scene: Scene;
  camera: PerspectiveCamera;
  renderTargetDepth: WebGLRenderTarget;
  materialDepth: MeshDepthMaterial;
  materialBokeh: ShaderMaterial;
  uniforms: any;
  fsQuad: FullScreenQuad;
  _oldClearColor: Color;

  constructor(
    scene: Scene,
    camera: PerspectiveCamera,
    params: BokehPassParams = {}
  ) {
    super();

    this.scene = scene;
    this.camera = camera;

    const focus = params.focus !== undefined ? params.focus : 1.0;
    const aspect = params.aspect !== undefined ? params.aspect : camera.aspect;
    const aperture = params.aperture !== undefined ? params.aperture : 0.025;
    const maxblur = params.maxblur !== undefined ? params.maxblur : 1.0;

    // render targets
    this.renderTargetDepth = new WebGLRenderTarget(1, 1, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      type: HalfFloatType,
    });

    this.renderTargetDepth.texture.name = "BokehPass.depth";

    // depth material
    this.materialDepth = new MeshDepthMaterial();
    this.materialDepth.depthPacking = RGBADepthPacking;
    this.materialDepth.blending = NoBlending;

    // bokeh material
    const bokehShader = BokehShader;
    const bokehUniforms = UniformsUtils.clone(bokehShader.uniforms);

    bokehUniforms["tDepth"].value = this.renderTargetDepth.texture;
    bokehUniforms["focus"].value = focus;
    bokehUniforms["aspect"].value = aspect;
    bokehUniforms["aperture"].value = aperture;
    bokehUniforms["maxblur"].value = maxblur;
    bokehUniforms["nearClip"].value = camera.near;
    bokehUniforms["farClip"].value = camera.far;

    this.materialBokeh = new ShaderMaterial({
      defines: Object.assign({}, bokehShader.defines),
      uniforms: bokehUniforms,
      vertexShader: bokehShader.vertexShader,
      fragmentShader: bokehShader.fragmentShader,
    });

    this.uniforms = bokehUniforms;
    this.fsQuad = new FullScreenQuad(this.materialBokeh);
    this._oldClearColor = new Color();
  }

  render(
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget | null,
    readBuffer: WebGLRenderTarget
  ): void {
    // Render depth into texture
    this.scene.overrideMaterial = this.materialDepth;

    renderer.getClearColor(this._oldClearColor);
    const oldClearAlpha = renderer.getClearAlpha();
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    renderer.setClearColor(0xffffff);
    renderer.setClearAlpha(1.0);
    renderer.setRenderTarget(this.renderTargetDepth);
    renderer.clear();
    renderer.render(this.scene, this.camera);

    // Render bokeh composite
    this.uniforms["tColor"].value = readBuffer.texture;
    this.uniforms["nearClip"].value = this.camera.near;
    this.uniforms["farClip"].value = this.camera.far;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      renderer.clear();
      this.fsQuad.render(renderer);
    }

    this.scene.overrideMaterial = null;
    renderer.setClearColor(this._oldClearColor);
    renderer.setClearAlpha(oldClearAlpha);
    renderer.autoClear = oldAutoClear;
  }

  setSize(width: number, height: number): void {
    this.renderTargetDepth.setSize(width, height);
  }

  dispose(): void {
    this.renderTargetDepth.dispose();
    this.materialDepth.dispose();
    this.materialBokeh.dispose();
    this.fsQuad.dispose();
  }
}

export { BokehPass };
