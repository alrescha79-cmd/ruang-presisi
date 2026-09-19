import { ContactShadows, OrbitControls } from '@react-three/drei'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { Plane, Vector3 } from 'three'
import type { Door, Furniture, Room, WallSide, WallVisibility } from './model'
import { footprint, itemIssues, positionFromWorld } from './model'

type Props = {
  room: Room
  items: Furniture[]
  door: Door
  walls: WallVisibility
  selectedId: string | null
  onSelect: (id: string) => void
  onMove: (id: string, xMm: number, zMm: number) => void
}

const floorPlane = new Plane(new Vector3(0, 1, 0), 0)
const wood = '#6b4328'
const darkWood = '#41271a'
const fabric = '#ddd5c8'
const cane = '#ba9768'
const brass = '#b78a3d'

type WallSegment = { length: number; center: number; height: number; y: number }

function wallSegments(length: number, roomHeight: number, door: Door | null): WallSegment[] {
  if (!door) return [{ length, center: 0, height: roomHeight, y: roomHeight / 2 }]
  const start = door.offsetMm / 1000 - length / 2
  const width = door.widthMm / 1000
  const doorHeight = door.heightMm / 1000
  const left = door.offsetMm / 1000
  const right = length - left - width
  return [
    ...(left > 0 ? [{ length: left, center: -length / 2 + left / 2, height: roomHeight, y: roomHeight / 2 }] : []),
    ...(right > 0 ? [{ length: right, center: start + width + right / 2, height: roomHeight, y: roomHeight / 2 }] : []),
    ...(roomHeight > doorHeight ? [{ length: width, center: start + width / 2, height: roomHeight - doorHeight, y: doorHeight + (roomHeight - doorHeight) / 2 }] : []),
  ]
}

function Box({ size, position, color, roughness = 0.7 }: { size: [number, number, number]; position: [number, number, number]; color: string; roughness?: number }) {
  return <mesh castShadow receiveShadow position={position}><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={roughness} /></mesh>
}

function Wall({ side, room, door }: { side: WallSide; room: Room; door: Door }) {
  const width = room.widthMm / 1000
  const depth = room.depthMm / 1000
  const height = room.heightMm / 1000
  const horizontal = side === 'north' || side === 'south'
  const length = horizontal ? width : depth
  const thickness = 0.08
  const position = horizontal
    ? [0, 0, side === 'north' ? -depth / 2 - thickness / 2 : depth / 2 + thickness / 2] as const
    : [side === 'west' ? -width / 2 - thickness / 2 : width / 2 + thickness / 2, 0, 0] as const

  return wallSegments(length, height, door.side === side ? door : null).map((segment, index) => (
    <mesh key={`${side}-${index}`} receiveShadow castShadow position={horizontal ? [segment.center, segment.y, position[2]] : [position[0], segment.y, segment.center]}>
      <boxGeometry args={horizontal ? [segment.length, segment.height, thickness] : [thickness, segment.height, segment.length]} />
      <meshStandardMaterial color="#dedbd3" roughness={0.92} />
    </mesh>
  ))
}

function Bed({ width, depth, height }: { width: number; depth: number; height: number }) {
  const frameHeight = Math.min(0.18, height * 0.36)
  const mattressHeight = Math.max(0.16, height * 0.46)
  const mattressWidth = width * 0.93
  const mattressDepth = depth * 0.9
  const leg = Math.min(0.09, width * 0.07)
  return <>
    <Box size={[width, frameHeight, depth]} position={[0, frameHeight / 2 + 0.08, 0]} color={darkWood} />
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], index) => <Box key={index} size={[leg, 0.12, leg]} position={[x * (width / 2 - leg), 0.06, z * (depth / 2 - leg)]} color={darkWood} />)}
    <Box size={[mattressWidth, mattressHeight, mattressDepth]} position={[0, frameHeight + mattressHeight / 2 + 0.08, depth * 0.02]} color={fabric} roughness={0.95} />
    <Box size={[width * 0.98, Math.max(0.58, height), 0.07]} position={[0, Math.max(0.58, height) / 2, -depth / 2 + 0.035]} color={wood} />
    {[-0.28, 0.28].map((x) => <Box key={x} size={[width * 0.38, 0.1, depth * 0.2]} position={[width * x, frameHeight + mattressHeight + 0.1, -depth * 0.29]} color="#eee9df" roughness={1} />)}
    <Box size={[mattressWidth, 0.025, depth * 0.26]} position={[0, frameHeight + mattressHeight + 0.015, depth * 0.28]} color="#9c5541" roughness={0.95} />
  </>
}

function Wardrobe({ width, depth, height }: { width: number; depth: number; height: number }) {
  const doorWidth = width * 0.45
  return <>
    <Box size={[width * 0.94, height * 0.9, depth * 0.88]} position={[0, height * 0.48, 0.03]} color={wood} />
    <Box size={[width, height * 0.05, depth]} position={[0, height * 0.975, 0]} color={darkWood} />
    <Box size={[width * 0.98, height * 0.07, depth * 0.95]} position={[0, height * 0.035, 0]} color={darkWood} />
    {[-1, 1].map((side) => <Box key={side} size={[doorWidth, height * 0.78, 0.035]} position={[side * width * 0.235, height * 0.51, depth * 0.47]} color="#765038" />)}
    {[-1, 1].map((side) => <mesh key={side} castShadow position={[side * width * 0.055, height * 0.51, depth * 0.505]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, height * 0.18, 12]} /><meshStandardMaterial color={brass} metalness={0.75} roughness={0.3} /></mesh>)}
  </>
}

function Desk({ width, depth, height }: { width: number; depth: number; height: number }) {
  const top = Math.min(0.07, height * 0.1)
  const leg = Math.min(0.07, width * 0.07)
  return <>
    <Box size={[width, top, depth]} position={[0, height - top / 2, 0]} color={wood} />
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], index) => <Box key={index} size={[leg, height - top, leg]} position={[x * (width / 2 - leg), (height - top) / 2, z * (depth / 2 - leg)]} color={darkWood} />)}
    <Box size={[width * 0.34, height * 0.19, depth * 0.78]} position={[width * 0.27, height * 0.82, 0]} color="#755039" />
    <mesh castShadow position={[width * 0.27, height * 0.82, depth * 0.405]}><sphereGeometry args={[0.025, 12, 8]} /><meshStandardMaterial color={brass} metalness={0.75} roughness={0.3} /></mesh>
  </>
}

function Chair({ width, depth, height }: { width: number; depth: number; height: number }) {
  const seatHeight = height * 0.52
  const leg = Math.min(0.055, width * 0.1)
  return <>
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], index) => <Box key={index} size={[leg, seatHeight, leg]} position={[x * (width / 2 - leg), seatHeight / 2, z * (depth / 2 - leg)]} color={darkWood} />)}
    <Box size={[width, 0.09, depth]} position={[0, seatHeight, 0]} color={wood} />
    <Box size={[width * 0.82, 0.035, depth * 0.78]} position={[0, seatHeight + 0.065, 0]} color={cane} roughness={1} />
    {[-1, 1].map((side) => <Box key={side} size={[leg, height - seatHeight, leg]} position={[side * (width / 2 - leg), seatHeight + (height - seatHeight) / 2, -depth / 2 + leg]} color={darkWood} />)}
    {[0.64, 0.78, 0.92].map((level) => <Box key={level} size={[width * 0.82, 0.045, 0.045]} position={[0, height * level, -depth / 2 + leg]} color={wood} />)}
  </>
}

function FurnitureModel({ item, width, depth, invalid }: { item: Furniture; width: number; depth: number; invalid: boolean }) {
  if (invalid) return <Box size={[width, item.heightMm / 1000, depth]} position={[0, item.heightMm / 2000, 0]} color="#b33b2e" />
  const height = item.heightMm / 1000
  if (item.kind === 'bed') return <Bed width={width} depth={depth} height={height} />
  if (item.kind === 'wardrobe') return <Wardrobe width={width} depth={depth} height={height} />
  if (item.kind === 'desk') return <Desk width={width} depth={depth} height={height} />
  return <Chair width={width} depth={depth} height={height} />
}

function Scene({ room, items, door, walls, selectedId, onSelect, onMove }: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const dragOffset = useRef({ x: 0, z: 0 })
  const width = room.widthMm / 1000
  const depth = room.depthMm / 1000

  function floorPoint(event: ThreeEvent<PointerEvent>) {
    return event.ray.intersectPlane(floorPlane, new Vector3())
  }

  function drag(event: ThreeEvent<PointerEvent>, item: Furniture) {
    event.stopPropagation()
    const point = floorPoint(event)
    if (!point) return
    const position = positionFromWorld(item, room, point.x - dragOffset.current.x, point.z - dragOffset.current.z)
    onMove(item.id, position.xMm, position.zMm)
  }

  return <>
    <color attach="background" args={['#d8d5cf']} />
    <ambientLight color="#fff7ec" intensity={0.9} />
    <hemisphereLight color="#f8eee0" groundColor="#756f68" intensity={1.1} />
    <directionalLight position={[5, 9, 6]} color="#fff1d8" intensity={2.1} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
    <gridHelper args={[Math.max(width, depth) * 1.8, Math.ceil(Math.max(width, depth) * 10), '#8f918d', '#c1c1bc']} position={[0, -0.005, 0]} />
    <mesh receiveShadow position={[0, -0.035, 0]}><boxGeometry args={[width, 0.06, depth]} /><meshStandardMaterial color="#d9d5cc" roughness={0.88} /></mesh>
    {(Object.keys(walls) as WallSide[]).map((side) => walls[side] && <Wall key={side} side={side} room={room} door={door} />)}
    {items.map((item) => {
      const size = footprint(item)
      const issue = itemIssues(item, items, room)
      const itemWidth = size.widthMm / 1000
      const itemDepth = size.depthMm / 1000
      return <group
        key={item.id}
        position={[(item.xMm + size.widthMm / 2) / 1000 - width / 2, 0, (item.zMm + size.depthMm / 2) / 1000 - depth / 2]}
        onPointerDown={(event) => {
          event.stopPropagation()
          ;(event.target as EventTarget & Element).setPointerCapture(event.pointerId)
          const point = floorPoint(event)
          if (point) dragOffset.current = { x: point.x - ((item.xMm + size.widthMm / 2) / 1000 - width / 2), z: point.z - ((item.zMm + size.depthMm / 2) / 1000 - depth / 2) }
          onSelect(item.id)
          setDraggedId(item.id)
        }}
        onPointerMove={(event) => { if (draggedId === item.id) drag(event, item) }}
        onPointerUp={(event) => { event.stopPropagation(); (event.target as EventTarget & Element).releasePointerCapture(event.pointerId); setDraggedId(null) }}
        onPointerCancel={() => setDraggedId(null)}
      >
        <FurnitureModel item={item} width={itemWidth} depth={itemDepth} invalid={issue.outside || issue.collision} />
        {selectedId === item.id && <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[itemWidth + 0.12, itemDepth + 0.12]} /><meshBasicMaterial color="#c78025" wireframe /></mesh>}
      </group>
    })}
    <ContactShadows position={[0, 0.005, 0]} opacity={0.28} scale={Math.max(width, depth) * 1.4} blur={2.2} far={4} />
    <OrbitControls makeDefault enabled={!draggedId} target={[0, 0.5, 0]} maxPolarAngle={Math.PI / 2.05} minDistance={3} maxDistance={16} />
  </>
}

export function RoomCanvas(props: Props) {
  const [cancelKey, setCancelKey] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cancel = () => setCancelKey((key) => key + 1)
    canvas.addEventListener('pointercancel', cancel)
    canvas.addEventListener('lostpointercapture', cancel)
    return () => { canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('lostpointercapture', cancel) }
  }, [])

  return <Canvas ref={canvasRef} shadows dpr={[1, 1.75]} camera={{ position: [5, 6, 7], fov: 42 }} onPointerMissed={() => props.onSelect('')}><Scene key={cancelKey} {...props} /></Canvas>
}
