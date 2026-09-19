import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { generateExportImage } from './exportPreview'
import { clampDoor, clampItem, findEmptyPosition, footprint, formatMeasurement, fromMillimeters, furnitureCatalog, itemIssues, toMillimeters, wallLength, type Door, type Furniture, type FurnitureKind, type MeasurementUnit, type Room, type WallSide, type WallVisibility } from './model'
import { RoomCanvas } from './RoomCanvas'

const defaultRoom: Room = { widthMm: 4000, depthMm: 3000, heightMm: 2800 }
const defaultDoor: Door = { side: 'south', offsetMm: 400, widthMm: 900, heightMm: 2100 }
const defaultWalls: WallVisibility = { north: true, east: true, south: true, west: true }
const wallLabels: Record<WallSide, string> = { north: 'Utara', east: 'Timur', south: 'Selatan', west: 'Barat' }
const storageKey = 'ruang-presisi-project'

const furnitureGroups: { title: string; kinds: FurnitureKind[] }[] = [
  {
    title: 'Furnitur Utama',
    kinds: ['bed', 'wardrobe', 'desk', 'chair', 'bookshelf'],
  },
  {
    title: 'Aksesoris & Dekorasi',
    kinds: ['nightstand', 'shoe_rack', 'coat_rack', 'flower_vase', 'floor_lamp'],
  },
]

type SavedProject = { room: Room; items: Furniture[]; door: Door; walls: WallVisibility }

function loadProject(): SavedProject {
  try {
    const saved = localStorage.getItem(storageKey)
    if (!saved) return { room: defaultRoom, items: [], door: defaultDoor, walls: defaultWalls }
    const value: unknown = JSON.parse(saved)
    if (!value || typeof value !== 'object' || !('room' in value) || !('items' in value) || !Array.isArray(value.items)) throw new Error()
    const room = value.room
    if (!room || typeof room !== 'object' || !('widthMm' in room) || !('depthMm' in room) || !('heightMm' in room) || ![room.widthMm, room.depthMm, room.heightMm].every(Number.isFinite)) throw new Error()
    const validRoom = room as Room
    if (validRoom.widthMm < 2000 || validRoom.widthMm > 12000 || validRoom.depthMm < 2000 || validRoom.depthMm > 12000 || validRoom.heightMm < 2000 || validRoom.heightMm > 5000) throw new Error()
    const ids = new Set<string>()
    const items = value.items as Furniture[]
    if (!items.every((item) => item && typeof item.id === 'string' && !ids.has(item.id) && ids.add(item.id) && typeof item.name === 'string' && typeof item.color === 'string' && [item.widthMm, item.depthMm, item.heightMm, item.xMm, item.zMm].every(Number.isFinite) && item.widthMm > 0 && item.depthMm > 0 && item.heightMm > 0 && typeof item.rotation === 'number' && Number.isFinite(item.rotation) && (item.pillowPosition === undefined || item.pillowPosition === 'top' || item.pillowPosition === 'bottom'))) throw new Error()
    const sides: WallSide[] = ['north', 'east', 'south', 'west']
    const rawDoor = 'door' in value ? value.door as Door : defaultDoor
    const door = rawDoor && sides.includes(rawDoor.side) && [rawDoor.offsetMm, rawDoor.widthMm, rawDoor.heightMm].every(Number.isFinite) ? clampDoor(rawDoor, validRoom) : defaultDoor
    const rawWalls = 'walls' in value && value.walls && typeof value.walls === 'object' ? value.walls as Partial<WallVisibility> : {}
    const walls = Object.fromEntries(sides.map((side) => [side, typeof rawWalls[side] === 'boolean' ? rawWalls[side] : true])) as WallVisibility
    return { room: validRoom, items: items.map((item) => clampItem(item, validRoom)), door, walls }
  } catch {
    return { room: defaultRoom, items: [], door: defaultDoor, walls: defaultWalls }
  }
}

function NumberField({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: MeasurementUnit; onChange: (value: number) => void }) {
  const displayValue = fromMillimeters(value, unit)
  const displayMin = fromMillimeters(min, unit)
  const displayMax = fromMillimeters(max, unit)
  const [draft, setDraft] = useState(String(displayValue))
  const commit = () => {
    const next = Number(draft)
    if (!Number.isFinite(next)) return setDraft(String(displayValue))
    const normalized = Math.max(min, Math.min(max, toMillimeters(next, unit)))
    setDraft(String(fromMillimeters(normalized, unit)))
    onChange(normalized)
  }
  return (
    <label className="field">
      <span>{label}</span>
      <span className="number-input"><input type="number" min={displayMin} max={displayMax} step={unit === 'm' ? '0.001' : unit === 'cm' ? '0.1' : '1'} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} /><b>{unit}</b></span>
    </label>
  )
}

export default function App() {
  const [initial] = useState(loadProject)
  const [room, setRoom] = useState(initial.room)
  const [items, setItems] = useState(initial.items)
  const [door, setDoor] = useState(initial.door)
  const [walls, setWalls] = useState(initial.walls)
  const [selectedId, setSelectedId] = useState<string | null>(initial.items[0]?.id ?? null)
  const [saveError, setSaveError] = useState(false)
  const [exportStatus, setExportStatus] = useState('')
  const [unit, setUnit] = useState<MeasurementUnit>('m')
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const selected = items.find((item) => item.id === selectedId) ?? null
  const selectedSize = selected ? footprint(selected) : null
  const setCanvas = useCallback((canvas: HTMLCanvasElement) => { canvasRef.current = canvas }, [])

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ room, items, door, walls }))
      queueMicrotask(() => setSaveError(false))
    } catch {
      queueMicrotask(() => setSaveError(true))
    }
  }, [room, items, door, walls])

  function updateRoom(key: keyof Room, value: number) {
    const next = { ...room, [key]: value }
    setRoom(next)
    setItems((current) => current.map((item) => clampItem(item, next)))
    setDoor((current) => clampDoor(current, next))
  }

  function addItem(kind: FurnitureKind) {
    const id = crypto.randomUUID()
    const template = furnitureCatalog[kind]
    const pos = findEmptyPosition(template, items, room, door)
    const item = clampItem({ ...template, id, xMm: pos.xMm, zMm: pos.zMm }, room)
    setItems((current) => [...current, item])
    setSelectedId(id)
  }

  function updateItem(id: string, changes: Partial<Furniture>) {
    setItems((current) => current.map((item) => item.id === id ? clampItem({ ...item, ...changes }, room) : item))
  }

  function updateSelected(changes: Partial<Furniture>) {
    if (selected) updateItem(selected.id, changes)
  }

  function removeSelected() {
    if (!selected) return
    setItems((current) => current.filter((item) => item.id !== selected.id))
    setSelectedId(null)
  }

  function exportLayout() {
    try {
      const dataUrl = generateExportImage(room, items, door, unit, canvasRef.current)
      const roomW = (room.widthMm / 1000).toFixed(1)
      const roomD = (room.depthMm / 1000).toFixed(1)
      const link = document.createElement('a')
      link.download = `layout-presisi-${roomW}x${roomD}m-${new Date().toISOString().slice(0, 10)}.png`
      link.href = dataUrl
      link.click()
      setExportStatus('Gambar presentasi layout profesional berhasil diekspor.')
    } catch {
      setExportStatus('Ekspor gagal. Coba muat ulang halaman.')
    }
  }

  const issueCount = items.filter((item) => Object.values(itemIssues(item, items, room)).some(Boolean)).length

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark" aria-hidden="true" /><div><strong>RUANG PRESISI</strong><span>Studio tata ruang 1:1</span></div></div>
        <div className="status"><span>{items.length} objek</span><span>{formatMeasurement(room.widthMm, unit)} × {formatMeasurement(room.depthMm, unit)}</span><span className={issueCount || saveError ? 'warning' : 'valid'}>{saveError ? 'Perubahan belum tersimpan' : issueCount ? `${issueCount} konflik` : 'Layout valid'}</span><button className="export-button" onClick={exportLayout}>Ekspor PNG</button></div>
      </header>

      <aside className="panel room-panel" aria-label="Pengaturan kamar">
        <section>
          <h1>Ukuran ruang</h1>
          <p>Pilih satuan yang paling nyaman. Presisi internal tetap 1 mm.</p>
          <label className="field"><span>Satuan ukuran</span><select value={unit} onChange={(event) => setUnit(event.target.value as MeasurementUnit)}><option value="m">Meter (m)</option><option value="cm">Sentimeter (cm)</option><option value="mm">Milimeter (mm)</option></select></label>
          <NumberField key={`room-width-${unit}`} unit={unit} label="Lebar" value={room.widthMm} min={2000} max={12000} onChange={(value) => updateRoom('widthMm', value)} />
          <NumberField key={`room-depth-${unit}`} unit={unit} label="Panjang" value={room.depthMm} min={2000} max={12000} onChange={(value) => updateRoom('depthMm', value)} />
          <NumberField key={`room-height-${unit}`} unit={unit} label="Tinggi" value={room.heightMm} min={2000} max={5000} onChange={(value) => updateRoom('heightMm', value)} />
        </section>
        <section>
          <h2>Pintu</h2>
          <label className="field"><span>Dinding</span><select value={door.side} onChange={(event) => setDoor(clampDoor({ ...door, side: event.target.value as WallSide }, room))}>{Object.entries(wallLabels).map(([side, label]) => <option key={side} value={side}>{label}</option>)}</select></label>
          <NumberField key={`door-offset-${door.side}-${door.offsetMm}-${unit}`} unit={unit} label="Jarak dari kiri" value={door.offsetMm} min={0} max={wallLength(room, door.side) - door.widthMm} onChange={(offsetMm) => setDoor(clampDoor({ ...door, offsetMm }, room))} />
          <NumberField key={`door-width-${door.widthMm}-${unit}`} unit={unit} label="Lebar pintu" value={door.widthMm} min={600} max={wallLength(room, door.side)} onChange={(widthMm) => setDoor(clampDoor({ ...door, widthMm }, room))} />
          <NumberField key={`door-height-${door.heightMm}-${unit}`} unit={unit} label="Tinggi pintu" value={door.heightMm} min={1800} max={room.heightMm} onChange={(heightMm) => setDoor(clampDoor({ ...door, heightMm }, room))} />
        </section>
        <section>
          <h2>Visibilitas dinding</h2>
          <div className="wall-toggles">{(Object.keys(wallLabels) as WallSide[]).map((side) => <label key={side}><input type="checkbox" checked={walls[side]} onChange={(event) => setWalls({ ...walls, [side]: event.target.checked })} /> <span>{wallLabels[side]}</span></label>)}</div>
        </section>
        <section>
          <h2>Tambah furnitur & aksesoris</h2>
          {furnitureGroups.map((group) => (
            <div key={group.title} className="catalog-group">
              <span className="group-label">{group.title}</span>
              <div className="asset-list">
                {group.kinds.map((kind) => (
                  <button key={kind} onClick={() => addItem(kind)}>
                    <span>{furnitureCatalog[kind].name}</span>
                    <small>{formatMeasurement(furnitureCatalog[kind].widthMm, unit)} × {formatMeasurement(furnitureCatalog[kind].depthMm, unit)}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      </aside>

      <section className="viewport" aria-label="Pratinjau ruang tiga dimensi">
        <RoomCanvas room={room} items={items} door={door} walls={walls} selectedId={selectedId} onSelect={(id) => setSelectedId(id || null)} onMove={(id, xMm, zMm) => updateItem(id, { xMm, zMm })} onCanvasReady={setCanvas} />
        <div className="view-help">Seret furnitur untuk memindahkan · Seret area kosong untuk mengorbit · Gulir untuk zoom</div>
        <div className="export-status" aria-live="polite">{exportStatus}</div>
      </section>

      <aside className="panel object-panel" aria-label="Properti objek">
        {items.length > 0 && <section className="object-list">
          <span className="section-index">SEMUA OBJEK</span>
          {items.map((item) => <button key={item.id} className={item.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(item.id)}>{item.name}</button>)}
        </section>}
        {selected ? <>
          <section>
            <span className="section-index">OBJEK TERPILIH</span>
            <h2>{selected.name}</h2>
            <p>{formatMeasurement(selected.widthMm, unit)} × {formatMeasurement(selected.depthMm, unit)} × {formatMeasurement(selected.heightMm, unit)}</p>
          </section>
          <section>
            <h2>Ukuran furnitur</h2>
            <NumberField key={`${selected.id}-width-${selected.widthMm}-${unit}`} unit={unit} label="Lebar" value={selected.widthMm} min={200} max={selected.rotation === 90 ? room.depthMm : room.widthMm} onChange={(widthMm) => updateSelected({ widthMm })} />
            <NumberField key={`${selected.id}-depth-${selected.depthMm}-${unit}`} unit={unit} label="Panjang" value={selected.depthMm} min={200} max={selected.rotation === 90 ? room.widthMm : room.depthMm} onChange={(depthMm) => updateSelected({ depthMm })} />
            <NumberField key={`${selected.id}-height-${selected.heightMm}-${unit}`} unit={unit} label="Tinggi" value={selected.heightMm} min={100} max={room.heightMm} onChange={(heightMm) => updateSelected({ heightMm })} />
          </section>
          <section>
            <h2>Posisi</h2>
            <NumberField key={`${selected.id}-x-${selected.xMm}-${unit}`} unit={unit} label="Sumbu X" value={selected.xMm} min={0} max={room.widthMm - selectedSize!.widthMm} onChange={(xMm) => updateSelected({ xMm })} />
            <NumberField key={`${selected.id}-z-${selected.zMm}-${unit}`} unit={unit} label="Sumbu Z" value={selected.zMm} min={0} max={room.depthMm - selectedSize!.depthMm} onChange={(zMm) => updateSelected({ zMm })} />
            <div className="rotation-group">
              <label className="field">
                <span>Arah hadap / Rotasi</span>
                <select
                  value={[0, 45, 90, 135, 180, 225, 270, 315].includes(selected.rotation) ? selected.rotation : 'custom'}
                  onChange={(event) => {
                    if (event.target.value !== 'custom') {
                      updateSelected({ rotation: Number(event.target.value) })
                    }
                  }}
                >
                  <option value="0">0° — Depan (Selatan)</option>
                  <option value="45">45° — Serong Kanan Depan</option>
                  <option value="90">90° — Kanan (Barat)</option>
                  <option value="135">135° — Serong Kanan Belakang</option>
                  <option value="180">180° — Belakang (Utara)</option>
                  <option value="225">225° — Serong Kiri Belakang</option>
                  <option value="270">270° — Kiri (Timur)</option>
                  <option value="315">315° — Serong Kiri Depan</option>
                  {![0, 45, 90, 135, 180, 225, 270, 315].includes(selected.rotation) && (
                    <option value="custom">{selected.rotation}° — Sudut Kustom</option>
                  )}
                </select>
              </label>
              <div className="rotation-input-row">
                <label className="field">
                  <span>Sudut derajat (0-359°)</span>
                  <span className="number-input">
                    <input
                      type="number"
                      min={0}
                      max={359}
                      step={15}
                      value={selected.rotation}
                      onChange={(event) => {
                        const val = Number(event.target.value)
                        if (Number.isFinite(val)) {
                          updateSelected({ rotation: ((Math.round(val) % 360) + 360) % 360 })
                        }
                      }}
                    />
                    <b>°</b>
                  </span>
                </label>
                <div className="rotation-actions">
                  <button type="button" title="Putar 90° berlawanan jarum jam" onClick={() => updateSelected({ rotation: (selected.rotation + 270) % 360 })}>
                    ↺ -90°
                  </button>
                  <button type="button" title="Putar 90° searah jarum jam" onClick={() => updateSelected({ rotation: (selected.rotation + 90) % 360 })}>
                    ↻ +90°
                  </button>
                </div>
              </div>
            </div>
            {selected.kind === 'bed' && <label className="field"><span>Posisi kepala ranjang</span><select value={selected.pillowPosition ?? 'top'} onChange={(event) => updateSelected({ pillowPosition: event.target.value as 'top' | 'bottom' })}><option value="top">Atas</option><option value="bottom">Bawah</option></select></label>}
          </section>
          <section className="validation" aria-live="polite">
            {Object.values(itemIssues(selected, items, room)).some(Boolean) ? <strong>Objek bertabrakan. Ubah posisi atau rotasi.</strong> : <strong>Posisi objek valid.</strong>}
          </section>
          <button className="remove" onClick={removeSelected}>Hapus objek</button>
        </> : <section className="empty"><span>PROPERTI</span><h2>Belum ada objek dipilih</h2><p>Tambahkan furnitur atau pilih objek pada ruang 3D.</p></section>}
      </aside>
    </main>
  )
}
