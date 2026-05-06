import { OrbitControls, Stars, useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type RefObject,
} from "react";
import type { BufferGeometry, Mesh, Points } from "three";
import * as THREE from "three";
import type { GroundStation } from "../api";
import {
  EARTH_SCENE_RADIUS,
  INTERPOLATION_MS,
  SCENE_VERTICAL_OFFSET,
} from "../constants";
import {
  scenePositionFromGroundStation,
  scenePositionFromTuple,
  sunLightPositionFromUtc,
  writeScenePosition,
} from "../space";
import type { GroupedPositions, ObjectGroup, PositionTuple } from "../types";

type OrbitControlsHandle = ComponentRef<typeof OrbitControls>;

function createPointTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;

  const context = canvas.getContext("2d");
  if (!context) return null;

  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 30);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.62, "rgba(255, 255, 255, 0.92)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  context.fillStyle = gradient;
  context.beginPath();
  context.arc(32, 32, 30, 0, Math.PI * 2);
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function CameraFocus({
  position,
  controlsRef,
}: {
  position: PositionTuple | null;
  controlsRef: RefObject<OrbitControlsHandle | null>;
}) {
  const { camera } = useThree();
  const targetCameraPositionRef = useRef(new THREE.Vector3());
  const activeRef = useRef(false);
  const catIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!position || catIdRef.current === position[0]) return;

    const scenePosition = scenePositionFromTuple(position);
    if (scenePosition.lengthSq() === 0) return;

    const distance = Math.max(camera.position.length(), 6.4);
    targetCameraPositionRef.current
      .copy(scenePosition)
      .normalize()
      .multiplyScalar(distance);
    catIdRef.current = position[0];
    activeRef.current = true;
  }, [camera, position]);

  useFrame(() => {
    if (!activeRef.current) return;

    camera.position.lerp(targetCameraPositionRef.current, 0.075);
    camera.lookAt(0, 0, 0);
    controlsRef.current?.target?.lerp(new THREE.Vector3(0, 0, 0), 0.16);
    controlsRef.current?.update();

    if (camera.position.distanceTo(targetCameraPositionRef.current) < 0.015) {
      camera.position.copy(targetCameraPositionRef.current);
      camera.lookAt(0, 0, 0);
      controlsRef.current?.target?.set(0, 0, 0);
      controlsRef.current?.update();
      activeRef.current = false;
    }
  });

  return null;
}

function Earth() {
  const earthRef = useRef<Mesh>(null);
  const cloudRef = useRef<Mesh>(null);
  const [dayMap, normalMap, specularMap, cloudMap] = useTexture([
    "/textures/earth-day.jpg",
    "/textures/earth-normal.jpg",
    "/textures/earth-specular.jpg",
    "/textures/earth-clouds.png",
  ]);

  useMemo(() => {
    /* eslint-disable react-hooks/immutability -- Three textures are mutable resources configured after loading. */
    dayMap.colorSpace = THREE.SRGBColorSpace;
    cloudMap.colorSpace = THREE.SRGBColorSpace;
    specularMap.colorSpace = THREE.NoColorSpace;
    normalMap.colorSpace = THREE.NoColorSpace;
    /* eslint-enable react-hooks/immutability */
  }, [cloudMap, dayMap, normalMap, specularMap]);

  return (
    <group>
      <mesh ref={earthRef}>
        <sphereGeometry args={[EARTH_SCENE_RADIUS, 96, 96]} />
        <meshStandardMaterial
          map={dayMap}
          normalMap={normalMap}
          normalScale={new THREE.Vector2(0.12, 0.12)}
          roughnessMap={specularMap}
          roughness={0.88}
          metalness={0.02}
          emissive="#021526"
          emissiveIntensity={0.08}
        />
      </mesh>

      <mesh ref={cloudRef}>
        <sphereGeometry args={[2.19, 96, 96]} />
        <meshStandardMaterial
          map={cloudMap}
          color="#ffffff"
          transparent
          opacity={0.34}
          roughness={1}
          depthWrite={false}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[2.28, 96, 96]} />
        <meshBasicMaterial
          color="#4fb7ff"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

function TrackedObject({
  positions,
  color,
  opacity,
  size,
}: {
  positions: PositionTuple[];
  color: string;
  opacity: number;
  size: number;
}) {
  const pointsRef = useRef<Points>(null);
  const pointTexture = useMemo(() => createPointTexture(), []);
  const idsRef = useRef<number[]>([]);
  const previousRef = useRef<Float32Array>(new Float32Array(3));
  const currentRef = useRef<Float32Array>(new Float32Array(3));
  const renderedRef = useRef<Float32Array>(new Float32Array(3));
  const receivedAtRef = useRef(0);
  const [renderedPositions, setRenderedPositions] = useState(
    () => new Float32Array(3),
  );

  useEffect(() => {
    const nextIds = positions.map(([catId]) => catId);
    const nextCurrent = new Float32Array(Math.max(positions.length, 1) * 3);
    const nextPrevious = new Float32Array(Math.max(positions.length, 1) * 3);
    const nextRendered = new Float32Array(Math.max(positions.length, 1) * 3);
    const previousIndexById = new Map(
      idsRef.current.map((catId, index) => [catId, index]),
    );

    positions.forEach(([catId, latitude, longitude, altitudeKm], index) => {
      writeScenePosition(nextCurrent, index, latitude, longitude, altitudeKm);

      const previousIndex = previousIndexById.get(catId);

      if (previousIndex === undefined) {
        nextPrevious[index * 3] = nextCurrent[index * 3];
        nextPrevious[index * 3 + 1] = nextCurrent[index * 3 + 1];
        nextPrevious[index * 3 + 2] = nextCurrent[index * 3 + 2];
      } else {
        nextPrevious[index * 3] = renderedRef.current[previousIndex * 3];
        nextPrevious[index * 3 + 1] =
          renderedRef.current[previousIndex * 3 + 1];
        nextPrevious[index * 3 + 2] =
          renderedRef.current[previousIndex * 3 + 2];
      }

      nextRendered[index * 3] = nextPrevious[index * 3];
      nextRendered[index * 3 + 1] = nextPrevious[index * 3 + 1];
      nextRendered[index * 3 + 2] = nextPrevious[index * 3 + 2];
    });

    idsRef.current = nextIds;
    previousRef.current = nextPrevious;
    currentRef.current = nextCurrent;
    renderedRef.current = nextRendered;
    receivedAtRef.current = performance.now();
    setRenderedPositions(nextRendered);
  }, [positions]);

  useFrame(() => {
    const geometry = pointsRef.current?.geometry as BufferGeometry | undefined;
    const positionAttribute = geometry?.getAttribute("position");
    const previous = previousRef.current;
    const current = currentRef.current;
    const rendered = renderedRef.current;
    const now = performance.now();
    const progress = Math.min(
      (now - receivedAtRef.current) / INTERPOLATION_MS,
      1,
    );

    for (let index = 0; index < rendered.length; index += 1) {
      rendered[index] =
        previous[index] + (current[index] - previous[index]) * progress;
    }

    if (geometry && positionAttribute) {
      positionAttribute.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[renderedPositions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        map={pointTexture}
        alphaTest={0.02}
        size={size}
        sizeAttenuation
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </points>
  );
}

function SelectedObjectMarker({ position }: { position: PositionTuple | null }) {
  const groupRef = useRef<THREE.Group>(null);
  const selectedMarkerRef = useRef<Mesh>(null);
  const selectedHaloRef = useRef<Mesh>(null);
  const previousRef = useRef(new Float32Array(3));
  const currentRef = useRef(new Float32Array(3));
  const receivedAtRef = useRef(0);
  const catIdRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!position) return;

    const next = new Float32Array(3);
    writeScenePosition(next, 0, position[1], position[2], position[3]);

    const previous = previousRef.current;
    const current = currentRef.current;
    const isSameObject = catIdRef.current === position[0];

    if (isSameObject && groupRef.current) {
      previous[0] = groupRef.current.position.x;
      previous[1] = groupRef.current.position.y;
      previous[2] = groupRef.current.position.z;
    } else {
      previous[0] = next[0];
      previous[1] = next[1];
      previous[2] = next[2];
      groupRef.current?.position.set(next[0], next[1], next[2]);
    }

    current[0] = next[0];
    current[1] = next[1];
    current[2] = next[2];
    catIdRef.current = position[0];
    receivedAtRef.current = performance.now();
  }, [position]);

  useFrame(({ clock }) => {
    if (
      !groupRef.current ||
      !selectedMarkerRef.current ||
      !selectedHaloRef.current
    ) {
      return;
    }

    const previous = previousRef.current;
    const current = currentRef.current;
    const progress = Math.min(
      (performance.now() - receivedAtRef.current) / INTERPOLATION_MS,
      1,
    );

    groupRef.current.position.set(
      previous[0] + (current[0] - previous[0]) * progress,
      previous[1] + (current[1] - previous[1]) * progress,
      previous[2] + (current[2] - previous[2]) * progress,
    );

    const cycle = (clock.elapsedTime * 0.8) % 1;
    selectedMarkerRef.current.scale.setScalar(
      1 + Math.sin(clock.elapsedTime * 5) * 0.06,
    );
    selectedHaloRef.current.scale.setScalar(1 + cycle * 2.1);

    const material = selectedHaloRef.current.material;
    if (material instanceof THREE.MeshBasicMaterial) {
      material.opacity = 0.22 * (1 - cycle);
    }
  });

  if (!position) return null;

  return (
    <group ref={groupRef}>
      <mesh ref={selectedHaloRef}>
        <sphereGeometry args={[0.055, 24, 24]} />
        <meshBasicMaterial
          color="#22c55e"
          transparent
          opacity={0.28}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={selectedMarkerRef}>
        <sphereGeometry args={[0.026, 16, 16]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.98} />
      </mesh>
    </group>
  );
}

function GroundStationMarker({ station }: { station: GroundStation }) {
  const markerRef = useRef<Mesh>(null);
  const scenePosition = useMemo(
    () => scenePositionFromGroundStation(station),
    [station],
  );

  useFrame(({ clock }) => {
    if (!markerRef.current) return;
    markerRef.current.scale.setScalar(
      1 + Math.sin(clock.elapsedTime * 3) * 0.08,
    );
  });

  return (
    <group position={scenePosition}>
      <mesh ref={markerRef}>
        <sphereGeometry args={[0.032, 16, 16]} />
        <meshBasicMaterial color="#fb923c" transparent opacity={0.96} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.075, 20, 20]} />
        <meshBasicMaterial
          color="#fb923c"
          transparent
          opacity={0.2}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function LiveSunLight() {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);
  const initialPosition = useMemo(() => {
    return sunLightPositionFromUtc(new Date()).add(
      new THREE.Vector3(0, SCENE_VERTICAL_OFFSET, 0),
    );
  }, []);

  useLayoutEffect(() => {
    if (lightRef.current && targetRef.current) {
      lightRef.current.target = targetRef.current;
    }
  }, []);

  useFrame((_, delta) => {
    if (!lightRef.current) return;

    const targetPosition = sunLightPositionFromUtc(new Date()).add(
      new THREE.Vector3(0, SCENE_VERTICAL_OFFSET, 0),
    );
    const smoothing = 1 - Math.exp(-delta * 1.6);
    lightRef.current.position.lerp(targetPosition, smoothing);
  });

  return (
    <>
      <directionalLight
        ref={lightRef}
        position={initialPosition}
        intensity={3.8}
        color="#fff4df"
      />
      <object3D ref={targetRef} position={[0, SCENE_VERTICAL_OFFSET, 0]} />
    </>
  );
}

export function Scene({
  groupedPositions,
  selectedPosition,
  selectedGroup,
  groundStation,
}: {
  groupedPositions: GroupedPositions;
  selectedPosition: PositionTuple | null;
  selectedGroup: ObjectGroup;
  groundStation: GroundStation;
}) {
  const controlsRef = useRef<OrbitControlsHandle>(null);

  return (
    <>
      <color attach="background" args={["#02040a"]} />
      <ambientLight intensity={0.08} />
      <LiveSunLight />
      <pointLight position={[5, -3, -2]} intensity={0.32} color="#3b82f6" />
      <Stars
        radius={70}
        depth={35}
        count={4200}
        factor={4}
        saturation={0}
        fade
        speed={0.35}
      />
      <group position={[0, SCENE_VERTICAL_OFFSET, 0]}>
        <Earth />
        <TrackedObject
          positions={groupedPositions.other}
          color="#dbeafe"
          opacity={selectedGroup === "other" ? 0.82 : 0.24}
          size={selectedGroup === "other" ? 0.047 : 0.028}
        />
        <TrackedObject
          positions={groupedPositions.starlink}
          color="#bae6fd"
          opacity={selectedGroup === "starlink" ? 0.96 : 0.44}
          size={selectedGroup === "starlink" ? 0.052 : 0.034}
        />
        <TrackedObject
          positions={groupedPositions.stations}
          color="#ffffff"
          opacity={selectedGroup === "stations" ? 1 : 0.78}
          size={selectedGroup === "stations" ? 0.068 : 0.046}
        />
        <SelectedObjectMarker position={selectedPosition} />
        <GroundStationMarker station={groundStation} />
      </group>
      <CameraFocus position={selectedPosition} controlsRef={controlsRef} />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={4.2}
        maxDistance={24}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}
