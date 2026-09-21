import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import './App.css'
import { generateExportImage } from './exportPreview'
import { clampDoor, clampItem, createRoomProject, defaultDoor, findEmptyPosition, footprint, formatMeasurement, fromMillimeters, furnitureCatalog, itemIssues, mergeBoxSelection, toMillimeters, toggleItemSelection, wallLength, type Furniture, type FurnitureKind, type MeasurementUnit, type Room, type RoomProject, type WallSide, type WallVisibility } from './model'
import { RoomCanvas, type ViewportMode } from './RoomCanvas'
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

type SavedProject = { activeRoomId: string; rooms: RoomProject[] }

function validateRoomProject(value: unknown, fallbackId: string, fallbackName: string): RoomProject {
  if (!value || typeof value !== 'object' || !('room' in value) || !('items' in value) || !Array.isArray(value.items)) throw new Error()
  const room = value.room
  if (!room || typeof room !== 'object' || !('widthMm' in room) || !('depthMm' in room) || !('heightMm' in room) || ![room.widthMm, room.depthMm, room.heightMm].every(Number.isFinite)) throw new Error()
  const validRoom = room as Room
  if (validRoom.widthMm < 2000 || validRoom.widthMm > 12000 || validRoom.depthMm < 2000 || validRoom.depthMm > 12000 || validRoom.heightMm < 2000 || validRoom.heightMm > 5000) throw new Error()
  const ids = new Set<string>()
  const items = value.items as Furniture[]
  if (!items.every((item) => item && typeof item.id === 'string' && !ids.has(item.id) && ids.add(item.id) && typeof item.name === 'string' && typeof item.color === 'string' && [item.widthMm, item.depthMm, item.heightMm, item.xMm, item.zMm].every(Number.isFinite) && item.widthMm > 0 && item.depthMm > 0 && item.heightMm > 0 && typeof item.rotation === 'number' && Number.isFinite(item.rotation) && (item.pillowPosition === undefined || item.pillowPosition === 'top' || item.pillowPosition === 'bottom'))) throw new Error()
  const sides: WallSide[] = ['north', 'east', 'south', 'west']
  const rawDoor = 'door' in value ? value.door as RoomProject['door'] : defaultDoor
  const door = rawDoor && sides.includes(rawDoor.side) && [rawDoor.offsetMm, rawDoor.widthMm, rawDoor.heightMm].every(Number.isFinite) ? clampDoor(rawDoor, validRoom) : { ...defaultDoor }
  const rawWalls = 'walls' in value && value.walls && typeof value.walls === 'object' ? value.walls as Partial<WallVisibility> : {}
  const walls = Object.fromEntries(sides.map((side) => [side, typeof rawWalls[side] === 'boolean' ? rawWalls[side] : true])) as WallVisibility
  const id = 'id' in value && typeof value.id === 'string' ? value.id : fallbackId
  const name = 'name' in value && typeof value.name === 'string' && value.name.trim() ? value.name.trim() : fallbackName
  return { id, name, room: validRoom, items: items.map((item) => clampItem(item, validRoom)), door, walls }
}

function loadProject(): SavedProject {
  const fallback = createRoomProject('room-1', 'Kamar 1')
  try {
    const saved = localStorage.getItem(storageKey)
    if (!saved) return { activeRoomId: fallback.id, rooms: [fallback] }
    const value: unknown = JSON.parse(saved)
    if (!value || typeof value !== 'object') throw new Error()
    if ('rooms' in value && Array.isArray(value.rooms) && value.rooms.length) {
      const rooms = value.rooms.map((entry, index) => validateRoomProject(entry, `room-${index + 1}`, `Kamar ${index + 1}`))
      const activeRoomId = 'activeRoomId' in value && typeof value.activeRoomId === 'string' && rooms.some((entry) => entry.id === value.activeRoomId) ? value.activeRoomId : rooms[0].id
      return { activeRoomId, rooms }
    }
    const migrated = validateRoomProject(value, fallback.id, fallback.name)
    return { activeRoomId: migrated.id, rooms: [migrated] }
  } catch {
    return { activeRoomId: fallback.id, rooms: [fallback] }
  }
}

type SelectOption = { value: string | number; label: string }

function ThemedSelect({ value, options, onChange, autoFocus = false }: { value: string | number; options: SelectOption[]; onChange: (value: string) => void; autoFocus?: boolean }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listId = useId()
  const selectedIndex = Math.max(0, options.findIndex((option) => String(option.value) === String(value)))

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  function choose(index: number) {
    onChange(String(options[index].value))
    setOpen(false)
  }

  function handleKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape') return setOpen(false)
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      return setOpen((current) => !current)
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      choose((selectedIndex + direction + options.length) % options.length)
    }
  }

  return <div className="themed-select" ref={rootRef}>
    <button type="button" autoFocus={autoFocus} className="themed-select-trigger" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((current) => !current)} onKeyDown={handleKey}>
      <span>{options[selectedIndex]?.label}</span><span className="select-chevron" aria-hidden="true" />
    </button>
    {open && <div className="themed-select-menu" id={listId} role="listbox" aria-activedescendant={`${listId}-${selectedIndex}`}>
      {options.map((option, index) => <button type="button" id={`${listId}-${index}`} role="option" aria-selected={index === selectedIndex} className={index === selectedIndex ? 'selected' : ''} key={option.value} onClick={() => choose(index)}>{option.label}</button>)}
    </div>}
  </div>
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
  const [rooms, setRooms] = useState(initial.rooms)
  const [activeRoomId, setActiveRoomId] = useState(initial.activeRoomId)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [viewportMode, setViewportMode] = useState<ViewportMode>('select')
  const [saveError, setSaveError] = useState(false)
  const [exportStatus, setExportStatus] = useState('')
  const [exportError, setExportError] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const [deleteRoomOpen, setDeleteRoomOpen] = useState(false)
  const [deleteItemOpen, setDeleteItemOpen] = useState(false)
  const [exportRoomId, setExportRoomId] = useState(initial.activeRoomId)
  const [renderedRoomId, setRenderedRoomId] = useState(initial.activeRoomId)
  const [unit, setUnit] = useState<MeasurementUnit>('m')
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const exportDialogRef = useRef<HTMLDialogElement | null>(null)
  const deleteDialogRef = useRef<HTMLDialogElement | null>(null)
  const deleteItemDialogRef = useRef<HTMLDialogElement | null>(null)
  const activeRoom = rooms.find((entry) => entry.id === activeRoomId) ?? rooms[0]
  const { room, items, door, walls } = activeRoom
  const selected = selectedIds.length === 1 ? items.find((item) => item.id === selectedIds[0]) ?? null : null
  const selectedSize = selected ? footprint(selected) : null
  const setCanvas = useCallback((canvas: HTMLCanvasElement) => { canvasRef.current = canvas }, [])

  useEffect(() => {
    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setRenderedRoomId(activeRoomId))
    })
    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
    }
  }, [activeRoomId])

  useEffect(() => {
    const dialog = exportDialogRef.current
    if (exportOpen && !dialog?.open) dialog?.showModal()
    if (!exportOpen && dialog?.open) dialog.close()
  }, [exportOpen])

  useEffect(() => {
    const dialog = deleteDialogRef.current
    if (deleteRoomOpen && !dialog?.open) dialog?.showModal()
    if (!deleteRoomOpen && dialog?.open) dialog.close()
  }, [deleteRoomOpen])

  useEffect(() => {
    const dialog = deleteItemDialogRef.current
    if (deleteItemOpen && !dialog?.open) dialog?.showModal()
    if (!deleteItemOpen && dialog?.open) dialog.close()
  }, [deleteItemOpen])

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ activeRoomId, rooms }))
      queueMicrotask(() => setSaveError(false))
    } catch {
      queueMicrotask(() => setSaveError(true))
    }
  }, [activeRoomId, rooms])

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

      if (isInput) return
      if (deleteItemOpen || deleteRoomOpen || exportOpen) return

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedIds.length > 0) {
          event.preventDefault()
          setDeleteItemOpen(true)
        }
        return
      }

      if (event.key === 'Escape') {
        if (selectedIds.length > 0) {
          event.preventDefault()
          setSelectedIds([])
        }
        return
      }

      if (event.key === 'v' || event.key === 'V') {
        event.preventDefault()
        setViewportMode('select')
        return
      }

      if (event.key === 'h' || event.key === 'H') {
        event.preventDefault()
        setViewportMode('pan')
        return
      }

      if (event.key === 'o' || event.key === 'O') {
        event.preventDefault()
        setViewportMode('orbit')
        return
      }

      if ((event.ctrlKey || event.metaKey) && (event.key === 'a' || event.key === 'A')) {
        event.preventDefault()
        setSelectedIds(items.map((it) => it.id))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteItemOpen, deleteRoomOpen, exportOpen, items, selectedIds])

  function updateActive(changes: Partial<RoomProject> | ((current: RoomProject) => RoomProject)) {
    setRooms((current) => current.map((entry) => entry.id === activeRoomId ? typeof changes === 'function' ? changes(entry) : { ...entry, ...changes } : entry))
  }

  function switchRoom(id: string) {
    setRenderedRoomId('')
    setActiveRoomId(id)
    setSelectedIds([])
    setExportStatus('')
  }

  function handleSelect(id: string, additive = false) {
    setSelectedIds((current) => toggleItemSelection(current, id, additive))
  }

  function handleBoxSelect(hitIds: string[], additive = false) {
    setSelectedIds((current) => mergeBoxSelection(current, hitIds, additive))
  }

  function updateRoom(key: keyof Room, value: number) {
    const next = { ...room, [key]: value }
    updateActive((current) => ({ ...current, room: next, items: current.items.map((item) => clampItem(item, next)), door: clampDoor(current.door, next) }))
  }

  function addItem(kind: FurnitureKind) {
    const id = crypto.randomUUID()
    const template = furnitureCatalog[kind]
    const pos = findEmptyPosition(template, items, room, door)
    const item = clampItem({ ...template, id, xMm: pos.xMm, zMm: pos.zMm }, room)
    updateActive((current) => ({ ...current, items: [...current.items, item] }))
    setSelectedIds([id])
  }

  function updateItem(id: string, changes: Partial<Furniture>) {
    updateActive((current) => ({ ...current, items: current.items.map((item) => item.id === id ? clampItem({ ...item, ...changes }, current.room) : item) }))
  }

  function updateSelected(changes: Partial<Furniture>) {
    if (selected) updateItem(selected.id, changes)
  }

  function removeSelected() {
    if (!selectedIds.length) return
    setDeleteItemOpen(true)
  }

  function confirmDeleteItems() {
    if (!selectedIds.length) return
    const toDelete = new Set(selectedIds)
    updateActive((current) => ({
      ...current,
      items: current.items.filter((item) => !toDelete.has(item.id)),
    }))
    setSelectedIds([])
    setDeleteItemOpen(false)
  }

  function addRoom() {
    const id = crypto.randomUUID()
    const next = createRoomProject(id, `Kamar ${rooms.length + 1}`)
    setRooms((current) => [...current, next])
    switchRoom(id)
  }

  function removeRoom() {
    if (rooms.length === 1) return
    const remaining = rooms.filter((entry) => entry.id !== activeRoomId)
    setRooms(remaining)
    setDeleteRoomOpen(false)
    switchRoom(remaining[0].id)
  }

  function openExport() {
    setExportRoomId(activeRoomId)
    setExportError('')
    setExportOpen(true)
  }

  function chooseExportRoom(id: string) {
    setExportRoomId(id)
    switchRoom(id)
  }

  function exportLayout() {
    const target = rooms.find((entry) => entry.id === exportRoomId)
    if (!target || target.id !== activeRoomId || renderedRoomId !== target.id) return
    try {
      const dataUrl = generateExportImage(target.room, target.items, target.door, unit, canvasRef.current, target.name)
      const safeName = target.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'kamar'
      const link = document.createElement('a')
      link.download = `layout-${safeName}-${new Date().toISOString().slice(0, 10)}.png`
      link.href = dataUrl
      link.click()
      setExportOpen(false)
      setExportStatus(`${target.name} berhasil diekspor.`)
    } catch {
      setExportError('Ekspor gagal. Coba lagi atau muat ulang halaman.')
    }
  }

  const issueCount = items.filter((item) => Object.values(itemIssues(item, items, room)).some(Boolean)).length

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark" aria-hidden="true" /><div><strong>RUANG PRESISI</strong><span>Studio tata ruang 1:1</span></div></div>
        <div className="status"><span>{items.length} objek</span><span>{formatMeasurement(room.widthMm, unit)} × {formatMeasurement(room.depthMm, unit)}</span><span className={issueCount || saveError ? 'warning' : 'valid'}>{saveError ? 'Perubahan belum tersimpan' : issueCount ? `${issueCount} konflik` : 'Layout valid'}</span><button className="export-button" onClick={openExport}>Ekspor PNG</button></div>
      </header>

      <aside className="panel room-panel" aria-label="Pengaturan kamar">
        <section>
          <h1>Ruangan</h1>
          <label className="field"><span>Kamar aktif</span><ThemedSelect value={activeRoomId} options={rooms.map((entry) => ({ value: entry.id, label: entry.name }))} onChange={switchRoom} /></label>
          <label className="field"><span>Nama kamar</span><input className="text-input" value={activeRoom.name} maxLength={40} onChange={(event) => updateActive({ name: event.target.value })} onBlur={() => { if (!activeRoom.name.trim()) updateActive({ name: 'Kamar tanpa nama' }) }} /></label>
          <div className="room-actions"><button type="button" className="button-primary" onClick={addRoom}>Tambah kamar</button><button type="button" className="button-danger" disabled={rooms.length === 1} onClick={() => setDeleteRoomOpen(true)}>Hapus kamar</button></div>
        </section>
        <section>
          <h2>Ukuran ruang</h2>
          <p>Pilih satuan yang paling nyaman. Presisi internal tetap 1 mm.</p>
          <label className="field"><span>Satuan ukuran</span><ThemedSelect value={unit} options={[{ value: 'm', label: 'Meter (m)' }, { value: 'cm', label: 'Sentimeter (cm)' }, { value: 'mm', label: 'Milimeter (mm)' }]} onChange={(value) => setUnit(value as MeasurementUnit)} /></label>
          <NumberField key={`${activeRoomId}-room-width-${room.widthMm}-${unit}`} unit={unit} label="Lebar" value={room.widthMm} min={2000} max={12000} onChange={(value) => updateRoom('widthMm', value)} />
          <NumberField key={`${activeRoomId}-room-depth-${room.depthMm}-${unit}`} unit={unit} label="Panjang" value={room.depthMm} min={2000} max={12000} onChange={(value) => updateRoom('depthMm', value)} />
          <NumberField key={`${activeRoomId}-room-height-${room.heightMm}-${unit}`} unit={unit} label="Tinggi" value={room.heightMm} min={2000} max={5000} onChange={(value) => updateRoom('heightMm', value)} />
        </section>
        <section>
          <h2>Pintu</h2>
          <label className="field"><span>Dinding</span><ThemedSelect value={door.side} options={Object.entries(wallLabels).map(([value, label]) => ({ value, label }))} onChange={(value) => updateActive({ door: clampDoor({ ...door, side: value as WallSide }, room) })} /></label>
          <label className="field">
            <span>Arah bukaan</span>
            <ThemedSelect
              value={door.swing ?? 'inward'}
              options={[
                { value: 'inward', label: 'Buka ke dalam' },
                { value: 'outward', label: 'Buka ke luar' },
              ]}
              onChange={(value) => updateActive({ door: clampDoor({ ...door, swing: value as 'inward' | 'outward' }, room) })}
            />
          </label>
          <label className="field">
            <span>Sisi bukaan</span>
            <ThemedSelect
              value={door.openingSide ?? 'right'}
              options={[
                { value: 'right', label: 'Buka dari kanan' },
                { value: 'left', label: 'Buka dari kiri' },
              ]}
              onChange={(value) => updateActive({ door: clampDoor({ ...door, openingSide: value as 'left' | 'right' }, room) })}
            />
          </label>
          <label className="field">
            <span>Status pintu</span>
            <ThemedSelect
              value={door.open !== false ? 'open' : 'closed'}
              options={[
                { value: 'open', label: 'Terbuka' },
                { value: 'closed', label: 'Tertutup' },
              ]}
              onChange={(value) => updateActive({ door: clampDoor({ ...door, open: value === 'open' }, room) })}
            />
          </label>
          <NumberField key={`door-offset-${door.side}-${door.offsetMm}-${unit}`} unit={unit} label="Jarak dari kiri" value={door.offsetMm} min={0} max={wallLength(room, door.side) - door.widthMm} onChange={(offsetMm) => updateActive({ door: clampDoor({ ...door, offsetMm }, room) })} />
          <NumberField key={`door-width-${door.widthMm}-${unit}`} unit={unit} label="Lebar pintu" value={door.widthMm} min={600} max={wallLength(room, door.side)} onChange={(widthMm) => updateActive({ door: clampDoor({ ...door, widthMm }, room) })} />
          <NumberField key={`door-height-${door.heightMm}-${unit}`} unit={unit} label="Tinggi pintu" value={door.heightMm} min={1800} max={room.heightMm} onChange={(heightMm) => updateActive({ door: clampDoor({ ...door, heightMm }, room) })} />
        </section>
        <section>
          <h2>Visibilitas dinding</h2>
          <div className="wall-toggles">{(Object.keys(wallLabels) as WallSide[]).map((side) => <label key={side}><input type="checkbox" checked={walls[side]} onChange={(event) => updateActive({ walls: { ...walls, [side]: event.target.checked } })} /> <span>{wallLabels[side]}</span></label>)}</div>
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
        <div className="viewport-toolbar" role="toolbar" aria-label="Alat navigasi dan seleksi">
          <button
            type="button"
            className={viewportMode === 'select' ? 'active' : ''}
            onClick={() => setViewportMode('select')}
            title="Mode Pilih (V) - Klik atau seret kotak untuk memilih furnitur"
            aria-pressed={viewportMode === 'select'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 3l7 18 3-7 7-3L3 3z" />
            </svg>
            <span>Pilih (V)</span>
          </button>
          <button
            type="button"
            className={viewportMode === 'pan' ? 'active' : ''}
            onClick={() => setViewportMode('pan')}
            title="Mode Geser / Tangan (H) - Seret kanvas untuk menggeser sudut pandang"
            aria-pressed={viewportMode === 'pan'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 11V6a2 2 0 0 0-4 0v4M14 10V4a2 2 0 0 0-4 0v7M10 10.5V6a2 2 0 0 0-4 0v8M6 14v1a7 7 0 0 0 14 0v-4a2 2 0 0 0-4 0" />
            </svg>
            <span>Geser (H)</span>
          </button>
          <button
            type="button"
            className={viewportMode === 'orbit' ? 'active' : ''}
            onClick={() => setViewportMode('orbit')}
            title="Mode Orbit / Putar (O) - Seret kanvas untuk memutar kamera 3D"
            aria-pressed={viewportMode === 'orbit'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>Orbit (O)</span>
          </button>
          <div className="toolbar-separator" aria-hidden="true" />
          <button
            type="button"
            className="toolbar-delete-button"
            disabled={selectedIds.length === 0}
            onClick={() => setDeleteItemOpen(true)}
            title={selectedIds.length > 0 ? `Hapus ${selectedIds.length} objek terpilih (Del / Backspace)` : 'Pilih objek untuk dihapus'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Hapus {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}</span>
          </button>
          {selectedIds.length > 1 && (
            <div className="selection-pill" aria-live="polite">
              <span>{selectedIds.length} terpilih</span>
              <button type="button" onClick={() => setSelectedIds([])} title="Batalkan pilihan (Esc)">Batal</button>
            </div>
          )}
        </div>

        <RoomCanvas
          room={room}
          items={items}
          door={door}
          walls={walls}
          selectedIds={selectedIds}
          mode={viewportMode}
          onSelect={handleSelect}
          onBoxSelect={handleBoxSelect}
          onMove={(id, xMm, zMm) => updateItem(id, { xMm, zMm })}
          onCanvasReady={setCanvas}
        />

        <div className="view-help">
          {viewportMode === 'select'
            ? 'Mode Pilih: Klik furnitur · Shift/Ctrl+klik multi-pilih · Seret kotak di area kosong · Klik kanan orbit · Del hapus'
            : viewportMode === 'pan'
              ? 'Mode Geser (Tangan): Seret kanvas untuk menggeser sudut pandang · Gulir untuk zoom'
              : 'Mode Orbit: Seret kanvas untuk memutar sudut pandang 3D · Gulir untuk zoom'}
        </div>
        <div className="export-status" aria-live="polite">{exportStatus}</div>
      </section>

      <aside className="panel object-panel" aria-label="Properti objek">
        {items.length > 0 && <section className="object-list">
          <div className="object-list-header">
            <span className="section-index">SEMUA OBJEK ({items.length})</span>
            {selectedIds.length > 0 && (
              <button
                type="button"
                className="text-action-button"
                onClick={() => setSelectedIds([])}
                title="Batalkan semua pilihan (Esc)"
              >
                Batal pilih
              </button>
            )}
          </div>
          {items.map((item) => (
            <button
              key={item.id}
              className={selectedIds.includes(item.id) ? 'active' : ''}
              onClick={(event) => handleSelect(item.id, event.shiftKey || event.ctrlKey || event.metaKey)}
              title="Klik untuk memilih. Tahan Shift/Ctrl untuk multi-pilih."
            >
              <span>{item.name}</span>
              <small>{Math.round(item.widthMm / 10)}×{Math.round(item.depthMm / 10)} cm</small>
            </button>
          ))}
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
                <ThemedSelect
                  value={[0, 45, 90, 135, 180, 225, 270, 315].includes(selected.rotation) ? selected.rotation : 'custom'}
                  options={[
                    { value: 0, label: '0° - Depan (Selatan)' },
                    { value: 45, label: '45° - Serong Kanan Depan' },
                    { value: 90, label: '90° - Kanan (Barat)' },
                    { value: 135, label: '135° - Serong Kanan Belakang' },
                    { value: 180, label: '180° - Belakang (Utara)' },
                    { value: 225, label: '225° - Serong Kiri Belakang' },
                    { value: 270, label: '270° - Kiri (Timur)' },
                    { value: 315, label: '315° - Serong Kiri Depan' },
                    ...(![0, 45, 90, 135, 180, 225, 270, 315].includes(selected.rotation) ? [{ value: 'custom', label: `${selected.rotation}° - Sudut Kustom` }] : []),
                  ]}
                  onChange={(value) => { if (value !== 'custom') updateSelected({ rotation: Number(value) }) }}
                />
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
            {selected.kind === 'bed' && <label className="field"><span>Posisi kepala ranjang</span><ThemedSelect value={selected.pillowPosition ?? 'top'} options={[{ value: 'top', label: 'Atas' }, { value: 'bottom', label: 'Bawah' }]} onChange={(value) => updateSelected({ pillowPosition: value as 'top' | 'bottom' })} /></label>}
          </section>
          <section className="validation" aria-live="polite">
            {Object.values(itemIssues(selected, items, room)).some(Boolean) ? <strong>Objek bertabrakan. Ubah posisi atau rotasi.</strong> : <strong>Posisi objek valid.</strong>}
          </section>
          <button className="remove" onClick={removeSelected}>Hapus objek</button>
        </> : selectedIds.length > 1 ? <>
          <section>
            <span className="section-index">MULTI-SELEKSI</span>
            <h2>{selectedIds.length} Objek Dipilih</h2>
            <p>Pindahkan masing-masing objek pada kanvas 3D atau hapus seluruh objek terpilih.</p>
          </section>
          <section className="multi-select-section">
            <span className="group-label">Daftar objek terpilih</span>
            <div className="asset-list">
              {items.filter((it) => selectedIds.includes(it.id)).map((it) => (
                <div key={it.id} className="selected-item-row">
                  <div>
                    <strong>{it.name}</strong>
                    <small>{Math.round(it.widthMm / 10)}×{Math.round(it.depthMm / 10)}×{Math.round(it.heightMm / 10)} cm</small>
                  </div>
                  <button
                    type="button"
                    className="row-remove-button"
                    onClick={() => handleSelect(it.id, true)}
                    title="Keluarkan objek ini dari seleksi"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>
          <button className="remove" onClick={removeSelected}>Hapus {selectedIds.length} objek terpilih</button>
        </> : <section className="empty"><span>PROPERTI</span><h2>Belum ada objek dipilih</h2><p>Klik objek pada ruang 3D, seret kotak seleksi, atau pilih dari daftar furnitur.</p></section>}
      </aside>

      <dialog ref={deleteItemDialogRef} className="app-dialog danger-dialog" aria-labelledby="delete-item-title" aria-describedby="delete-item-description" onCancel={() => setDeleteItemOpen(false)} onClose={() => setDeleteItemOpen(false)}>
        <span className="dialog-kicker">Konfirmasi penghapusan</span>
        <h2 id="delete-item-title">
          {selectedIds.length > 1
            ? `Hapus ${selectedIds.length} objek terpilih?`
            : `Hapus ${items.find((it) => it.id === selectedIds[0])?.name ?? 'objek'}?`}
        </h2>
        <p id="delete-item-description">
          {selectedIds.length > 1
            ? `Sebanyak ${selectedIds.length} objek yang dipilih akan dihapus dari ruangan ini. Tindakan ini tidak dapat dibatalkan.`
            : `Objek "${items.find((it) => it.id === selectedIds[0])?.name ?? 'terpilih'}" akan dihapus dari ruangan ini. Tindakan ini tidak dapat dibatalkan.`}
        </p>
        <div className="dialog-actions">
          <button type="button" autoFocus onClick={() => setDeleteItemOpen(false)}>Batal</button>
          <button type="button" className="button-danger-solid" onClick={confirmDeleteItems}>Hapus objek</button>
        </div>
      </dialog>

      <dialog ref={deleteDialogRef} className="app-dialog danger-dialog" aria-labelledby="delete-room-title" aria-describedby="delete-room-description" onCancel={() => setDeleteRoomOpen(false)} onClose={() => setDeleteRoomOpen(false)}>
        <span className="dialog-kicker">Konfirmasi penghapusan</span>
        <h2 id="delete-room-title">Hapus {activeRoom.name}?</h2>
        <p id="delete-room-description">Semua furnitur dan pengaturan di kamar ini akan dihapus. Tindakan ini tidak dapat dibatalkan.</p>
        <div className="dialog-actions"><button type="button" autoFocus onClick={() => setDeleteRoomOpen(false)}>Batal</button><button type="button" className="button-danger-solid" onClick={removeRoom}>Hapus kamar</button></div>
      </dialog>

      <dialog ref={exportDialogRef} className="app-dialog" aria-labelledby="export-title" onCancel={() => setExportOpen(false)} onClose={() => setExportOpen(false)}>
        <span className="dialog-kicker">Ekspor presentasi</span>
        <h2 id="export-title">Pilih kamar untuk diekspor</h2>
        <p>Setiap file PNG memuat satu kamar beserta denah dan tampilan 3D.</p>
        <label className="field"><span>Kamar</span><ThemedSelect autoFocus value={exportRoomId} options={rooms.map((entry) => ({ value: entry.id, label: entry.name }))} onChange={chooseExportRoom} /></label>
        {exportError && <p className="dialog-alert" role="alert">{exportError}</p>}
        <div className="dialog-actions"><button type="button" onClick={() => setExportOpen(false)}>Batal</button><button type="button" className="button-primary" disabled={renderedRoomId !== exportRoomId} onClick={exportLayout}>{renderedRoomId === exportRoomId ? 'Unduh PNG' : 'Menyiapkan render...'}</button></div>
      </dialog>
    </main>
  )
}
