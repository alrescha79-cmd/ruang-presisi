import { ContactShadows, OrbitControls } from '@react-three/drei'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { MOUSE, Plane, Vector3, type Camera } from 'three'
import type { Door, Furniture, RectBox, Room, WallSide, WallVisibility } from './model'
import { footprint, isBoxIntersecting, itemIssues, normalizeBox, positionFromWorld } from './model'

export type ViewportMode = 'select' | 'pan' | 'orbit'

export type Props = {
  room: Room
  items: Furniture[]
  door: Door
  walls: WallVisibility
  selectedIds: string[]
  mode: ViewportMode
  onSelect: (id: string, additive?: boolean) => void
  onBoxSelect?: (ids: string[], additive?: boolean) => void
  onMove: (id: string, xMm: number, zMm: number) => void
  onCanvasReady?: (canvas: HTMLCanvasElement) => void
}

type SceneProps = Props & {
  setMarqueeRect: (rect: { left: number; top: number; width: number; height: number } | null) => void
}

const floorPlane = new Plane(new Vector3(0, 1, 0), 0)
const wood = '#6b4328'
const darkWood = '#41271a'
const fabric = '#ddd5c8'
const cane = '#ba9768'
const brass = '#b78a3d'
const porcelain = '#ece7df'
const leafGreen = '#385e32'
const flowerPetal = '#c24836'
const leather = '#3c281e'
const bookColors = ['#873926', '#314b5c', '#475e3a', '#c29241', '#e8dfcc']

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

function Bed({ width, depth, height, pillowPosition }: { width: number; depth: number; height: number; pillowPosition: 'top' | 'bottom' }) {
  const frameHeight = Math.min(0.18, height * 0.36)
  const pillowEnd = pillowPosition === 'top' ? -1 : 1
  const mattressHeight = Math.max(0.16, height * 0.46)
  const mattressWidth = width * 0.93
  const mattressDepth = depth * 0.9
  const leg = Math.min(0.09, width * 0.07)
  return <>
    <Box size={[width, frameHeight, depth]} position={[0, frameHeight / 2 + 0.08, 0]} color={darkWood} />
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], index) => <Box key={index} size={[leg, 0.12, leg]} position={[x * (width / 2 - leg), 0.06, z * (depth / 2 - leg)]} color={darkWood} />)}
    <Box size={[mattressWidth, mattressHeight, mattressDepth]} position={[0, frameHeight + mattressHeight / 2 + 0.08, depth * 0.02]} color={fabric} roughness={0.95} />
    <Box size={[width * 0.98, Math.max(0.58, height), 0.07]} position={[0, Math.max(0.58, height) / 2, pillowEnd * (depth / 2 - 0.035)]} color={wood} />
    {[-0.28, 0.28].map((x) => <Box key={x} size={[width * 0.38, 0.1, depth * 0.2]} position={[width * x, frameHeight + mattressHeight + 0.1, pillowEnd * depth * 0.29]} color="#eee9df" roughness={1} />)}
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

function Nightstand({ width, depth, height }: { width: number; depth: number; height: number }) {
  const leg = Math.min(0.045, width * 0.1)
  const topThick = 0.03
  const drawerHeight = height * 0.42
  const shelfY = height * 0.18
  return <>
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], index) => (
      <Box key={index} size={[leg, height - topThick, leg]} position={[x * (width / 2 - leg / 2), (height - topThick) / 2, z * (depth / 2 - leg / 2)]} color={darkWood} />
    ))}
    <Box size={[width, topThick, depth]} position={[0, height - topThick / 2, 0]} color={wood} />
    <Box size={[width * 0.9, drawerHeight, depth * 0.9]} position={[0, height - topThick - drawerHeight / 2, 0]} color="#755038" />
    <Box size={[width * 0.84, drawerHeight * 0.85, 0.02]} position={[0, height - topThick - drawerHeight / 2, depth * 0.46]} color={wood} />
    <mesh castShadow position={[0, height - topThick - drawerHeight / 2, depth * 0.48]}>
      <sphereGeometry args={[0.015, 12, 8]} />
      <meshStandardMaterial color={brass} metalness={0.8} roughness={0.25} />
    </mesh>
    <Box size={[width * 0.88, 0.02, depth * 0.88]} position={[0, shelfY, 0]} color={wood} />
  </>
}

function ShoeRack({ width, depth, height }: { width: number; depth: number; height: number }) {
  const leg = Math.min(0.045, width * 0.06)
  const tierCount = 3
  const tierSpacing = (height - 0.05) / (tierCount - 1)
  return <>
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], index) => (
      <Box key={index} size={[leg, height, leg]} position={[x * (width / 2 - leg / 2), height / 2, z * (depth / 2 - leg / 2)]} color={darkWood} />
    ))}
    <Box size={[width, 0.025, depth]} position={[0, height - 0.0125, 0]} color={wood} />
    {[0, 1].map((tier) => {
      const y = 0.08 + tier * tierSpacing
      return (
        <group key={tier}>
          {[-0.35, -0.12, 0.12, 0.35].map((slatZ) => (
            <Box key={slatZ} size={[width * 0.94, 0.015, depth * 0.15]} position={[0, y, slatZ * depth]} color={wood} />
          ))}
        </group>
      )
    })}
    {[-0.22, 0.22].map((x) => (
      <group key={x} position={[x * width, 0.08 + tierSpacing + 0.025, 0]}>
        <Box size={[width * 0.11, 0.035, depth * 0.55]} position={[-width * 0.065, 0, 0]} color={leather} roughness={0.85} />
        <Box size={[width * 0.11, 0.035, depth * 0.55]} position={[width * 0.065, 0, 0]} color={leather} roughness={0.85} />
      </group>
    ))}
  </>
}

function CoatRack({ width, depth, height }: { width: number; depth: number; height: number }) {
  const poleRadius = Math.min(0.032, width * 0.07)
  return <>
    <Box size={[width * 0.88, 0.04, width * 0.14]} position={[0, 0.02, 0]} color={darkWood} />
    <Box size={[width * 0.14, 0.04, depth * 0.88]} position={[0, 0.02, 0]} color={darkWood} />
    <mesh castShadow position={[0, height * 0.48, 0]}>
      <cylinderGeometry args={[poleRadius, poleRadius * 1.25, height * 0.94, 16]} />
      <meshStandardMaterial color={darkWood} roughness={0.7} />
    </mesh>
    <mesh castShadow position={[0, height * 0.965, 0]}>
      <sphereGeometry args={[poleRadius * 1.4, 16, 12]} />
      <meshStandardMaterial color={brass} metalness={0.8} roughness={0.3} />
    </mesh>
    {[[0, 0, 1], [1, 0, 0], [0, 0, -1], [-1, 0, 0]].map(([dx, , dz], i) => (
      <group key={i} position={[dx * width * 0.18, height * 0.86, dz * depth * 0.18]}>
        <Box size={[dx !== 0 ? width * 0.22 : 0.025, 0.025, dz !== 0 ? depth * 0.22 : 0.025]} position={[0, 0, 0]} color={wood} />
        <mesh castShadow position={[dx * 0.04, 0.025, dz * 0.04]}>
          <sphereGeometry args={[0.02, 10, 8]} />
          <meshStandardMaterial color={brass} metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
    ))}
    {[[0.7, 0, 0.7], [-0.7, 0, 0.7], [-0.7, 0, -0.7], [0.7, 0, -0.7]].map(([dx, , dz], i) => (
      <group key={`mid-${i}`} position={[dx * width * 0.14, height * 0.65, dz * depth * 0.14]}>
        <Box size={[0.022, 0.022, 0.022]} position={[0, 0, 0]} color={wood} />
        <mesh castShadow position={[dx * 0.03, 0.02, dz * 0.03]}>
          <sphereGeometry args={[0.016, 10, 8]} />
          <meshStandardMaterial color={brass} metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
    ))}
  </>
}

function FlowerVase({ width, depth, height }: { width: number; depth: number; height: number }) {
  const tableHeight = height * 0.58
  const leg = Math.min(0.04, width * 0.08)
  const vaseHeight = height * 0.28
  return <>
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], index) => (
      <Box key={index} size={[leg, tableHeight, leg]} position={[x * (width / 2 - leg / 2), tableHeight / 2, z * (depth / 2 - leg / 2)]} color={darkWood} />
    ))}
    <Box size={[width * 0.85, 0.02, 0.02]} position={[0, tableHeight * 0.25, 0]} color={darkWood} />
    <Box size={[0.02, 0.02, depth * 0.85]} position={[0, tableHeight * 0.25, 0]} color={darkWood} />
    <Box size={[width * 0.95, 0.03, depth * 0.95]} position={[0, tableHeight + 0.015, 0]} color={wood} />
    <mesh castShadow position={[0, tableHeight + 0.03 + vaseHeight * 0.42, 0]}>
      <cylinderGeometry args={[width * 0.14, width * 0.22, vaseHeight * 0.84, 16]} />
      <meshStandardMaterial color={porcelain} roughness={0.25} metalness={0.08} />
    </mesh>
    <mesh castShadow position={[0, tableHeight + 0.03 + vaseHeight * 0.9, 0]}>
      <cylinderGeometry args={[width * 0.09, width * 0.12, vaseHeight * 0.24, 16]} />
      <meshStandardMaterial color={porcelain} roughness={0.25} metalness={0.08} />
    </mesh>
    {[-0.12, 0, 0.12].map((ox, i) => (
      <mesh key={i} castShadow position={[ox * width, tableHeight + 0.03 + vaseHeight + 0.06, (i % 2 === 0 ? 0.05 : -0.05) * depth]}>
        <sphereGeometry args={[width * 0.12, 8, 8]} />
        <meshStandardMaterial color={leafGreen} roughness={0.8} />
      </mesh>
    ))}
    {[-0.08, 0.08].map((ox, i) => (
      <mesh key={i} castShadow position={[ox * width, tableHeight + 0.03 + vaseHeight + 0.13, 0]}>
        <sphereGeometry args={[width * 0.06, 12, 8]} />
        <meshStandardMaterial color={flowerPetal} roughness={0.65} />
      </mesh>
    ))}
  </>
}

function FloorLamp({ width, depth, height }: { width: number; depth: number; height: number }) {
  const size = Math.min(width, depth)
  const baseRadius = size * 0.38
  const shadeRadius = size * 0.38
  const shadeHeight = height * 0.22
  const poleRadius = 0.016
  return <>
    <mesh castShadow receiveShadow position={[0, 0.025, 0]}>
      <cylinderGeometry args={[baseRadius, baseRadius * 1.05, 0.05, 24]} />
      <meshStandardMaterial color={darkWood} roughness={0.65} />
    </mesh>
    <mesh castShadow position={[0, 0.055, 0]}>
      <cylinderGeometry args={[baseRadius * 0.5, baseRadius * 0.6, 0.015, 24]} />
      <meshStandardMaterial color={brass} metalness={0.85} roughness={0.25} />
    </mesh>
    <mesh castShadow position={[0, height * 0.45, 0]}>
      <cylinderGeometry args={[poleRadius, poleRadius, height * 0.82, 16]} />
      <meshStandardMaterial color={brass} metalness={0.85} roughness={0.25} />
    </mesh>
    <mesh castShadow position={[0, height * 0.86, 0]}>
      <cylinderGeometry args={[shadeRadius * 0.85, shadeRadius, shadeHeight, 24, 1, true]} />
      <meshStandardMaterial color="#faf2e3" roughness={0.95} side={2} />
    </mesh>
    <mesh position={[0, height * 0.86, 0]}>
      <sphereGeometry args={[0.045, 16, 12]} />
      <meshStandardMaterial color="#fff4df" emissive="#ffc46b" emissiveIntensity={1.4} roughness={0.2} />
    </mesh>
  </>
}

function Bookshelf({ width, depth, height }: { width: number; depth: number; height: number }) {
  const sideThick = 0.035
  const shelfThick = 0.025
  const shelves = 4
  const shelfStep = (height - shelfThick) / (shelves + 1)
  const innerWidth = width - sideThick * 2
  return <>
    <Box size={[sideThick, height, depth]} position={[-width / 2 + sideThick / 2, height / 2, 0]} color={darkWood} />
    <Box size={[sideThick, height, depth]} position={[width / 2 - sideThick / 2, height / 2, 0]} color={darkWood} />
    <Box size={[width, sideThick, depth]} position={[0, height - sideThick / 2, 0]} color={darkWood} />
    <Box size={[width, sideThick * 1.5, depth]} position={[0, sideThick * 0.75, 0]} color={darkWood} />
    <Box size={[innerWidth, height - sideThick * 2, 0.015]} position={[0, height / 2, -depth / 2 + 0.01]} color="#563420" />
    {[1, 2, 3, 4].map((level) => {
      const y = level * shelfStep
      return (
        <group key={level}>
          <Box size={[innerWidth, shelfThick, depth * 0.95]} position={[0, y, 0]} color={wood} />
          {[-0.28, -0.15, -0.03, 0.1, 0.22].map((bx, bIdx) => {
            const bWidth = 0.04 + (bIdx % 3) * 0.015
            const bHeight = 0.16 + (bIdx % 4) * 0.03
            const bColor = bookColors[(level + bIdx) % bookColors.length]
            return (
              <Box
                key={bIdx}
                size={[bWidth, bHeight, depth * 0.65]}
                position={[bx * innerWidth, y + shelfThick / 2 + bHeight / 2, 0.02]}
                color={bColor}
                roughness={0.8}
              />
            )
          })}
        </group>
      )
    })}
  </>
}

function FurnitureModel({ item, width, depth, invalid }: { item: Furniture; width: number; depth: number; invalid: boolean }) {
  if (invalid) return <Box size={[width, item.heightMm / 1000, depth]} position={[0, item.heightMm / 2000, 0]} color="#b33b2e" />
  const height = item.heightMm / 1000
  if (item.kind === 'bed') return <Bed width={width} depth={depth} height={height} pillowPosition={item.pillowPosition ?? 'top'} />
  if (item.kind === 'wardrobe') return <Wardrobe width={width} depth={depth} height={height} />
  if (item.kind === 'desk') return <Desk width={width} depth={depth} height={height} />
  if (item.kind === 'chair') return <Chair width={width} depth={depth} height={height} />
  if (item.kind === 'nightstand') return <Nightstand width={width} depth={depth} height={height} />
  if (item.kind === 'shoe_rack') return <ShoeRack width={width} depth={depth} height={height} />
  if (item.kind === 'coat_rack') return <CoatRack width={width} depth={depth} height={height} />
  if (item.kind === 'flower_vase') return <FlowerVase width={width} depth={depth} height={height} />
  if (item.kind === 'floor_lamp') return <FloorLamp width={width} depth={depth} height={height} />
  if (item.kind === 'bookshelf') return <Bookshelf width={width} depth={depth} height={height} />
  return <Box size={[width, height, depth]} position={[0, height / 2, 0]} color={item.color} />
}

function getItemScreenBox(item: Furniture, room: Room, camera: Camera, width: number, height: number): RectBox {
  const size = footprint(item)
  const halfW = size.widthMm / 2000
  const halfD = size.depthMm / 2000
  const h = item.heightMm / 1000
  const cx = (item.xMm + size.widthMm / 2) / 1000 - room.widthMm / 2000
  const cz = (item.zMm + size.depthMm / 2) / 1000 - room.depthMm / 2000

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  const corners = [
    new Vector3(cx - halfW, 0, cz - halfD),
    new Vector3(cx + halfW, 0, cz - halfD),
    new Vector3(cx - halfW, 0, cz + halfD),
    new Vector3(cx + halfW, 0, cz + halfD),
    new Vector3(cx - halfW, h, cz - halfD),
    new Vector3(cx + halfW, h, cz - halfD),
    new Vector3(cx - halfW, h, cz + halfD),
    new Vector3(cx + halfW, h, cz + halfD),
  ]

  for (const corner of corners) {
    corner.project(camera)
    const sx = (corner.x * 0.5 + 0.5) * width
    const sy = (-corner.y * 0.5 + 0.5) * height
    if (sx < minX) minX = sx
    if (sx > maxX) maxX = sx
    if (sy < minY) minY = sy
    if (sy > maxY) maxY = sy
  }

  return { minX, minY, maxX, maxY }
}

function BackgroundMarquee({
  room,
  items,
  mode,
  onSelect,
  onBoxSelect,
  setMarqueeRect,
}: {
  room: Room
  items: Furniture[]
  mode: ViewportMode
  onSelect: (id: string, additive?: boolean) => void
  onBoxSelect?: (ids: string[], additive?: boolean) => void
  setMarqueeRect: (rect: { left: number; top: number; width: number; height: number } | null) => void
}) {
  const { camera, size, gl } = useThree()
  const startRef = useRef<{ x: number; y: number; additive: boolean } | null>(null)
  const isDraggingRef = useRef(false)

  return (
    <mesh
      position={[0, -0.01, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={(event) => {
        if (mode !== 'select' || event.button !== 0) return
        event.stopPropagation()
        ;(event.target as Element).setPointerCapture(event.pointerId)
        const rect = gl.domElement.getBoundingClientRect()
        startRef.current = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          additive: event.nativeEvent.shiftKey || event.nativeEvent.ctrlKey || event.nativeEvent.metaKey,
        }
        isDraggingRef.current = false
      }}
      onPointerMove={(event) => {
        if (!startRef.current) return
        event.stopPropagation()
        const rect = gl.domElement.getBoundingClientRect()
        const currentX = event.clientX - rect.left
        const currentY = event.clientY - rect.top
        const dx = currentX - startRef.current.x
        const dy = currentY - startRef.current.y
        if (!isDraggingRef.current && Math.hypot(dx, dy) > 6) {
          isDraggingRef.current = true
        }
        if (isDraggingRef.current) {
          setMarqueeRect({
            left: Math.min(startRef.current.x, currentX),
            top: Math.min(startRef.current.y, currentY),
            width: Math.abs(dx),
            height: Math.abs(dy),
          })
        }
      }}
      onPointerUp={(event) => {
        if (!startRef.current) return
        event.stopPropagation()
        ;(event.target as Element).releasePointerCapture(event.pointerId)
        const rect = gl.domElement.getBoundingClientRect()
        const currentX = event.clientX - rect.left
        const currentY = event.clientY - rect.top
        const { additive } = startRef.current

        if (isDraggingRef.current) {
          const box = normalizeBox(startRef.current.x, startRef.current.y, currentX, currentY)
          const hitIds = items
            .filter((item) => {
              const itemBox = getItemScreenBox(item, room, camera, size.width, size.height)
              return isBoxIntersecting(box, itemBox)
            })
            .map((item) => item.id)

          onBoxSelect?.(hitIds, additive)
        } else {
          if (!additive) onSelect('', false)
        }

        startRef.current = null
        isDraggingRef.current = false
        setMarqueeRect(null)
      }}
    >
      <planeGeometry args={[300, 300]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

function Scene({ room, items, door, walls, selectedIds, mode, onSelect, onBoxSelect, onMove, setMarqueeRect }: SceneProps) {
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

  const orbitMouseButtons = {
    select: { LEFT: -1 as unknown as MOUSE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE },
    pan: { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE },
    orbit: { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN },
  }[mode]

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
      const isSelected = selectedIds.includes(item.id)

      return <group
        key={item.id}
        position={[(item.xMm + size.widthMm / 2) / 1000 - width / 2, 0, (item.zMm + size.depthMm / 2) / 1000 - depth / 2]}
        onPointerDown={(event) => {
          if (mode !== 'select') return
          event.stopPropagation()
          ;(event.target as EventTarget & Element).setPointerCapture(event.pointerId)
          const point = floorPoint(event)
          if (point) dragOffset.current = { x: point.x - ((item.xMm + size.widthMm / 2) / 1000 - width / 2), z: point.z - ((item.zMm + size.depthMm / 2) / 1000 - depth / 2) }
          const isAdditive = event.nativeEvent.shiftKey || event.nativeEvent.ctrlKey || event.nativeEvent.metaKey
          onSelect(item.id, isAdditive)
          setDraggedId(item.id)
        }}
        onPointerMove={(event) => { if (draggedId === item.id) drag(event, item) }}
        onPointerUp={(event) => {
          if (mode !== 'select') return
          event.stopPropagation()
          ;(event.target as EventTarget & Element).releasePointerCapture(event.pointerId)
          setDraggedId(null)
        }}
        onPointerCancel={() => setDraggedId(null)}
      >
        <group rotation={[0, ((item.rotation ?? 0) * Math.PI) / 180, 0]}>
          <FurnitureModel item={item} width={item.widthMm / 1000} depth={item.depthMm / 1000} invalid={issue.outside || issue.collision} />
        </group>
        {isSelected && (
          <group position={[0, 0.012, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[itemWidth + 0.12, itemDepth + 0.12]} />
              <meshBasicMaterial color="#d59a35" wireframe />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[itemWidth + 0.1, itemDepth + 0.1]} />
              <meshBasicMaterial color="#e0a43e" transparent opacity={0.2} />
            </mesh>
          </group>
        )}
      </group>
    })}
    <ContactShadows position={[0, 0.005, 0]} opacity={0.28} scale={Math.max(width, depth) * 1.4} blur={2.2} far={4} />
    <OrbitControls
      makeDefault
      enabled={!draggedId}
      target={[0, 0.5, 0]}
      maxPolarAngle={Math.PI / 2.05}
      minDistance={1.8}
      maxDistance={16}
      mouseButtons={orbitMouseButtons}
    />
    <BackgroundMarquee
      room={room}
      items={items}
      mode={mode}
      onSelect={onSelect}
      onBoxSelect={onBoxSelect}
      setMarqueeRect={setMarqueeRect}
    />
  </>
}

export function RoomCanvas(props: Props) {
  const [cancelKey, setCancelKey] = useState(0)
  const [marqueeRect, setMarqueeRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { onCanvasReady } = props

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    onCanvasReady?.(canvas)
    const cancel = () => setCancelKey((key) => key + 1)
    canvas.addEventListener('pointercancel', cancel)
    canvas.addEventListener('lostpointercapture', cancel)
    return () => { canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('lostpointercapture', cancel) }
  }, [onCanvasReady])

  return (
    <div className="canvas-wrapper" data-mode={props.mode}>
      <Canvas ref={canvasRef} shadows dpr={[1, 1.75]} gl={{ preserveDrawingBuffer: true }} camera={{ position: [4.4, 5.2, 6.2], fov: 40 }}>
        <Scene key={cancelKey} {...props} setMarqueeRect={setMarqueeRect} />
      </Canvas>
      {marqueeRect && (
        <div
          className="marquee-overlay"
          style={{
            left: marqueeRect.left,
            top: marqueeRect.top,
            width: marqueeRect.width,
            height: marqueeRect.height,
          }}
        />
      )}
    </div>
  )
}
