import { OrbitControls } from '@react-three/drei'
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
      <meshStandardMaterial color="#d7d1c4" />
    </mesh>
  ))
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

  return (
    <>
      <color attach="background" args={['#dde0da']} />
      <ambientLight intensity={1.7} />
      <directionalLight position={[4, 8, 5]} intensity={2.2} castShadow />
      <gridHelper args={[Math.max(width, depth) * 1.8, Math.ceil(Math.max(width, depth) * 10), '#98a09a', '#c5c9c3']} position={[0, -0.005, 0]} />
      <mesh receiveShadow position={[0, -0.035, 0]}>
        <boxGeometry args={[width, 0.06, depth]} />
        <meshStandardMaterial color="#e8e5dd" />
      </mesh>
      {(Object.keys(walls) as WallSide[]).map((side) => walls[side] && <Wall key={side} side={side} room={room} door={door} />)}
      {items.map((item) => {
        const size = footprint(item)
        const issue = itemIssues(item, items, room)
        return (
          <group
            key={item.id}
            position={[(item.xMm + size.widthMm / 2) / 1000 - width / 2, 0, (item.zMm + size.depthMm / 2) / 1000 - depth / 2]}
            onPointerDown={(event) => {
              event.stopPropagation()
              ;(event.target as EventTarget & Element).setPointerCapture(event.pointerId)
              const point = floorPoint(event)
              if (point) {
                dragOffset.current = {
                  x: point.x - ((item.xMm + size.widthMm / 2) / 1000 - width / 2),
                  z: point.z - ((item.zMm + size.depthMm / 2) / 1000 - depth / 2),
                }
              }
              onSelect(item.id)
              setDraggedId(item.id)
            }}
            onPointerMove={(event) => { if (draggedId === item.id) drag(event, item) }}
            onPointerUp={(event) => {
              event.stopPropagation()
              ;(event.target as EventTarget & Element).releasePointerCapture(event.pointerId)
              setDraggedId(null)
            }}
            onPointerCancel={() => setDraggedId(null)}
          >
            <mesh castShadow position={[0, item.heightMm / 2000, 0]}>
              <boxGeometry args={[size.widthMm / 1000, item.heightMm / 1000, size.depthMm / 1000]} />
              <meshStandardMaterial color={issue.outside || issue.collision ? '#b83b2f' : item.color} />
            </mesh>
            {selectedId === item.id && (
              <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[size.widthMm / 1000 + 0.12, size.depthMm / 1000 + 0.12]} />
                <meshBasicMaterial color="#12695b" wireframe />
              </mesh>
            )}
          </group>
        )
      })}
      <OrbitControls makeDefault enabled={!draggedId} target={[0, 0, 0]} maxPolarAngle={Math.PI / 2.05} minDistance={3} maxDistance={16} />
    </>
  )
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
    return () => {
      canvas.removeEventListener('pointercancel', cancel)
      canvas.removeEventListener('lostpointercapture', cancel)
    }
  }, [])

  return (
    <Canvas ref={canvasRef} shadows camera={{ position: [5, 6, 7], fov: 42 }} onPointerMissed={() => props.onSelect('')}>
      <Scene key={cancelKey} {...props} />
    </Canvas>
  )
}
