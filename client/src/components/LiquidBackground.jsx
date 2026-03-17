import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// VERTEX SHADER
// ─────────────────────────────────────────────────────────────────────────────
const VERTEX_SHADER = /* glsl */`
  uniform float uTime;
  uniform vec2  uMouse;

  varying vec2  vUv;
  varying float vElevation;
  varying vec3  vNormal;

  // ── Simplex 3D noise ─────────────────────────
  vec3 mod289v3(vec3 x){ return x-floor(x*(1./289.))*289.; }
  vec4 mod289v4(vec4 x){ return x-floor(x*(1./289.))*289.; }
  vec4 permute(vec4 x){ return mod289v4(((x*34.)+1.)*x); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159-0.85373472095314*r; }
  float snoise(vec3 v){
    const vec2 C=vec2(1./6.,1./3.);
    const vec4 D=vec4(0.,.5,1.,2.);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
    i=mod289v3(i);
    vec4 p=permute(permute(permute(
      i.z+vec4(0.,i1.z,i2.z,1.))
      +i.y+vec4(0.,i1.y,i2.y,1.))
      +i.x+vec4(0.,i1.x,i2.x,1.));
    float n_=.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
    vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.;
    vec4 sh=-step(h,vec4(0.));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
    vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
    m=m*m;
    return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
  // ─────────────────────────────────────────────

  // 3-octave fbm — smooth, no high-frequency chop
  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    v += a * snoise(p); p = p * 2.1 + vec3( 1.7,  9.2, 0.0); a *= 0.5;
    v += a * snoise(p); p = p * 2.1 + vec3(-4.1,  6.7, 0.0); a *= 0.5;
    v += a * snoise(p);
    return v;
  }

  // Single-pass domain-warped height — organic but not rough
  float liquidHeight(float px, float py) {
    vec3 base = vec3(px * 0.38, py * 0.38, uTime * 0.06);
    // One warp pass: swirl coords before final sample
    float qx = fbm(base);
    float qy = fbm(base + vec3(5.2, 1.3, 2.8));
    return fbm(vec3(px * 0.38 + 2.0 * qx,
                    py * 0.38 + 2.0 * qy,
                    uTime * 0.06 + 1.0));
  }

  void main(){
    vUv = uv;
    vec3 pos = position;

    // Soft mouse disturbance — pushes warp domain, no sharp ripple ring
    vec2 wMouse = (uMouse * 2.0 - 1.0) * 3.5;
    float md    = length(pos.xy - wMouse);
    float push  = exp(-md * md * 0.22) * 0.50;

    float elev = liquidHeight(pos.x + push, pos.y + push * 0.75) * 0.17;
    vElevation = elev;

    // Smooth analytic-ish normals via tight finite diff
    float eps = 0.006;
    float dx  = liquidHeight(pos.x + push + eps, pos.y + push * 0.75) * 0.17 - elev;
    float dy  = liquidHeight(pos.x + push, pos.y + push * 0.75 + eps) * 0.17 - elev;
    vNormal   = normalize(vec3(-dx / eps, -dy / eps, 1.0));

    pos.z += elev;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// FRAGMENT SHADER
// ─────────────────────────────────────────────────────────────────────────────
const FRAGMENT_SHADER = /* glsl */`
  uniform float uTime;
  uniform vec2  uMouse;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform vec3  uColorC;
  uniform vec3  uBgDark;

  varying vec2  vUv;
  varying float vElevation;
  varying vec3  vNormal;

  void main(){
    vec3 n       = normalize(vNormal);
    vec3 viewDir = vec3(0.0, 0.0, 1.0);

    // ── Fake environment reflection ───────────
    // Reflect the view direction off the surface normal,
    // then use the y-component to sample a sky-like gradient.
    // This is the dominant visual cue that reads as "liquid".
    vec3 refl   = reflect(-viewDir, n);               // reflected ray
    float envY  = refl.y * 0.5 + 0.5;                // 0=below horizon,1=above
    float cycle = sin(uTime * 0.16) * 0.5 + 0.5;

    // Sky gradient: deep navy at horizon → muted teal above
    vec3 envLow  = uBgDark * 1.4;
    vec3 envHigh = mix(uColorA * 0.60, uColorB * 0.45, cycle);
    vec3 envCol  = mix(envLow, envHigh, smoothstep(0.3, 0.8, envY));

    // ── Fresnel ───────────────────────────────
    float cosT   = max(dot(n, viewDir), 0.0);
    float fresnel = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);

    // ── Base surface colour ───────────────────
    // Very dark, minimal diffuse — let specular carry the look
    float depth = smoothstep(-0.17, 0.17, vElevation);
    vec3 base   = mix(uBgDark * 0.6, mix(uBgDark, uColorA * 0.30, 0.5), depth);
    // Violet bleed in the deep troughs
    base = mix(base, uColorC * 0.15, smoothstep(0.0, -0.14, vElevation) * 0.50);

    // ── Compose ───────────────────────────────
    vec3 col = base;

    // Environment reflection blended by Fresnel
    col = mix(col, envCol, fresnel * 0.75);

    // Sharp primary specular (key light — slightly off top-left)
    vec3 lightA = normalize(vec3(0.30, 0.60, 1.0));
    vec3 halfA  = normalize(lightA + viewDir);
    float specA = pow(max(dot(n, halfA), 0.0), 260.0);
    col += specA * vec3(0.75, 0.95, 1.00) * 1.10;   // slightly overbright = bloom feel

    // Softer secondary specular (fill — opposite side)
    vec3 lightB = normalize(vec3(-0.45, -0.25, 0.8));
    vec3 halfB  = normalize(lightB + viewDir);
    float specB = pow(max(dot(n, halfB), 0.0), 80.0);
    col += specB * uColorB * 0.22;

    // Fresnel rim — thin cyan edge at wave crests
    col += fresnel * uColorB * 0.28 * smoothstep(0.05, 0.17, vElevation);

    // ── Mouse glow ────────────────────────────
    float mDist = length(vUv - uMouse);
    col += exp(-mDist * mDist * 7.0)  * uColorB  * 0.15;
    col += exp(-mDist * mDist * 22.0) * vec3(0.85, 1.0, 1.0) * 0.18;

    col = clamp(col, 0.0, 1.0);
    // Slight gamma lift so dark navy stays rich, not black
    col = pow(col, vec3(0.88));

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function LiquidBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 2.4;

    // 384×384 — finer mesh eliminates vertex-level faceting
    const geometry = new THREE.PlaneGeometry(7, 7, 384, 384);
    const material = new THREE.ShaderMaterial({
      vertexShader:   VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime:   { value: 0 },
        uMouse:  { value: new THREE.Vector2(0.5, 0.5) },
        uColorA: { value: new THREE.Color('#0066CC') },
        uColorB: { value: new THREE.Color('#00D4AA') },
        uColorC: { value: new THREE.Color('#5b21b6') },
        uBgDark: { value: new THREE.Color('#030c18') },
      },
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const targetMouse = new THREE.Vector2(0.5, 0.5);
    const onMouseMove = (e) => {
      targetMouse.set(
        e.clientX / window.innerWidth,
        1.0 - e.clientY / window.innerHeight
      );
    };
    window.addEventListener('mousemove', onMouseMove);

    const onResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let rafId;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      material.uniforms.uTime.value  = clock.getElapsedTime();
      material.uniforms.uMouse.value.lerp(targetMouse, 0.04);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      mount.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}
