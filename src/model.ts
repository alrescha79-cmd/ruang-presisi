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
  rotation: 0 | 90
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

export function footprint(item: Furniture) {
  return item.rotation === 90
    ? { widthMm: item.depthMm, depthMm: item.widthMm }
    : { widthMm: item.widthMm, depthMm: item.depthMm }
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
