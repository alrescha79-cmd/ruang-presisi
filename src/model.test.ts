import { describe, expect, it } from 'vitest'
import { bedPillowCenters, clampDoor, clampItem, createRoomProject, findEmptyPosition, footprint, formatMeasurement, fromMillimeters, itemIssues, furnitureCatalog, isBoxIntersecting, mergeBoxSelection, normalizeBox, positionFromWorld, toMillimeters, toggleItemSelection, wallLength, type Furniture, type Door } from './model'

const bed: Furniture = { ...furnitureCatalog.bed, id: 'bed', xMm: 0, zMm: 0 }
const room = { widthMm: 4000, depthMm: 3000, heightMm: 2800 }

describe('measurement units', () => {
  it('converts without losing millimeter precision', () => {
    expect(fromMillimeters(1234, 'm')).toBe(1.234)
    expect(fromMillimeters(1234, 'cm')).toBe(123.4)
    expect(toMillimeters(1.234, 'm')).toBe(1234)
    expect(toMillimeters(123.4, 'cm')).toBe(1234)
    expect(toMillimeters(4.0005, 'm')).toBe(4001)
    expect(toMillimeters(400.05, 'cm')).toBe(4001)
    expect(toMillimeters(4000.5, 'mm')).toBe(4001)
    expect(formatMeasurement(1200, 'm')).toBe('1.2 m')
  })
})

describe('furniture geometry', () => {
  it('swaps footprint dimensions after rotation', () => {
    expect(footprint({ ...bed, rotation: 0 })).toEqual({ widthMm: 1600, depthMm: 2000 })
    expect(footprint({ ...bed, rotation: 90 })).toEqual({ widthMm: 2000, depthMm: 1600 })
    expect(footprint({ ...bed, rotation: 180 })).toEqual({ widthMm: 1600, depthMm: 2000 })
    expect(footprint({ ...bed, rotation: 270 })).toEqual({ widthMm: 2000, depthMm: 1600 })
    expect(footprint({ ...bed, rotation: 360 })).toEqual({ widthMm: 1600, depthMm: 2000 })
    expect(footprint({ ...bed, rotation: -90 })).toEqual({ widthMm: 2000, depthMm: 1600 })
  })

  it('rotates bed pillows with the bed footprint', () => {
    expect(bedPillowCenters({ ...bed, pillowPosition: 'top', rotation: 0 })).toEqual([{ xMm: 352, zMm: 420 }, { xMm: 1248, zMm: 420 }])
    expect(bedPillowCenters({ ...bed, pillowPosition: 'top', rotation: 90 })).toEqual([{ xMm: 420, zMm: 1248 }, { xMm: 420, zMm: 352 }])
    expect(bedPillowCenters({ ...bed, pillowPosition: 'top', rotation: 180 })).toEqual([{ xMm: 1248, zMm: 1580 }, { xMm: 352, zMm: 1580 }])
    expect(bedPillowCenters({ ...bed, pillowPosition: 'bottom', rotation: 270 })).toEqual([{ xMm: 420, zMm: 352 }, { xMm: 420, zMm: 1248 }])
  })

  it('creates an empty independent room', () => {
    const project = createRoomProject('room-2', 'Kamar 2')
    expect(project).toMatchObject({ id: 'room-2', name: 'Kamar 2', items: [] })
    expect(project.room).toEqual(room)
    expect(project.door).toEqual({ side: 'south', offsetMm: 400, widthMm: 900, heightMm: 2100 })
  })

  it('detects collisions and room boundaries', () => {
    const chair: Furniture = { ...furnitureCatalog.chair, id: 'chair', xMm: 1500, zMm: 1000 }
    expect(itemIssues(bed, [bed, chair], room)).toEqual({ outside: false, collision: true })
    expect(itemIssues({ ...bed, xMm: 3000 }, [chair], room).outside).toBe(true)
  })

  it('converts a world-space center to millimeter coordinates', () => {
    expect(positionFromWorld(bed, room, 0, 0)).toEqual({ xMm: 1200, zMm: 500 })
    expect(positionFromWorld({ ...bed, rotation: 90 }, room, 0, 0)).toEqual({ xMm: 1000, zMm: 700 })
  })

  it('clamps an item inside the room', () => {
    expect(clampItem({ ...bed, xMm: 3900, zMm: -100 }, room)).toMatchObject({ xMm: 2400, zMm: 0 })
  })

  it('clamps a door to its wall dimensions', () => {
    expect(wallLength(room, 'north')).toBe(4000)
    expect(wallLength(room, 'east')).toBe(3000)
    expect(clampDoor({ side: 'east', offsetMm: 2800, widthMm: 900, heightMm: 3000 }, room)).toEqual({ side: 'east', offsetMm: 2100, widthMm: 900, heightMm: 2800 })
  })

  it('detects furniture above the ceiling', () => {
    const wardrobe: Furniture = { ...furnitureCatalog.wardrobe, id: 'wardrobe', xMm: 0, zMm: 0 }
    expect(itemIssues(wardrobe, [wardrobe], { ...room, heightMm: 2000 }).outside).toBe(true)
    expect(itemIssues(wardrobe, [wardrobe], { ...room, heightMm: 2100 }).outside).toBe(false)
  })

  it('provides complete and valid furniture catalog items', () => {
    const kinds = Object.keys(furnitureCatalog)
    expect(kinds.length).toBeGreaterThanOrEqual(8)
    for (const kind of kinds) {
      const item = furnitureCatalog[kind as keyof typeof furnitureCatalog]
      expect(item.name.length).toBeGreaterThan(0)
      expect(item.widthMm).toBeGreaterThan(0)
      expect(item.depthMm).toBeGreaterThan(0)
      expect(item.heightMm).toBeGreaterThan(0)
    }
  })

  it('finds empty non-overlapping position when adding new furniture', () => {
    const door: Door = { side: 'south', offsetMm: 400, widthMm: 900, heightMm: 2100 }
    // First item
    const pos1 = findEmptyPosition(furnitureCatalog.bed, [], room, door)
    const item1: Furniture = { ...furnitureCatalog.bed, id: '1', ...pos1 }
    expect(itemIssues(item1, [item1], room).outside).toBe(false)

    // Second item must not overlap with first item
    const pos2 = findEmptyPosition(furnitureCatalog.desk, [item1], room, door)
    const item2: Furniture = { ...furnitureCatalog.desk, id: '2', ...pos2 }
    expect(itemIssues(item2, [item1, item2], room)).toEqual({ outside: false, collision: false })

    // Third item must not overlap with first and second
    const pos3 = findEmptyPosition(furnitureCatalog.wardrobe, [item1, item2], room, door)
    const item3: Furniture = { ...furnitureCatalog.wardrobe, id: '3', ...pos3 }
    expect(itemIssues(item3, [item1, item2, item3], room)).toEqual({ outside: false, collision: false })

    // Fourth item (accessories like nightstand)
    const pos4 = findEmptyPosition(furnitureCatalog.nightstand, [item1, item2, item3], room, door)
    const item4: Furniture = { ...furnitureCatalog.nightstand, id: '4', ...pos4 }
    expect(itemIssues(item4, [item1, item2, item3, item4], room)).toEqual({ outside: false, collision: false })
  })

  it('handles multi-selection toggles correctly', () => {
    // Single select
    expect(toggleItemSelection([], 'item-1', false)).toEqual(['item-1'])
    expect(toggleItemSelection(['item-1'], 'item-2', false)).toEqual(['item-2'])

    // Additive select (Shift/Ctrl + Click)
    expect(toggleItemSelection(['item-1'], 'item-2', true)).toEqual(['item-1', 'item-2'])
    expect(toggleItemSelection(['item-1', 'item-2'], 'item-1', true)).toEqual(['item-2'])

    // Deselection on empty click
    expect(toggleItemSelection(['item-1', 'item-2'], '', false)).toEqual([])
    expect(toggleItemSelection(['item-1', 'item-2'], '', true)).toEqual(['item-1', 'item-2'])
  })

  it('computes box intersections for marquee selection', () => {
    const box = normalizeBox(100, 100, 300, 200)
    expect(box).toEqual({ minX: 100, minY: 100, maxX: 300, maxY: 200 })

    const intersectingItem = { minX: 150, minY: 120, maxX: 250, maxY: 180 }
    const outsideItem = { minX: 350, minY: 250, maxX: 400, maxY: 300 }
    const overlappingEdge = { minX: 50, minY: 50, maxX: 120, maxY: 150 }

    expect(isBoxIntersecting(box, intersectingItem)).toBe(true)
    expect(isBoxIntersecting(box, outsideItem)).toBe(false)
    expect(isBoxIntersecting(box, overlappingEdge)).toBe(true)

    // Merging marquee selection
    expect(mergeBoxSelection(['item-1'], ['item-2', 'item-3'], false)).toEqual(['item-2', 'item-3'])
    expect(mergeBoxSelection(['item-1'], ['item-2', 'item-3'], true)).toEqual(['item-1', 'item-2', 'item-3'])
    expect(mergeBoxSelection(['item-1', 'item-2'], ['item-2', 'item-3'], true)).toEqual(['item-1', 'item-2', 'item-3'])
  })

  it('filters items correctly when batch deleting', () => {
    const list: Furniture[] = [
      { ...furnitureCatalog.bed, id: '1', xMm: 0, zMm: 0 },
      { ...furnitureCatalog.desk, id: '2', xMm: 1000, zMm: 0 },
      { ...furnitureCatalog.chair, id: '3', xMm: 2000, zMm: 0 },
    ]
    const toDelete = new Set(['1', '3'])
    const remaining = list.filter((it) => !toDelete.has(it.id))
    expect(remaining.map((it) => it.id)).toEqual(['2'])
  })
})
