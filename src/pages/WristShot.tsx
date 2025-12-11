import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Pose = {
  yaw: number;
  pitch: number;
  roll: number;
  offset: number;
  lift: number;
  bend: number;
  lateral: number;
  puckTravel: number;
  puckLift: number;
};

type ShotStage = {
  title: string;
  body: string;
  cues: string[];
  pose: Pose;
};

type Mesh = {
  buffer: WebGLBuffer;
  vertexCount: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const degToRad = (deg: number) => (deg * Math.PI) / 180;
const clamp01 = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const shotStages: ShotStage[] = [
  {
    title: "Load the shot",
    body: "Blade sits just behind the puck, weight drops into the inside edge, and the hands separate to start loading the shaft.",
    cues: [
      "Knees bent, chest over your thighs so the puck sits off your front heel.",
      "Top hand away from your body to pre-load the shaft without rolling the puck forward.",
    ],
    pose: {
      yaw: 0,
      pitch: degToRad(45),
      roll: 0,
      offset: -1.5,
      lift: 0.02,
      bend: 0.18,
      lateral: -0.1,
      puckTravel: 0.3,
      puckLift: -0.1,
    },
  },
  {
    title: "Scrape and press",
    body: "Bottom hand drives down to 'scrape' the ice, loading the shaft while the puck is still cupped on the heel.",
    cues: [
      "Feel the blade squeeze the ice - not a slap, just steady downward pressure.",
      "Core stays square; eyes on target as the puck stays on the inside edge of the blade.",
    ],
    pose: {
      yaw: 0,
      pitch: degToRad(70),
      roll: 0,
      offset: -0.6,
      lift: -0.02,
      bend: 0.36,
      lateral: -0.06,
      puckTravel: 0.25,
      puckLift: -0.1,
    },
  },
  {
    title: "Open the blade",
    body: "As you start to pull, the wrists roll to open the blade. The puck moves toward the mid-blade with a small lift.",
    cues: [
      "Top hand steers back; bottom hand eases up so the blade can open.",
      "Maintain light ice contact so the puck rides the curve instead of hopping.",
    ],
    pose: {
      yaw: 0,
      pitch: degToRad(90),
      roll: 0,
      offset: 0,
      lift: 0.05,
      bend: 0.16,
      lateral: 0,
      puckTravel: 0.3,
      puckLift: -0.1,
    },
  },
  {
    title: "Pull, push, flick",
    body: "Top hand pulls back, bottom hand pushes through. The blade closes slightly through impact for the quick 'flick'.",
    cues: [
      "Hands finish out in front of the body with the blade finishing toward the target.",
      "Weight transfers to the front foot as the puck rolls from heel to toe.",
    ],
    pose: {
      yaw: 0,
      pitch: degToRad(140),
      roll: 0,
      offset: 1,
      lift: 0.5,
      bend: 0.12,
      lateral: -0.3,
      puckTravel: 0.4,
      puckLift: 0.08,
    },
  },
];

const identity = (): Float32Array =>
  new Float32Array([
    1,
    0,
    0,
    0, //
    0,
    1,
    0,
    0, //
    0,
    0,
    1,
    0, //
    0,
    0,
    0,
    1, //
  ]);

const multiply = (a: Float32Array, b: Float32Array): Float32Array => {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i += 1) {
    const ai0 = a[i];
    const ai1 = a[i + 4];
    const ai2 = a[i + 8];
    const ai3 = a[i + 12];
    out[i] = ai0 * b[0] + ai1 * b[1] + ai2 * b[2] + ai3 * b[3];
    out[i + 4] = ai0 * b[4] + ai1 * b[5] + ai2 * b[6] + ai3 * b[7];
    out[i + 8] = ai0 * b[8] + ai1 * b[9] + ai2 * b[10] + ai3 * b[11];
    out[i + 12] = ai0 * b[12] + ai1 * b[13] + ai2 * b[14] + ai3 * b[15];
  }
  return out;
};

const translate = (
  m: Float32Array,
  v: [number, number, number]
): Float32Array => {
  const [x, y, z] = v;
  const t = identity();
  t[12] = x;
  t[13] = y;
  t[14] = z;
  return multiply(m, t);
};

const scale = (m: Float32Array, v: [number, number, number]): Float32Array => {
  const [x, y, z] = v;
  const s = identity();
  s[0] = x;
  s[5] = y;
  s[10] = z;
  return multiply(m, s);
};

const rotateX = (m: Float32Array, rad: number): Float32Array => {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const r = new Float32Array([
    1,
    0,
    0,
    0, //
    0,
    c,
    s,
    0, //
    0,
    -s,
    c,
    0, //
    0,
    0,
    0,
    1, //
  ]);
  return multiply(m, r);
};

const rotateY = (m: Float32Array, rad: number): Float32Array => {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const r = new Float32Array([
    c,
    0,
    -s,
    0, //
    0,
    1,
    0,
    0, //
    s,
    0,
    c,
    0, //
    0,
    0,
    0,
    1, //
  ]);
  return multiply(m, r);
};

const rotateZ = (m: Float32Array, rad: number): Float32Array => {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const r = new Float32Array([
    c,
    s,
    0,
    0, //
    -s,
    c,
    0,
    0, //
    0,
    0,
    1,
    0, //
    0,
    0,
    0,
    1, //
  ]);
  return multiply(m, r);
};

const perspective = (
  fov: number,
  aspect: number,
  near: number,
  far: number
): Float32Array => {
  const f = 1.0 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
};

const subtract = (
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const cross = (
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const dot = (a: [number, number, number], b: [number, number, number]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const normalize = (v: [number, number, number]): [number, number, number] => {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len === 0) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
};

const lookAt = (
  eye: [number, number, number],
  target: [number, number, number],
  up: [number, number, number]
): Float32Array => {
  const zAxis = normalize(subtract(eye, target));
  const xAxis = normalize(cross(up, zAxis));
  const yAxis = cross(zAxis, xAxis);

  return new Float32Array([
    xAxis[0],
    yAxis[0],
    zAxis[0],
    0,
    xAxis[1],
    yAxis[1],
    zAxis[1],
    0,
    xAxis[2],
    yAxis[2],
    zAxis[2],
    0,
    -dot(xAxis, eye),
    -dot(yAxis, eye),
    -dot(zAxis, eye),
    1,
  ]);
};

const createProgram = (
  gl: WebGLRenderingContext,
  vert: string,
  frag: string
): WebGLProgram | null => {
  const vs = gl.createShader(gl.VERTEX_SHADER);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  if (!vs || !fs) return null;

  gl.shaderSource(vs, vert);
  gl.shaderSource(fs, frag);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    console.warn(gl.getShaderInfoLog(vs));
    return null;
  }
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.warn(gl.getShaderInfoLog(fs));
    return null;
  }

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn(gl.getProgramInfoLog(program));
    return null;
  }
  return program;
};

const createMesh = (
  gl: WebGLRenderingContext,
  vertices: number[]
): Mesh | null => {
  const buffer = gl.createBuffer();
  if (!buffer) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  return { buffer, vertexCount: vertices.length / 3 };
};

const bladeGeometry = (): number[] => {
  const halfLength = 0.9;
  const height = 0.04;
  const depth = 0.07;

  const p = [
    [-halfLength, -height, depth],
    [halfLength, -height, depth],
    [halfLength, height, depth],
    [-halfLength, height, depth],
    [-halfLength, -height, -depth],
    [halfLength, -height, -depth],
    [halfLength, height, -depth],
    [-halfLength, height, -depth],
  ];

  return [
    ...p[0],
    ...p[1],
    ...p[2],
    ...p[0],
    ...p[2],
    ...p[3],
    ...p[5],
    ...p[4],
    ...p[7],
    ...p[5],
    ...p[7],
    ...p[6],
    ...p[3],
    ...p[2],
    ...p[6],
    ...p[3],
    ...p[6],
    ...p[7],
    ...p[4],
    ...p[5],
    ...p[1],
    ...p[4],
    ...p[1],
    ...p[0],
    ...p[1],
    ...p[5],
    ...p[6],
    ...p[1],
    ...p[6],
    ...p[2],
    ...p[4],
    ...p[0],
    ...p[3],
    ...p[4],
    ...p[3],
    ...p[7],
  ];
};

const bladeFrontFaceGeometry = (): number[] => {
  const halfLength = 0.9;
  const height = 0.07;
  const depth = 0.06;
  const p = [
    [-halfLength, -height, depth],
    [halfLength, -height, depth],
    [halfLength, -height, -depth],
    [-halfLength, -height, -depth],
  ];
  return [...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]];
};

const puckGeometry = (): number[] => {
  const verts: number[] = [];
  const segments = 28;
  const radius = 0.24;
  const h = 0.08;

  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const next = (((i + 1) % segments) / segments) * Math.PI * 2;
    const x1 = Math.cos(angle) * radius;
    const z1 = Math.sin(angle) * radius;
    const x2 = Math.cos(next) * radius;
    const z2 = Math.sin(next) * radius;

    verts.push(0, h, 0, x1, h, z1, x2, h, z2);
    verts.push(0, -h, 0, x2, -h, z2, x1, -h, z1);
    verts.push(x1, h, z1, x1, -h, z1, x2, h, z2);
    verts.push(x1, -h, z1, x2, -h, z2, x2, h, z2);
  }
  return verts;
};

const floorGeometry = (): number[] => {
  const size = 4;
  const y = 0;
  return [
    -size,
    y,
    -size,
    -size,
    y,
    size,
    size,
    y,
    -size,
    -size,
    y,
    size,
    size,
    y,
    size,
    size,
    y,
    -size,
  ];
};

const spotlightGeometry = (): number[] => {
  const s = 2.6;
  const y = 0.0015;
  return [
    -s,
    y,
    -s,
    -s,
    y,
    s,
    s,
    y,
    -s, //
    -s,
    y,
    s,
    s,
    y,
    s,
    s,
    y,
    -s,
  ];
};

const centerLineGeometry = (): number[] => {
  const halfLength = 4.2;
  const halfWidth = 0.02;
  const y = 0.001;
  return [
    -halfWidth,
    y,
    -halfLength,
    -halfWidth,
    y,
    halfLength,
    halfWidth,
    y,
    -halfLength,
    -halfWidth,
    y,
    halfLength,
    halfWidth,
    y,
    halfLength,
    halfWidth,
    y,
    -halfLength,
  ];
};

const WristShot = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const positionLocRef = useRef<number>(-1);
  const matrixLocRef = useRef<WebGLUniformLocation | null>(null);
  const colorLocRef = useRef<WebGLUniformLocation | null>(null);
  const puckMeshRef = useRef<Mesh | null>(null);
  const bladeMeshRef = useRef<Mesh | null>(null);
  const bladeFrontMeshRef = useRef<Mesh | null>(null);
  const floorMeshRef = useRef<Mesh | null>(null);
  const centerLineMeshRef = useRef<Mesh | null>(null);
  const spotlightMeshRef = useRef<Mesh | null>(null);

  const [stageValue, setStageValue] = useState(0);
  const [azimuth, setAzimuth] = useState(-0.9);
  const [elevation, setElevation] = useState(0.42);
  const [radius, setRadius] = useState(2.7);
  const [isOrbiting, setIsOrbiting] = useState(false);
  const lastXRef = useRef(0);
  const lastYRef = useRef(0);

  const activeStageIndex = useMemo(
    () => Math.round(clamp(stageValue, 0, shotStages.length - 1)),
    [stageValue]
  );
  const activeStage = shotStages[activeStageIndex];

  const poseForValue = useCallback((value: number): Pose => {
    const clamped = clamp(value, 0, shotStages.length - 1);
    const startIndex = Math.floor(clamped);
    const endIndex = Math.min(startIndex + 1, shotStages.length - 1);
    const t = clamped - startIndex;
    const a = shotStages[startIndex].pose;
    const b = shotStages[endIndex].pose;
    if (t === 0) return a;
    // Custom release motion between stage 3 (open) and stage 4 (flick)
    if (startIndex === 2 && endIndex === 3) {
      const subT = t;
      // Keyframes: 0 -> -10deg, 0.5 lift by 0.5, 0.7 -> +50deg (upright = 90deg)
      const k1 = 0.4;
      const k2 = 0.6;
      const k3 = 0.8;
      let pitch: number;
      if (subT <= k1) {
        const local = subT / k1;
        pitch = lerp(a.pitch, degToRad(110), local);
      } else if (subT <= k2) {
        const local = (subT - k1) / (k2 - k1);
        pitch = lerp(degToRad(110), degToRad(70), local * 0.4); // begin snap up
        console.log("p2");
      } else if (subT <= k3) {
        const local = (subT - k2) / (k3 - k2);
        pitch = lerp(degToRad(70), degToRad(20), local);
        console.log("p3");
      } else {
        const local = (subT - k3) / (1 - k3);
        pitch = lerp(degToRad(20), degToRad(20), local);
        console.log("final");
      }

      const baseBlend = (key: keyof Pose) => lerp(a[key], b[key], subT);

      const lift =
        subT <= k2
          ? lerp(a.lift, 0.5, subT / k2)
          : lerp(0.5, b.lift, (subT - k2) / (1 - k2));

      // Keep puck “stuck” to the blade until the flick (k3), then let it separate.
      let puckTravel = baseBlend("puckTravel");
      let puckLift = baseBlend("puckLift");
      const releaseStart = 0.7; // begin puck separation near the end of the lift
      if (subT > releaseStart) {
        const releaseT = (subT - releaseStart) / (1 - releaseStart);
        puckTravel += 0.18 * releaseT;
        puckLift += 0.06 * releaseT;
      }

      return {
        yaw: baseBlend("yaw"),
        pitch,
        roll: baseBlend("roll"),
        offset: baseBlend("offset"),
        lift,
        bend: baseBlend("bend"),
        lateral: baseBlend("lateral"),
        puckTravel,
        puckLift,
      };
    }

    return {
      yaw: lerp(a.yaw, b.yaw, t),
      pitch: lerp(a.pitch, b.pitch, t),
      roll: lerp(a.roll, b.roll, t),
      offset: lerp(a.offset, b.offset, t),
      lift: lerp(a.lift, b.lift, t),
      bend: lerp(a.bend, b.bend, t),
      lateral: lerp(a.lateral, b.lateral, t),
      puckTravel: lerp(a.puckTravel, b.puckTravel, t),
      puckLift: lerp(a.puckLift, b.puckLift, t),
    };
  }, []);

  const drawScene = useCallback(() => {
    const gl = glRef.current;
    const program = programRef.current;
    const matrixLoc = matrixLocRef.current;
    const colorLoc = colorLocRef.current;
    const positionLoc = positionLocRef.current;
    if (
      !gl ||
      !program ||
      matrixLoc === null ||
      colorLoc === null ||
      positionLoc < 0 ||
      !puckMeshRef.current ||
      !bladeMeshRef.current ||
      !bladeFrontMeshRef.current ||
      !floorMeshRef.current ||
      !centerLineMeshRef.current ||
      !spotlightMeshRef.current
    ) {
      return;
    }

    const canvas = gl.canvas as HTMLCanvasElement;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.04, 0.1, 0.16, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);

    const aspect = canvas.width / canvas.height;
    const projection = perspective(degToRad(50), aspect, 0.1, 20);
    const r = radius;
    const cameraPos: [number, number, number] = [
      r * Math.cos(elevation) * Math.cos(azimuth),
      r * Math.sin(elevation),
      r * Math.cos(elevation) * Math.sin(azimuth),
    ];
    const view = lookAt(cameraPos, [0, 0, 0], [0, 1, 0]);
    const viewProj = multiply(projection, view);

    const setUniformsAndDraw = (
      model: Float32Array,
      color: number[],
      mesh: Mesh
    ) => {
      const mvp = multiply(viewProj, model);
      gl.uniformMatrix4fv(matrixLoc, false, mvp);
      // If 4 components provided, use rgba; otherwise treat as opaque rgb.
      const c = color.length === 4 ? color : [...color, 1];
      gl.uniform4fv(colorLoc, new Float32Array(c));
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
      gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);
    };

    const floorModel = translate(identity(), [0, -0.3, 0]);
    setUniformsAndDraw(floorModel, [0.8, 0.9, 0.98], floorMeshRef.current);
    const spotlightModel = translate(identity(), [0, -0.449, 0]);
    setUniformsAndDraw(
      spotlightModel,
      [1, 1, 1, 0.22],
      spotlightMeshRef.current
    );
    const lineModel = identity();
    setUniformsAndDraw(
      lineModel,
      [1, 0.2, 0.2, 0.35],
      centerLineMeshRef.current
    );

    const pose = poseForValue(stageValue);
    const puckModel = translate(identity(), [
      pose.offset + pose.puckTravel,
      pose.lift + pose.puckLift,
      pose.lateral,
    ]);
    setUniformsAndDraw(puckModel, [0.06, 0.06, 0.1], puckMeshRef.current);
    const puckShadow = scale(
      translate(identity(), [
        pose.offset + pose.puckTravel,
        -0.449,
        pose.lateral,
      ]),
      [1, 0.05, 1]
    );
    setUniformsAndDraw(puckShadow, [0, 0, 0, 0.22], puckMeshRef.current);

    let bladeModel = identity();
    bladeModel = translate(bladeModel, [pose.offset, pose.lift, pose.lateral]);
    bladeModel = rotateZ(bladeModel, pose.pitch);
    bladeModel = scale(bladeModel, [0.2, 0.25 + pose.bend * 0.4, 6.2]);
    setUniformsAndDraw(bladeModel, [0.86, 0.68, 0.32], bladeMeshRef.current);
    const bladeFront = translate(bladeModel, [0, 0, -0.005]);
    setUniformsAndDraw(
      bladeFront,
      [0.78, 0.95, 0.78],
      bladeFrontMeshRef.current
    );
    const bladeShadow = scale(
      translate(identity(), [pose.offset, -0.449, pose.lateral]),
      [0.2, 0.02, 6.2]
    );
    const bladeShadowRot = rotateZ(bladeShadow, pose.pitch);
    setUniformsAndDraw(bladeShadowRot, [0, 0, 0, 0.16], bladeMeshRef.current);
  }, [azimuth, elevation, poseForValue, stageValue]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl");
    if (!gl) return;
    glRef.current = gl;

    const vert = `
      attribute vec3 position;
      uniform mat4 uMatrix;
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = uMatrix * vec4(position, 1.0);
      }
    `;

    const frag = `
      precision mediump float;
      uniform vec4 uColor;
      varying vec3 vPosition;
      void main() {
        float shade = 0.5 + 0.45 * clamp((vPosition.y + 1.4) / 2.8, 0.0, 1.0);
        gl_FragColor = vec4(uColor.rgb * shade, uColor.a);
      }
    `;

    const program = createProgram(gl, vert, frag);
    if (!program) return;
    gl.useProgram(program);
    programRef.current = program;
    const positionLoc = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLoc);
    positionLocRef.current = positionLoc;
    matrixLocRef.current = gl.getUniformLocation(program, "uMatrix");
    colorLocRef.current = gl.getUniformLocation(program, "uColor");

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    puckMeshRef.current = createMesh(gl, puckGeometry());
    bladeMeshRef.current = createMesh(gl, bladeGeometry());
    bladeFrontMeshRef.current = createMesh(gl, bladeFrontFaceGeometry());
    floorMeshRef.current = createMesh(gl, floorGeometry());
    centerLineMeshRef.current = createMesh(gl, centerLineGeometry());
    spotlightMeshRef.current = createMesh(gl, spotlightGeometry());

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = Math.floor(canvas.clientWidth * dpr);
      const height = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      drawScene();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
    };
  }, [drawScene]);

  useEffect(() => {
    drawScene();
  }, [drawScene]);

  const startOrbit = (clientX: number, clientY: number) => {
    setIsOrbiting(true);
    lastXRef.current = clientX;
    lastYRef.current = clientY;
  };

  const moveOrbit = (clientX: number, clientY: number) => {
    if (!isOrbiting) return;
    const delta = clientX - lastXRef.current;
    const deltaY = clientY - lastYRef.current;
    lastXRef.current = clientX;
    lastYRef.current = clientY;
    setAzimuth((prev) => prev + delta * 0.01);
    setElevation((prev) =>
      clamp01(prev - deltaY * 0.005, degToRad(8), degToRad(75))
    );
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const next = clamp01(radius + e.deltaY * 0.002, 1.5, 5);
    setRadius(next);
  };
  const stopOrbit = () => setIsOrbiting(false);

  const setPreset = (key: "side" | "front" | "top") => {
    if (key === "side") {
      setAzimuth(Math.PI / 2);
      setElevation(0.42);
      setRadius(2.7);
    } else if (key === "front") {
      setAzimuth(0);
      setElevation(0.42);
      setRadius(2.7);
    } else {
      setAzimuth(0);
      setElevation(1.2);
      setRadius(3.6);
    }
  };

  return (
    <div className="page wrist-page">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Mechanics lab</p>
          <h1>Wrist shot explainer</h1>
          <p className="hero-subline">
            Slide through the four stages. Drag on the graphic to orbit around
            the puck and see blade angle changes.
          </p>
        </div>
        <div className="slider-block">
          <label className="control">
            Shot stage
            <input
              type="range"
              min={0.01}
              max={shotStages.length - 1.01}
              step={0.01}
              value={stageValue}
              onChange={(e) => setStageValue(parseFloat(e.target.value))}
            />
          </label>
          <div className="stage-marks">
            {shotStages.map((stage, idx) => (
              <div
                key={stage.title}
                className={`stage-mark ${
                  idx === activeStageIndex ? "stage-mark-active" : ""
                }`}
                style={{ left: `${(idx / (shotStages.length - 1)) * 100}%` }}
              >
                <span>{idx + 1}</span>
                <small>{stage.title}</small>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="wrist-layout">
        <section className="stage-card">
          <p className="eyebrow">
            Stage {activeStageIndex + 1} of {shotStages.length}
          </p>
          <h3>{activeStage.title}</h3>
          <p className="hero-subline">{activeStage.body}</p>
          <ul className="cues">
            {activeStage.cues.map((cue) => (
              <li key={cue}>{cue}</li>
            ))}
          </ul>
          <div className="note">
            Drag horizontally on the 3D view to orbit the camera around the
            puck.
          </div>
        </section>

        <section className="shot-visual">
          <div
            className="shot-canvas-shell"
            onPointerDown={(e) => startOrbit(e.clientX, e.clientY)}
            onPointerMove={(e) => moveOrbit(e.clientX, e.clientY)}
            onPointerUp={stopOrbit}
            onPointerLeave={stopOrbit}
            onWheel={handleWheel}
          >
            <canvas ref={canvasRef} className="shot-canvas" />
            <div className="view-buttons">
              <button className="view-btn" onClick={() => setPreset("side")}>
                From side
              </button>
              <button className="view-btn" onClick={() => setPreset("front")}>
                From front
              </button>
              <button className="view-btn" onClick={() => setPreset("top")}>
                From above
              </button>
            </div>
            <div className="canvas-caption">
              <span>Blade angle to puck</span>
              <span className="chip chip-neutral">
                Orbit to inspect the release
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default WristShot;
