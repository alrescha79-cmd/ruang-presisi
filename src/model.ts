export type Room = { widthMm: number; depthMm: number; heightMm: number }

export type FurnitureKind =
  | 'bed'
  | 'wardrobe'
  | 'desk'
  | 'chair'
  | 'nightstand'
  | 'shoe_rack'
  | 'coat_rack'
  | 'flower_vase'
  | 'floor_lamp'
  | 'bookshelf'
export type WallSide = 'north' | 'east' | 'south' | 'west'
export type Door = { side: WallSide; offsetMm: number; widthMm: number; heightMm: number }
export type WallVisibility = Record<WallSide, boolean>
export type MeasurementUnit = 'm' | 'cm' | 'mm'
export type RoomProject = { id: string; name: string; room: Room; items: Furniture[]; door: Door; walls: WallVisibility }

export const defaultRoom: Room = { widthMm: 4000, depthMm: 3000, heightMm: 2800 }
export const defaultDoor: Door = { side: 'south', offsetMm: 400, widthMm: 900, heightMm: 2100 }
export const defaultWalls: WallVisibility = { north: true, east: true, south: true, west: true }

export function createRoomProject(id: string, name: string): RoomProject {
  return { id, name, room: { ...defaultRoom }, items: [], door: { ...defaultDoor }, walls: { ...defaultWalls } }
}

const unitFactors: Record<MeasurementUnit, number> = { m: 1000, cm: 10, mm: 1 }

export function fromMillimeters(valueMm: number, unit: MeasurementUnit) {
  return valueMm / unitFactors[unit]
}

export function toMillimeters(value: number, unit: MeasurementUnit) {
  return Math.floor(value * unitFactors[unit] + 0.5 + 1e-9)
}

export function formatMeasurement(valueMm: number, unit: MeasurementUnit) {
  const precision = unit === 'm' ? 3 : unit === 'cm' ? 1 : 0
  return `${Number(fromMillimeters(valueMm, unit).toFixed(precision))} ${unit}`
}

export type Furniture = {
  id: string
  kind: FurnitureKind
  name: string
  widthMm: number
  depthMm: number
  heightMm: number
  xMm: number
  zMm: number
  rotation: number
  color: string
  pillowPosition?: 'top' | 'bottom'
}

export const furnitureCatalog: Record<FurnitureKind, Omit<Furniture, 'id' | 'xMm' | 'zMm'>> = {
  bed: { kind: 'bed', name: 'Tempat tidur', widthMm: 1600, depthMm: 2000, heightMm: 500, rotation: 0, color: '#bb6b4a' },
  wardrobe: { kind: 'wardrobe', name: 'Lemari pakaian', widthMm: 1200, depthMm: 600, heightMm: 2100, rotation: 0, color: '#617d70' },
  desk: { kind: 'desk', name: 'Meja kerja', widthMm: 1200, depthMm: 600, heightMm: 750, rotation: 0, color: '#cf9f55' },
  chair: { kind: 'chair', name: 'Kursi', widthMm: 500, depthMm: 500, heightMm: 850, rotation: 0, color: '#546579' },
  nightstand: { kind: 'nightstand', name: 'Nakas samping', widthMm: 450, depthMm: 400, heightMm: 550, rotation: 0, color: '#7a5230' },
  shoe_rack: { kind: 'shoe_rack', name: 'Rak sepatu', widthMm: 800, depthMm: 320, heightMm: 600, rotation: 0, color: '#5e3f28' },
  coat_rack: { kind: 'coat_rack', name: 'Gantungan baju', widthMm: 450, depthMm: 450, heightMm: 1750, rotation: 0, color: '#4a2c1a' },
  flower_vase: { kind: 'flower_vase', name: 'Vas bunga & meja', widthMm: 400, depthMm: 400, heightMm: 850, rotation: 0, color: '#8c593b' },
  floor_lamp: { kind: 'floor_lamp', name: 'Lampu sudut', widthMm: 400, depthMm: 400, heightMm: 1550, rotation: 0, color: '#d4af37' },
  bookshelf: { kind: 'bookshelf', name: 'Rak buku', widthMm: 800, depthMm: 350, heightMm: 1600, rotation: 0, color: '#5a3825' },
}

export function wallLength(room: Room, side: WallSide) {
  return side === 'north' || side === 'south' ? room.widthMm : room.depthMm
}

export function clampDoor(door: Door, room: Room): Door {
  const maxWidth = wallLength(room, door.side)
  const widthMm = Math.max(600, Math.min(door.widthMm, maxWidth))
  return {
    ...door,
    widthMm,
    heightMm: Math.max(1800, Math.min(door.heightMm, room.heightMm)),
    offsetMm: Math.max(0, Math.min(door.offsetMm, maxWidth - widthMm)),
  }
}

export function normalizeRotation(deg: number) {
  const mod = Math.round(deg) % 360
  return mod < 0 ? mod + 360 : mod
}

export function bedPillowCenters(item: Furniture) {
  const end = item.pillowPosition === 'bottom' ? 1 : -1
  const angle = (normalizeRotation(item.rotation) * Math.PI) / 180
  const size = footprint(item)
  const centerX = size.widthMm / 2
  const centerZ = size.depthMm / 2
  return [-0.28, 0.28].map((offset) => ({
    xMm: Math.round(centerX + offset * item.widthMm * Math.cos(angle) + end * item.depthMm * 0.29 * Math.sin(angle)),
    zMm: Math.round(centerZ - offset * item.widthMm * Math.sin(angle) + end * item.depthMm * 0.29 * Math.cos(angle)),
  }))
}

export function toggleItemSelection(selectedIds: string[], id: string, additive = false): string[] {
  if (!id) return additive ? selectedIds : []
  if (!additive) return [id]
  return selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]
}

export type RectBox = { minX: number; minY: number; maxX: number; maxY: number }

export function normalizeBox(x1: number, y1: number, x2: number, y2: number): RectBox {
  return {
    minX: Math.min(x1, x2),
    minY: Math.min(y1, y2),
    maxX: Math.max(x1, x2),
    maxY: Math.max(y1, y2),
  }
}

export function isBoxIntersecting(boxA: RectBox, boxB: RectBox): boolean {
  return boxA.minX <= boxB.maxX && boxA.maxX >= boxB.minX && boxA.minY <= boxB.maxY && boxA.maxY >= boxB.minY
}

export function mergeBoxSelection(currentIds: string[], boxSelectedIds: string[], additive = false): string[] {
  if (!additive) return [...boxSelectedIds]
  const combined = new Set([...currentIds, ...boxSelectedIds])
  return Array.from(combined)
}

export function footprint(item: Furniture) {
  const rot = normalizeRotation(item.rotation ?? 0)
  if (rot === 90 || rot === 270) {
    return { widthMm: item.depthMm, depthMm: item.widthMm }
  }
  if (rot === 0 || rot === 180) {
    return { widthMm: item.widthMm, depthMm: item.depthMm }
  }
  const rad = (rot * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  return {
    widthMm: Math.round(item.widthMm * cos + item.depthMm * sin),
    depthMm: Math.round(item.widthMm * sin + item.depthMm * cos),
  }
}

export function itemIssues(item: Furniture, items: Furniture[], room: Room) {
  const size = footprint(item)
  const outside = item.xMm < 0 || item.zMm < 0 || item.xMm + size.widthMm > room.widthMm || item.zMm + size.depthMm > room.depthMm || item.heightMm > room.heightMm
  const collision = items.some((other) => {
    if (other.id === item.id) return false
    const otherSize = footprint(other)
    return item.xMm < other.xMm + otherSize.widthMm && item.xMm + size.widthMm > other.xMm && item.zMm < other.zMm + otherSize.depthMm && item.zMm + size.depthMm > other.zMm
  })
  return { outside, collision }
}

export function positionFromWorld(item: Furniture, room: Room, worldX: number, worldZ: number) {
  const size = footprint(item)
  return {
    xMm: Math.round((worldX + room.widthMm / 2000) * 1000 - size.widthMm / 2),
    zMm: Math.round((worldZ + room.depthMm / 2000) * 1000 - size.depthMm / 2),
  }
}

export function clampItem(item: Furniture, room: Room): Furniture {
  const size = footprint(item)
  return {
    ...item,
    xMm: Math.max(0, Math.min(item.xMm, room.widthMm - size.widthMm)),
    zMm: Math.max(0, Math.min(item.zMm, room.depthMm - size.depthMm)),
  }
}

export function findEmptyPosition(
  template: Omit<Furniture, 'id' | 'xMm' | 'zMm'>,
  items: Furniture[],
  room: Room,
  door?: Door
): { xMm: number; zMm: number } {
  const dummy: Furniture = { ...template, id: '__temp__', xMm: 0, zMm: 0 }
  const size = footprint(dummy)
  const wallPadding = 150
  const itemPadding = 80
  const step = 100

  const safeMaxX = Math.max(0, room.widthMm - size.widthMm)
  const safeMaxZ = Math.max(0, room.depthMm - size.depthMm)
  const safeMinX = Math.min(wallPadding, safeMaxX)
  const safeMinZ = Math.min(wallPadding, safeMaxZ)

  function collides(x: number, z: number, padding: number): boolean {
    return items.some((item) => {
      const otherSize = footprint(item)
      return (
        x < item.xMm + otherSize.widthMm + padding &&
        x + size.widthMm + padding > item.xMm &&
        z < item.zMm + otherSize.depthMm + padding &&
        z + size.depthMm + padding > item.zMm
      )
    })
  }

  function inDoorZone(x: number, z: number): boolean {
    if (!door) return false
    const doorBuffer = 750
    if (door.side === 'south') {
      return z + size.depthMm > room.depthMm - doorBuffer && x + size.widthMm > door.offsetMm && x < door.offsetMm + door.widthMm
    }
    if (door.side === 'north') {
      return z < doorBuffer && x + size.widthMm > door.offsetMm && x < door.offsetMm + door.widthMm
    }
    if (door.side === 'west') {
      return x < doorBuffer && z + size.depthMm > door.offsetMm && z < door.offsetMm + door.widthMm
    }
    if (door.side === 'east') {
      return x + size.widthMm > room.widthMm - doorBuffer && z + size.depthMm > door.offsetMm && z < door.offsetMm + door.widthMm
    }
    return false
  }

  // Pass 1: Comfortable clearance from other items and outside door swing area
  for (let z = safeMinZ; z <= safeMaxZ; z += step) {
    for (let x = safeMinX; x <= safeMaxX; x += step) {
      if (!collides(x, z, itemPadding) && !inDoorZone(x, z)) {
        return { xMm: x, zMm: z }
      }
    }
  }

  // Pass 2: Tighter clearance avoiding door area
  for (let z = 0; z <= safeMaxZ; z += step) {
    for (let x = 0; x <= safeMaxX; x += step) {
      if (!collides(x, z, 20) && !inDoorZone(x, z)) {
        return { xMm: x, zMm: z }
      }
    }
  }

  // Pass 3: Anywhere with zero collision
  for (let z = 0; z <= safeMaxZ; z += step) {
    for (let x = 0; x <= safeMaxX; x += step) {
      if (!collides(x, z, 5)) {
        return { xMm: x, zMm: z }
      }
    }
  }

  // Pass 4: Fallback - position with minimal overlap
  let bestScore = Infinity
  let bestPos = { xMm: Math.max(0, Math.min(200, safeMaxX)), zMm: Math.max(0, Math.min(200, safeMaxZ)) }

  for (let z = 0; z <= safeMaxZ; z += step * 2) {
    for (let x = 0; x <= safeMaxX; x += step * 2) {
      let overlapArea = 0
      for (const item of items) {
        const otherSize = footprint(item)
        const overlapW = Math.max(0, Math.min(x + size.widthMm, item.xMm + otherSize.widthMm) - Math.max(x, item.xMm))
        const overlapD = Math.max(0, Math.min(z + size.depthMm, item.zMm + otherSize.depthMm) - Math.max(z, item.zMm))
        overlapArea += overlapW * overlapD
      }
      if (overlapArea < bestScore) {
        bestScore = overlapArea
        bestPos = { xMm: x, zMm: z }
        if (overlapArea === 0) return bestPos
      }
    }
  }

  return bestPos
}
