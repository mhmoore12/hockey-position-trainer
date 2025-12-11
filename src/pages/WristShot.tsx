import {
  useCallback,
  useEffect,
  memo,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

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
      yaw: -0.2,
      pitch: degToRad(45),
      roll: -0.3,
      offset: -1.5,
      lift: -0.03,
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
    title: "Open the blade (lift the puck)",
    body: "As you start to pull, the wrists roll to open the blade. The puck moves toward the mid-blade with a small lift.",
    cues: [
      "Top hand steers back; bottom hand eases up so the blade can open.",
      "Maintain light ice contact so the puck rides the curve instead of hopping.",
      "Puck leaves the blade a bit - maybe about an inch or two - before 'snapping' quickly back to it.",
    ],
    pose: {
      yaw: 0,
      pitch: degToRad(110),
      roll: 0,
      offset: 0,
      lift: 0.05,
      bend: 0.16,
      lateral: 0,
      puckTravel: 0.35,
      puckLift: -0.1,
    },
  },
  {
    title: "Snap, flick",
    body: "Top hand pulls back, bottom hand pushes through. The blade closes slightly through impact for the quick 'flick'.",
    cues: [
      "Hands finish out in front of the body with the blade finishing toward the target.",
      "Weight transfers to the front foot as the puck rolls from heel to toe.",
      "'Snap' quickly on the puck to catch up to it before the 'flick'. The 'snap' is our lifting action and the 'flick' is our aiming action.",
      "The 'snap' to 'flick' transition should be smooth and quick - you can start doing it slow, but the quicker this transition is, the more power and lift you will have.",
      "The 'flick' also determines how high and what direction the puck will ultimately go. If done correctly, where you point the toe of your stick is where the puck will travel.",
    ],
    pose: {
      yaw: 0.1,
      pitch: degToRad(60),
      roll: 0.1,
      offset: 1.4,
      lift: 0.5,
      bend: 0.12,
      lateral: -0.3,
      puckTravel: 0.3,
      puckLift: 0.08,
    },
  },
  {
    title: "Follow through",
    body: "Blade turns over and finishes toward the target; the puck continues its path.",
    cues: [
      "Chest and shoulders finish facing the target; blade rolls over to close the face.",
      "Arms extend to full reach, finishing high to guide puck trajectory.",
    ],
    pose: {
      yaw: degToRad(20),
      pitch: degToRad(20),
      roll: degToRad(60),
      offset: 2.25,
      lift: 0.7,
      bend: 0.05,
      lateral: -0.8,
      puckTravel: 0.85,
      puckLift: 0.3,
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

const orthographic = (
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number
): Float32Array => {
  const lr = 1 / (left - right);
  const bt = 1 / (bottom - top);
  const nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = -2 * lr;
  out[5] = -2 * bt;
  out[10] = 2 * nf;
  out[12] = (left + right) * lr;
  out[13] = (top + bottom) * bt;
  out[14] = (far + near) * nf;
  out[15] = 1;
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
  const [azimuth, setAzimuth] = useState(Math.PI / 2);
  const [elevation, setElevation] = useState(0.2);
  const [radius, setRadius] = useState(2.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isOrbiting, setIsOrbiting] = useState(false);
  const [, startTransition] = useTransition();
  const lastXRef = useRef(0);
  const lastYRef = useRef(0);
  const playRaf = useRef<number | null>(null);
  const sliderRaf = useRef<number | null>(null);

  const activeStageIndex = useMemo(
    () => Math.round(clamp(stageValue, 0, shotStages.length - 1)),
    [stageValue]
  );
  const activeStage = useMemo(
    () => shotStages[activeStageIndex],
    [activeStageIndex]
  );

  const marks = useMemo(
    () =>
      shotStages.map((stage, idx) => ({
        title: stage.title,
        idx,
        left: (idx / (shotStages.length - 1)) * 100,
      })),
    []
  );

  const poseForValue = useCallback((value: number): Pose => {
    const clamped = clamp(value, 0, shotStages.length - 1);
    const startIndex = Math.floor(clamped);
    const endIndex = Math.min(startIndex + 1, shotStages.length - 1);
    const t = clamped - startIndex;
    const a = shotStages[startIndex].pose;
    const b = shotStages[endIndex].pose;
    if (t === 0) return a;
    // Custom release motion between stage 3 (open) and stage 4 (flick)
    if (startIndex === 2 && endIndex === 4) {
      const subT = t;
      // Keyframes: 0 -> -10deg, 0.5 lift by 0.5, 0.7 -> +50deg (upright = 90deg)
      const k1 = 0.01;
      const k2 = 0.1;
      const k3 = 0.4;
      let pitch: number;
      let yaw: number;
      let roll: number;
      let lateral: number;
      const baseBlend = (key: keyof Pose) => lerp(a[key], b[key], subT);

      if (subT <= k1) {
        const local = subT / k1;
        pitch = lerp(a.pitch, degToRad(110), local);
        yaw = lerp(a.yaw, degToRad(-10), local);
        roll = lerp(a.yaw, degToRad(0), local);
        lateral = lerp(a.lateral, 0.3, local);
      } else if (subT <= k2) {
        const local = (subT - k1) / (k2 - k1);
        pitch = lerp(degToRad(110), degToRad(70), local); // begin snap up
        yaw = lerp(degToRad(-10), degToRad(10), local);
        roll = lerp(degToRad(0), degToRad(15), local);
        lateral = lerp(0.3, -2, local);
      } else if (subT <= k3) {
        const local = (subT - k2) / (k3 - k2);
        pitch = lerp(degToRad(70), degToRad(20), local);
        yaw = lerp(degToRad(10), degToRad(30), local);
        roll = lerp(degToRad(15), degToRad(20), local);
        lateral = lerp(0.3, 0.3, local);
      } else {
        const local = (subT - k3) / (1 - k3);
        pitch = lerp(degToRad(20), degToRad(20), local);
        yaw = lerp(degToRad(20), degToRad(20), local);
        roll = lerp(degToRad(30), degToRad(60), local);
        lateral = lerp(0.3, 0.3, local);
      }

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
        puckTravel += 0.22 * releaseT;
        puckLift += 0.08 * releaseT;
      }
      let pose = {
        yaw,
        pitch,
        roll: roll,
        offset: baseBlend("offset"),
        lift,
        bend: baseBlend("bend"),
        lateral: lateral,
        puckTravel,
        puckLift,
      };
      return pose;
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
    const orthoSpan = radius; // tie zoom to ortho span
    const projection = orthographic(
      -orthoSpan * aspect,
      orthoSpan * aspect,
      -orthoSpan,
      orthoSpan,
      -10,
      10
    );
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

    const floorModel = translate(identity(), [0, -0.2, 0]);
    setUniformsAndDraw(floorModel, [0.85, 0.92, 0.98], floorMeshRef.current);
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
      0,
    ]);
    const puckOutline = scale(puckModel, [1.08, 1.08, 1.08]);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(false);
    gl.cullFace(gl.FRONT);
    setUniformsAndDraw(puckOutline, [1, 1, 1], puckMeshRef.current);
    gl.cullFace(gl.BACK);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(true);
    setUniformsAndDraw(puckModel, [0.27, 0.27, 0.3], puckMeshRef.current);
    const puckShadow = scale(
      translate(identity(), [
        pose.offset + pose.puckTravel,
        -0.2,
        pose.lateral,
      ]),
      [1, 0.05, 1]
    );
    setUniformsAndDraw(puckShadow, [0, 0, 0, 0.22], puckMeshRef.current);

    let bladeModel = identity();
    bladeModel = translate(bladeModel, [pose.offset, pose.lift, pose.lateral]);
    bladeModel = rotateZ(bladeModel, pose.pitch);
    bladeModel = rotateY(bladeModel, pose.roll);
    bladeModel = rotateX(bladeModel, pose.yaw);
    bladeModel = scale(bladeModel, [0.2, 0.25 + pose.bend * 0.4, 6.2]);
    setUniformsAndDraw(bladeModel, [0.86, 0.68, 0.32], bladeMeshRef.current);
    const bladeFront = translate(bladeModel, [0, 0, -0.005]);
    setUniformsAndDraw(
      bladeFront,
      [0.78, 0.95, 0.78],
      bladeFrontMeshRef.current
    );
    const bladeShadow = scale(
      translate(identity(), [pose.offset, -0.2, pose.lateral]),
      [0.2, 0.02, 6.2]
    );
    let bladeShadowRot = rotateZ(bladeShadow, pose.pitch);
    bladeShadowRot = rotateX(bladeShadowRot, pose.roll * -1);
    bladeShadowRot = rotateY(bladeShadowRot, pose.yaw);

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
        // Approx normals from position for simple lighting
        vec3 normalHint = normalize(vec3(vPosition.x * 0.35, 1.0, vPosition.z * 0.35));
        vec3 lightDir = normalize(vec3(0.3, 1.0, 0.2));
        vec3 viewDir = normalize(vec3(0.0, 1.0, 0.6));
        vec3 halfV = normalize(lightDir + viewDir);

        float ndl = clamp(dot(normalHint, lightDir), 0.0, 1.0);
        float diffuse = 0.25 + 0.75 * ndl;

        float spec = pow(max(dot(normalHint, halfV), 0.0), 32.0);
        // Heavier spec for ice-like colors (bright, high alpha)
        float baseSpec = mix(0.15, 0.55, step(0.9, uColor.a) * step(0.8, (uColor.r + uColor.g + uColor.b) / 3.0));
        float rim = pow(1.0 - max(dot(normalHint, viewDir), 0.0), 2.5) * 0.15;

        vec3 color = uColor.rgb * diffuse + spec * baseSpec + rim;
        gl_FragColor = vec4(color, uColor.a);
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
      clamp01(prev - deltaY * 0.005, degToRad(0.5), degToRad(85))
    );
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const next = clamp01(radius + e.deltaY * 0.002, 1.5, 5);
    setRadius(next);
  };

  const handleSliderChange = (v: number) => {
    if (sliderRaf.current) cancelAnimationFrame(sliderRaf.current);
    sliderRaf.current = requestAnimationFrame(() => {
      startTransition(() => setStageValue(v));
    });
  };
  const stopOrbit = () => setIsOrbiting(false);

  useEffect(() => {
    if (!isPlaying) {
      if (playRaf.current) cancelAnimationFrame(playRaf.current);
      playRaf.current = null;
      return;
    }
    let last = performance.now();
    let endPause = 0;
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setStageValue((prev) => {
        if (prev >= shotStages.length - 1) {
          endPause += dt;
          if (endPause >= 2) {
            endPause = 0;
            return 0;
          }
          return prev;
        }
        const next = prev + dt * playbackSpeed * 1; // 1 unit per second at 1x
        return next;
      });
      playRaf.current = requestAnimationFrame(step);
    };
    playRaf.current = requestAnimationFrame(step);
    return () => {
      if (playRaf.current) cancelAnimationFrame(playRaf.current);
      playRaf.current = null;
    };
  }, [isPlaying, playbackSpeed]);

  const setPreset = (key: "side" | "front" | "top") => {
    if (key === "side") {
      setAzimuth(Math.PI / 2);
      setElevation(0.15);
      setRadius(2.0);
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
      <header className="page-hero" />

      <div className="wrist-layout">
        <section className="video-card">
          <p className="eyebrow">Watch first</p>
          <h3>Wrist shot fundamentals</h3>
          <p className="hero-subline">
            This video is a solid starting point to see the core mechanics
            before drilling the stages below.
          </p>
          <div className="video-embed">
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/C5gl160uqW4?si=Yy2oTgun24Netd-x"
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
          </div>
        </section>

        <section className="stage-card hero-card slider-card">
          <p className="eyebrow">Mechanics lab</p>
          <h1 style={{ margin: "0 0 0.2rem" }}>Wrist shot explainer</h1>
          <p className="hero-subline" style={{ marginBottom: "0.6rem" }}>
            Slide through the four stages of a wrist shot. The focus here is
            primarily on the angle of the blade.
          </p>
          <div className="slider-block">
            <label className="control">
              Shot stage
              <input
                type="range"
                min={0.01}
                max={shotStages.length - 1.02}
                step={0.01}
                value={stageValue}
                onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
              />
            </label>
            <div className="stage-marks">
              {marks.map((mark) => (
                <div
                  key={mark.title}
                  className={`stage-mark ${
                    mark.idx === activeStageIndex ? "stage-mark-active" : ""
                  }`}
                  style={{ left: `${mark.left}%` }}
                >
                  <span>{mark.idx + 1}</span>
                  <small>{mark.title}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="stage-card wrist-stage-card">
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
          <div className="note">Drag the 3D view to move the camera.</div>
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
                Drag the mouse to see it from other angles
              </span>
            </div>
          </div>
          <div className="playback-row">
            <button
              className="view-btn"
              onClick={() => setIsPlaying((p) => !p)}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <div className="speed-toggle">
              {[1, 0.5, 0.25, 6].map((speed) => (
                <button
                  key={speed}
                  className={`speed-btn ${
                    playbackSpeed === speed ? "speed-btn-active" : ""
                  }`}
                  onClick={() => setPlaybackSpeed(speed)}
                >
                  {speed === 6 ? "Realtime (6x)" : `${speed}x`}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default WristShot;
