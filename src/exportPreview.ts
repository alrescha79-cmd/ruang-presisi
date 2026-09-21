import { footprint, formatMeasurement, itemIssues, type Door, type Furniture, type MeasurementUnit, type Room } from './model'

function drawArrow(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, size = 12) {
  const angle = Math.atan2(toY - fromY, toX - fromX)
  ctx.beginPath()
  ctx.moveTo(fromX, fromY)
  ctx.lineTo(toX, toY)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(toX, toY)
  ctx.lineTo(toX - size * Math.cos(angle - Math.PI / 6), toY - size * Math.sin(angle - Math.PI / 6))
  ctx.lineTo(toX - size * Math.cos(angle + Math.PI / 6), toY - size * Math.sin(angle + Math.PI / 6))
  ctx.closePath()
  ctx.fill()
}

function drawDimensionH(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, extY1: number, extY2: number, text: string) {
  ctx.save()
  ctx.strokeStyle = '#73574b'
  ctx.fillStyle = '#73574b'
  ctx.lineWidth = 2.5

  // Extension lines
  ctx.beginPath()
  ctx.moveTo(x1, extY1)
  ctx.lineTo(x1, extY2)
  ctx.moveTo(x2, extY1)
  ctx.lineTo(x2, extY2)
  ctx.stroke()

  // Dimension line with double arrows
  drawArrow(ctx, (x1 + x2) / 2, y, x1, y, 10)
  drawArrow(ctx, (x1 + x2) / 2, y, x2, y, 10)

  // Badge background for text
  ctx.font = '600 24px "IBM Plex Mono", monospace'
  const metrics = ctx.measureText(text)
  const tw = metrics.width
  ctx.fillStyle = '#f7f4ef'
  ctx.fillRect((x1 + x2) / 2 - tw / 2 - 10, y - 16, tw + 20, 32)

  // Text
  ctx.fillStyle = '#3a231a'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, (x1 + x2) / 2, y)
  ctx.restore()
}

function drawDimensionV(ctx: CanvasRenderingContext2D, y1: number, y2: number, x: number, extX1: number, extX2: number, text: string) {
  ctx.save()
  ctx.strokeStyle = '#73574b'
  ctx.fillStyle = '#73574b'
  ctx.lineWidth = 2.5

  // Extension lines
  ctx.beginPath()
  ctx.moveTo(extX1, y1)
  ctx.lineTo(extX2, y1)
  ctx.moveTo(extX1, y2)
  ctx.lineTo(extX2, y2)
  ctx.stroke()

  // Dimension line with double arrows
  drawArrow(ctx, x, (y1 + y2) / 2, x, y1, 10)
  drawArrow(ctx, x, (y1 + y2) / 2, x, y2, 10)

  // Badge background
  ctx.font = '600 24px "IBM Plex Mono", monospace'
  const metrics = ctx.measureText(text)
  const tw = metrics.width
  ctx.fillStyle = '#f7f4ef'
  ctx.fillRect(x - 16, (y1 + y2) / 2 - tw / 2 - 10, 32, tw + 20)

  // Rotated vertical text
  ctx.save()
  ctx.translate(x, (y1 + y2) / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = '#3a231a'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 0, 0)
  ctx.restore()

  ctx.restore()
}

export function formatExportTitle(roomName: string, roomWidthMm: number, roomDepthMm: number): string {
  const roomW_M = (roomWidthMm / 1000).toFixed(1).replace('.0', '')
  const roomD_M = (roomDepthMm / 1000).toFixed(1).replace('.0', '')
  const cleanRoomName = (roomName || 'Kamar').trim()
  return `${cleanRoomName} ukuran ${roomW_M} × ${roomD_M} meter`
}

export function calculateRenderCrop(
  canvasWidth: number,
  canvasHeight: number,
  targetWidth: number,
  targetHeight: number,
  roomWidthMm: number,
  roomDepthMm: number
) {
  const cw = canvasWidth
  const ch = canvasHeight
  const srcRatio = cw / ch
  const targetRatio = targetWidth / targetHeight

  let baseW = cw
  let baseH = ch
  if (srcRatio > targetRatio) {
    baseW = ch * targetRatio
  } else {
    baseH = cw / targetRatio
  }

  // ponytail: gentle zoom (1.02x - 1.08x) giving ample breathing room around room edges
  const maxDimM = Math.max(roomWidthMm, roomDepthMm) / 1000
  const zoom = Math.max(1.02, Math.min(1.08, 1.15 - maxDimM * 0.02))
  const sw = Math.min(cw, baseW / zoom)
  const sh = Math.min(ch, baseH / zoom)
  const sx = Math.max(0, Math.floor((cw - sw) / 2))
  const sy = Math.max(0, Math.floor((ch - sh) / 2))

  return { sx, sy, sw, sh, zoom }
}

export function generateExportImage(
  room: Room,
  items: Furniture[],
  door: Door,
  unit: MeasurementUnit,
  threeCanvas: HTMLCanvasElement | null,
  roomName = 'Kamar'
): string {
  const W = 2400
  const H = 2400
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Cannot get 2D context')

  // 1. Warm Architectural Sheet Background
  ctx.fillStyle = '#f7f4ef'
  ctx.fillRect(0, 0, W, H)

  // Subtle architectural grid pattern
  ctx.strokeStyle = '#ece6db'
  ctx.lineWidth = 1
  for (let x = 60; x < W - 60; x += 40) {
    ctx.beginPath()
    ctx.moveTo(x, 60)
    ctx.lineTo(x, H - 60)
    ctx.stroke()
  }
  for (let y = 60; y < H - 60; y += 40) {
    ctx.beginPath()
    ctx.moveTo(60, y)
    ctx.lineTo(W - 60, y)
    ctx.stroke()
  }

  // Outer border
  ctx.strokeStyle = '#c5b59e'
  ctx.lineWidth = 3
  ctx.strokeRect(50, 50, W - 100, H - 100)
  ctx.strokeRect(56, 56, W - 112, H - 112)

  // 2. HEADER
  const roomW_M = (room.widthMm / 1000).toFixed(1).replace('.0', '')
  const roomD_M = (room.depthMm / 1000).toFixed(1).replace('.0', '')
  const title = formatExportTitle(roomName, room.widthMm, room.depthMm)

  // Title badge
  ctx.fillStyle = '#87321f'
  ctx.fillRect(90, 85, 34, 46)
  ctx.fillStyle = '#e8c48a'
  ctx.fillRect(98, 93, 18, 30)

  ctx.fillStyle = '#2f1911'
  ctx.font = '700 56px "Newsreader", Georgia, serif'
  const maxTitleWidth = W - 90 - 640 - 140
  let titleFontSize = 56
  while (ctx.measureText(title).width > maxTitleWidth && titleFontSize > 32) {
    titleFontSize -= 2
    ctx.font = `700 ${titleFontSize}px "Newsreader", Georgia, serif`
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(title, 140, 108)

  // Tag on right
  ctx.font = '700 18px "IBM Plex Mono", monospace'
  ctx.fillStyle = '#87321f'
  ctx.textAlign = 'right'
  ctx.fillText('RUANG PRESISI  ·  STUDIO TATA RUANG INTERIOR 1:1', W - 90, 100)
  ctx.font = '500 15px "IBM Plex Mono", monospace'
  ctx.fillStyle = '#7a6659'
  ctx.fillText(`DOKUMEN TEKNIS  |  ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, W - 90, 126)

  // Subtitle: summary of key furniture sizes
  const keySummary = items
    .slice(0, 4)
    .map((it) => `${it.name} ${Math.round(it.widthMm / 10)}×${Math.round(it.depthMm / 10)} cm`)
    .join('   |   ')
  ctx.fillStyle = '#6e5445'
  ctx.font = '600 21px "DM Sans", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(keySummary || 'Tata letak ruang interior presisi', 90, 160)

  // Header separator line
  ctx.strokeStyle = '#c5b59e'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(90, 185)
  ctx.lineTo(W - 90, 185)
  ctx.stroke()

  // 3. UPPER LEFT: 2D ARCHITECTURAL FLOOR PLAN
  const planBoxX = 90
  const planBoxY = 220
  const planBoxW = 1360
  const planBoxH = 1260

  // Floor plan panel frame
  ctx.fillStyle = '#fffdfa'
  ctx.fillRect(planBoxX, planBoxY, planBoxW, planBoxH)
  ctx.strokeStyle = '#d6c8b4'
  ctx.lineWidth = 2
  ctx.strokeRect(planBoxX, planBoxY, planBoxW, planBoxH)

  // Plan section label
  ctx.fillStyle = '#87321f'
  ctx.font = '700 16px "IBM Plex Mono", monospace'
  ctx.textAlign = 'left'
  ctx.fillText('DENAH TATA RUANG & DIMENSI PRESISI (TAMPAK ATAS)', planBoxX + 24, planBoxY + 36)

  // Calculate scaling for room inside plan area
  const marginAround = 140
  const maxRoomW = planBoxW - marginAround * 2
  const maxRoomH = planBoxH - marginAround * 2
  const scale = Math.min(maxRoomW / room.widthMm, maxRoomH / room.depthMm)
  const drawW = room.widthMm * scale
  const drawD = room.depthMm * scale
  const rX = planBoxX + (planBoxW - drawW) / 2
  const rY = planBoxY + 50 + (planBoxH - 50 - drawD) / 2

  // Room floor
  ctx.fillStyle = '#f3ede2'
  ctx.fillRect(rX, rY, drawW, drawD)

  // Subtle floor grid lines (every 50cm in room)
  ctx.strokeStyle = '#e6ddd0'
  ctx.lineWidth = 1
  for (let xm = 500; xm < room.widthMm; xm += 500) {
    ctx.beginPath()
    ctx.moveTo(rX + xm * scale, rY)
    ctx.lineTo(rX + xm * scale, rY + drawD)
    ctx.stroke()
  }
  for (let zm = 500; zm < room.depthMm; zm += 500) {
    ctx.beginPath()
    ctx.moveTo(rX, rY + zm * scale)
    ctx.lineTo(rX + drawW, rY + zm * scale)
    ctx.stroke()
  }

  // Dimension Lines: Top (Room Width)
  const roomWText = `${Math.round(room.widthMm / 10)} cm`
  drawDimensionH(ctx, rX, rX + drawW, rY - 45, rY - 12, rY - 65, roomWText)

  // Dimension Lines: Left (Room Depth)
  const roomDText = `${Math.round(room.depthMm / 10)} cm`
  drawDimensionV(ctx, rY, rY + drawD, rX - 45, rX - 12, rX - 65, roomDText)

  // Door Opening & Swing Arc
  const wallThick = 14
  ctx.strokeStyle = '#43261a'
  ctx.fillStyle = '#43261a'
  ctx.lineWidth = wallThick

  // Draw walls with gap for door (all 4 orientations synchronized with 3D)
  const dOffset = door.offsetMm * scale
  const dWidth = door.widthMm * scale
  const isDoorOpen = door.open !== false
  const isDoorOutward = door.swing === 'outward'
  const isDoorFromLeft = door.openingSide === 'left'

  // North wall
  if (door.side === 'north') {
    ctx.beginPath()
    ctx.moveTo(rX - wallThick / 2, rY)
    ctx.lineTo(rX + dOffset, rY)
    ctx.moveTo(rX + dOffset + dWidth, rY)
    ctx.lineTo(rX + drawW + wallThick / 2, rY)
    ctx.stroke()

    ctx.save()
    if (!isDoorOpen) {
      // Closed door leaf across opening
      ctx.strokeStyle = '#87321f'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(rX + dOffset, rY)
      ctx.lineTo(rX + dOffset + dWidth, rY)
      ctx.stroke()
    } else {
      const hingeX = isDoorFromLeft ? rX + dOffset + dWidth : rX + dOffset
      ctx.strokeStyle = '#b08b68'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      if (!isDoorFromLeft) {
        if (!isDoorOutward) {
          ctx.arc(hingeX, rY, dWidth, 0, Math.PI / 2, false)
        } else {
          ctx.arc(hingeX, rY, dWidth, -Math.PI / 2, 0, false)
        }
      } else {
        if (!isDoorOutward) {
          ctx.arc(hingeX, rY, dWidth, Math.PI / 2, Math.PI, false)
        } else {
          ctx.arc(hingeX, rY, dWidth, -Math.PI, -Math.PI / 2, false)
        }
      }
      ctx.stroke()

      ctx.setLineDash([])
      ctx.strokeStyle = '#87321f'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(hingeX, rY)
      ctx.lineTo(hingeX, !isDoorOutward ? rY + dWidth : rY - dWidth)
      ctx.stroke()
    }
    ctx.restore()
  } else {
    ctx.beginPath()
    ctx.moveTo(rX - wallThick / 2, rY)
    ctx.lineTo(rX + drawW + wallThick / 2, rY)
    ctx.stroke()
  }

  // South wall
  if (door.side === 'south') {
    ctx.beginPath()
    ctx.moveTo(rX - wallThick / 2, rY + drawD)
    ctx.lineTo(rX + dOffset, rY + drawD)
    ctx.moveTo(rX + dOffset + dWidth, rY + drawD)
    ctx.lineTo(rX + drawW + wallThick / 2, rY + drawD)
    ctx.stroke()

    ctx.save()
    if (!isDoorOpen) {
      // Closed door leaf across opening
      ctx.strokeStyle = '#87321f'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(rX + dOffset, rY + drawD)
      ctx.lineTo(rX + dOffset + dWidth, rY + drawD)
      ctx.stroke()
    } else {
      const hingeX = isDoorFromLeft ? rX + dOffset + dWidth : rX + dOffset
      ctx.strokeStyle = '#b08b68'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      if (!isDoorFromLeft) {
        if (!isDoorOutward) {
          ctx.arc(hingeX, rY + drawD, dWidth, -Math.PI / 2, 0, false)
        } else {
          ctx.arc(hingeX, rY + drawD, dWidth, 0, Math.PI / 2, false)
        }
      } else {
        if (!isDoorOutward) {
          ctx.arc(hingeX, rY + drawD, dWidth, -Math.PI, -Math.PI / 2, false)
        } else {
          ctx.arc(hingeX, rY + drawD, dWidth, Math.PI / 2, Math.PI, false)
        }
      }
      ctx.stroke()

      ctx.setLineDash([])
      ctx.strokeStyle = '#87321f'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(hingeX, rY + drawD)
      ctx.lineTo(hingeX, !isDoorOutward ? rY + drawD - dWidth : rY + drawD + dWidth)
      ctx.stroke()
    }
    ctx.restore()
  } else {
    ctx.beginPath()
    ctx.moveTo(rX - wallThick / 2, rY + drawD)
    ctx.lineTo(rX + drawW + wallThick / 2, rY + drawD)
    ctx.stroke()
  }

  // West wall
  if (door.side === 'west') {
    ctx.beginPath()
    ctx.moveTo(rX, rY)
    ctx.lineTo(rX, rY + dOffset)
    ctx.moveTo(rX, rY + dOffset + dWidth)
    ctx.lineTo(rX, rY + drawD)
    ctx.stroke()

    ctx.save()
    if (!isDoorOpen) {
      // Closed door leaf across opening
      ctx.strokeStyle = '#87321f'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(rX, rY + dOffset)
      ctx.lineTo(rX, rY + dOffset + dWidth)
      ctx.stroke()
    } else {
      const hingeY = isDoorFromLeft ? rY + dOffset + dWidth : rY + dOffset
      ctx.strokeStyle = '#b08b68'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      if (!isDoorFromLeft) {
        if (!isDoorOutward) {
          ctx.arc(rX, hingeY, dWidth, 0, Math.PI / 2, false)
        } else {
          ctx.arc(rX, hingeY, dWidth, Math.PI / 2, Math.PI, false)
        }
      } else {
        if (!isDoorOutward) {
          ctx.arc(rX, hingeY, dWidth, -Math.PI / 2, 0, false)
        } else {
          ctx.arc(rX, hingeY, dWidth, -Math.PI, -Math.PI / 2, false)
        }
      }
      ctx.stroke()

      ctx.setLineDash([])
      ctx.strokeStyle = '#87321f'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(rX, hingeY)
      ctx.lineTo(!isDoorOutward ? rX + dWidth : rX - dWidth, hingeY)
      ctx.stroke()
    }
    ctx.restore()
  } else {
    ctx.beginPath()
    ctx.moveTo(rX, rY)
    ctx.lineTo(rX, rY + drawD)
    ctx.stroke()
  }

  // East wall
  if (door.side === 'east') {
    ctx.beginPath()
    ctx.moveTo(rX + drawW, rY)
    ctx.lineTo(rX + drawW, rY + dOffset)
    ctx.moveTo(rX + drawW, rY + dOffset + dWidth)
    ctx.lineTo(rX + drawW, rY + drawD)
    ctx.stroke()

    ctx.save()
    if (!isDoorOpen) {
      // Closed door leaf across opening
      ctx.strokeStyle = '#87321f'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(rX + drawW, rY + dOffset)
      ctx.lineTo(rX + drawW, rY + dOffset + dWidth)
      ctx.stroke()
    } else {
      const hingeY = isDoorFromLeft ? rY + dOffset + dWidth : rY + dOffset
      ctx.strokeStyle = '#b08b68'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      if (!isDoorFromLeft) {
        if (!isDoorOutward) {
          ctx.arc(rX + drawW, hingeY, dWidth, Math.PI / 2, Math.PI, false)
        } else {
          ctx.arc(rX + drawW, hingeY, dWidth, 0, Math.PI / 2, false)
        }
      } else {
        if (!isDoorOutward) {
          ctx.arc(rX + drawW, hingeY, dWidth, -Math.PI, -Math.PI / 2, false)
        } else {
          ctx.arc(rX + drawW, hingeY, dWidth, -Math.PI / 2, 0, false)
        }
      }
      ctx.stroke()

      ctx.setLineDash([])
      ctx.strokeStyle = '#87321f'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(rX + drawW, hingeY)
      ctx.lineTo(!isDoorOutward ? rX + drawW - dWidth : rX + drawW + dWidth, hingeY)
      ctx.stroke()
    }
    ctx.restore()
  } else {
    ctx.beginPath()
    ctx.moveTo(rX + drawW, rY)
    ctx.lineTo(rX + drawW, rY + drawD)
    ctx.stroke()
  }

  // Cardinal direction labels & entrance pointer
  ctx.save()
  ctx.font = '700 13px "IBM Plex Mono", monospace'
  ctx.fillStyle = '#8f7768'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('UTARA [U]', rX + drawW / 2, rY - 24)
  ctx.fillText('SELATAN [S]', rX + drawW / 2, rY + drawD + 26)

  ctx.save()
  ctx.translate(rX - 22, rY + drawD / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('BARAT [B]', 0, 0)
  ctx.restore()

  ctx.save()
  ctx.translate(rX + drawW + 22, rY + drawD / 2)
  ctx.rotate(Math.PI / 2)
  ctx.fillText('TIMUR [T]', 0, 0)
  ctx.restore()

  // Entrance badge
  ctx.font = '700 13px "IBM Plex Mono", monospace'
  ctx.fillStyle = '#87321f'
  if (door.side === 'south') {
    ctx.fillText('▲ PINTU MASUK', rX + dOffset + dWidth / 2, rY + drawD + 16)
  } else if (door.side === 'north') {
    ctx.fillText('▼ PINTU MASUK', rX + dOffset + dWidth / 2, rY - 10)
  } else if (door.side === 'west') {
    ctx.fillText('▶ PINTU', rX - 34, rY + dOffset + dWidth / 2)
  } else if (door.side === 'east') {
    ctx.fillText('◀ PINTU', rX + drawW + 34, rY + dOffset + dWidth / 2)
  }
  ctx.restore()

  // Draw Furniture on Floor Plan
  items.forEach((item) => {
    const size = footprint(item)
    const ix = rX + item.xMm * scale
    const iz = rY + item.zMm * scale
    const iw = item.widthMm * scale
    const id = item.depthMm * scale
    const cx = ix + size.widthMm * scale / 2
    const cy = iz + size.depthMm * scale / 2

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(-((item.rotation ?? 0) * Math.PI) / 180)
    ctx.fillStyle = '#dfc8ad'
    ctx.strokeStyle = '#4e2d1d'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect(-iw / 2, -id / 2, iw, id, 6)
    ctx.fill()
    ctx.stroke()

    if (item.kind === 'bed') {
      const pillowEnd = item.pillowPosition === 'bottom' ? 1 : -1
      ctx.fillStyle = '#f8f5ee'
      ctx.strokeStyle = '#856149'
      ctx.lineWidth = 1.5
      ctx.fillRect(-iw / 2, pillowEnd * (id / 2 - 8) - 4, iw, 8)
      const pillowW = iw * 0.38
      const pillowD = id * 0.2
      for (const x of [-iw * 0.28, iw * 0.28]) {
        ctx.beginPath()
        ctx.roundRect(x - pillowW / 2, pillowEnd * id * 0.29 - pillowD / 2, pillowW, pillowD, 4)
        ctx.fill()
        ctx.stroke()
      }
    } else if (item.kind === 'wardrobe') {
      ctx.strokeStyle = '#6a4530'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, -id / 2)
      ctx.lineTo(0, id / 2)
      ctx.stroke()
    } else if (item.kind === 'shoe_rack') {
      ctx.strokeStyle = '#886249'
      ctx.lineWidth = 1.5
      for (let s = 1; s <= 3; s++) {
        ctx.beginPath()
        ctx.moveTo(-iw / 2, -id / 2 + (id / 4) * s)
        ctx.lineTo(iw / 2, -id / 2 + (id / 4) * s)
        ctx.stroke()
      }
    }
    ctx.restore()

    ctx.save()
    ctx.fillStyle = '#291811'
    ctx.font = '700 20px "DM Sans", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(item.name, cx, cy - 12)
    ctx.font = '600 16px "IBM Plex Mono", monospace'
    ctx.fillStyle = '#6d4c38'
    ctx.fillText(`${Math.round(size.widthMm / 10)}×${Math.round(size.depthMm / 10)} cm`, cx, cy + 14)
    ctx.restore()
  })

  // 4. UPPER RIGHT: SPECIFICATIONS & CIRCULATION NOTES
  const specBoxX = 1480
  const specBoxY = 220
  const specBoxW = 830
  const specBoxH = 1260

  // Card 1: Circulation & Layout Highlights
  ctx.fillStyle = '#fffdfa'
  ctx.fillRect(specBoxX, specBoxY, specBoxW, 360)
  ctx.strokeStyle = '#d6c8b4'
  ctx.lineWidth = 2
  ctx.strokeRect(specBoxX, specBoxY, specBoxW, 360)

  ctx.fillStyle = '#87321f'
  ctx.font = '700 18px "IBM Plex Mono", monospace'
  ctx.textAlign = 'left'
  ctx.fillText('ANALISIS SIRKULASI & KELAYAKAN', specBoxX + 28, specBoxY + 40)

  const conflicts = items.filter((item) => Object.values(itemIssues(item, items, room)).some(Boolean)).length
  const areaM2 = ((room.widthMm * room.depthMm) / 1_000_000).toFixed(2)

  const highlights = [
    `Semua ${items.length} furnitur tertata presisi di kamar ${roomW_M} × ${roomD_M} m`,
    `Luas total lantai: ${areaM2} m² (Plafon: ${(room.heightMm / 1000).toFixed(1)} m)`,
    'Jalur sirkulasi gerak bebas dan nyaman dilewati',
    conflicts === 0 ? 'Layout valid dan tidak ada tabrakan antar-objek' : `Peringatan: ${conflicts} objek saling beririsan`,
  ]

  highlights.forEach((hl, i) => {
    const yPos = specBoxY + 86 + i * 62
    // Checkmark bullet
    ctx.fillStyle = i === 3 && conflicts > 0 ? '#b83b2f' : '#87321f'
    ctx.beginPath()
    ctx.arc(specBoxX + 42, yPos + 4, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = '700 14px "DM Sans", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('✓', specBoxX + 42, yPos + 4)

    // Text
    ctx.fillStyle = '#2f1911'
    ctx.font = '600 20px "DM Sans", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(hl, specBoxX + 68, yPos + 4)
  })

  // Card 2: Furniture Dimension Table
  const specCard2Y = specBoxY + 390
  const specCard2H = 480
  ctx.fillStyle = '#fffdfa'
  ctx.fillRect(specBoxX, specCard2Y, specBoxW, specCard2H)
  ctx.strokeStyle = '#d6c8b4'
  ctx.lineWidth = 2
  ctx.strokeRect(specBoxX, specCard2Y, specBoxW, specCard2H)

  ctx.fillStyle = '#87321f'
  ctx.font = '700 18px "IBM Plex Mono", monospace'
  ctx.textAlign = 'left'
  ctx.fillText('UKURAN FURNITUR & AKSESORIS', specBoxX + 28, specCard2Y + 40)

  items.slice(0, 6).forEach((item, i) => {
    const rowY = specCard2Y + 85 + i * 62
    // Item number badge
    ctx.fillStyle = '#f0e6d6'
    ctx.fillRect(specBoxX + 28, rowY - 14, 38, 32)
    ctx.fillStyle = '#7a422b'
    ctx.font = '700 16px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(i + 1).padStart(2, '0'), specBoxX + 47, rowY + 2)

    // Name
    ctx.fillStyle = '#2b1912'
    ctx.font = '700 21px "DM Sans", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(item.name, specBoxX + 80, rowY + 2)

    // Dimensions
    ctx.fillStyle = '#7a513a'
    ctx.font = '600 19px "IBM Plex Mono", monospace'
    ctx.textAlign = 'right'
    const dimText = `${Math.round(item.widthMm / 10)} × ${Math.round(item.depthMm / 10)} × ${Math.round(item.heightMm / 10)} cm`
    ctx.fillText(dimText, specBoxX + specBoxW - 28, rowY + 2)

    // Divider line
    if (i < Math.min(items.length, 6) - 1) {
      ctx.strokeStyle = '#ece3d6'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(specBoxX + 28, rowY + 26)
      ctx.lineTo(specBoxX + specBoxW - 28, rowY + 26)
      ctx.stroke()
    }
  })

  // Card 3: Circulation Guidelines
  const specCard3Y = specCard2Y + specCard2H + 30
  const specCard3H = specBoxH - (390 + specCard2H + 30)
  ctx.fillStyle = '#fffdfa'
  ctx.fillRect(specBoxX, specCard3Y, specBoxW, specCard3H)
  ctx.strokeStyle = '#d6c8b4'
  ctx.lineWidth = 2
  ctx.strokeRect(specBoxX, specCard3Y, specBoxW, specCard3H)

  ctx.fillStyle = '#87321f'
  ctx.font = '700 18px "IBM Plex Mono", monospace'
  ctx.textAlign = 'left'
  ctx.fillText('STANDAR JARAK SIRKULASI', specBoxX + 28, specCard3Y + 38)

  const circNotes = [
    { label: '±60 cm', desc: 'Jarak minimum antara ranjang & furnitur pendamping' },
    { label: '±90 cm', desc: 'Ruang gerak utama pintu & akses lemari pakaian' },
    { label: '1:1 Skala', desc: 'Presisi ukuran dijamin akurat untuk eksekusi nyata' },
  ]
  circNotes.forEach((cn, i) => {
    const cY = specCard3Y + 80 + i * 72
    ctx.fillStyle = '#87321f'
    ctx.font = '700 21px "IBM Plex Mono", monospace'
    ctx.textAlign = 'left'
    ctx.fillText(cn.label, specBoxX + 28, cY)

    ctx.fillStyle = '#553f34'
    ctx.font = '500 18px "DM Sans", sans-serif'
    ctx.fillText(cn.desc, specBoxX + 160, cY)
  })

  // 5. BOTTOM SECTION: 3D REALISTIC PERSPECTIVE PREVIEW
  const bottomY = 1520
  const bottomH = 780

  // 3D Canvas container card
  const renderCardX = 90
  const renderCardW = 1680
  ctx.fillStyle = '#fffdfa'
  ctx.fillRect(renderCardX, bottomY, renderCardW, bottomH)
  ctx.strokeStyle = '#d6c8b4'
  ctx.lineWidth = 2
  ctx.strokeRect(renderCardX, bottomY, renderCardW, bottomH)

  ctx.fillStyle = '#87321f'
  ctx.font = '700 18px "IBM Plex Mono", monospace'
  ctx.textAlign = 'left'
  ctx.fillText('TAMPAK PERSPEKTIF 3D REALISTIS (RENDER INTERIOR)', renderCardX + 28, bottomY + 38)

  // Draw the Three.js 3D render inside with zoom and focus on the room
  const imgAreaX = renderCardX + 24
  const imgAreaY = bottomY + 58
  const imgAreaW = renderCardW - 48
  const imgAreaH = bottomH - 82

  if (threeCanvas && threeCanvas.width > 0 && threeCanvas.height > 0) {
    const { sx, sy, sw, sh } = calculateRenderCrop(
      threeCanvas.width,
      threeCanvas.height,
      imgAreaW,
      imgAreaH,
      room.widthMm,
      room.depthMm
    )

    ctx.save()
    ctx.beginPath()
    ctx.roundRect(imgAreaX, imgAreaY, imgAreaW, imgAreaH, 4)
    ctx.clip()

    ctx.fillStyle = '#eae5dc'
    ctx.fillRect(imgAreaX, imgAreaY, imgAreaW, imgAreaH)
    ctx.drawImage(threeCanvas, sx, sy, sw, sh, imgAreaX, imgAreaY, imgAreaW, imgAreaH)
    ctx.restore()

    ctx.strokeStyle = '#b8a995'
    ctx.lineWidth = 2
    ctx.strokeRect(imgAreaX, imgAreaY, imgAreaW, imgAreaH)
  } else {
    ctx.fillStyle = '#eae5dc'
    ctx.fillRect(imgAreaX, imgAreaY, imgAreaW, imgAreaH)
    ctx.fillStyle = '#7a6659'
    ctx.font = '600 20px "DM Sans", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Pratinjau render 3D ruang interior presisi', imgAreaX + imgAreaW / 2, imgAreaY + imgAreaH / 2)
    ctx.strokeStyle = '#b8a995'
    ctx.lineWidth = 2
    ctx.strokeRect(imgAreaX, imgAreaY, imgAreaW, imgAreaH)
  }

  // Bottom Right: Summary Card & Project Metadata
  const statCardX = renderCardX + renderCardW + 30
  const statCardW = W - 90 - statCardX
  ctx.fillStyle = '#fffdfa'
  ctx.fillRect(statCardX, bottomY, statCardW, bottomH)
  ctx.strokeStyle = '#d6c8b4'
  ctx.lineWidth = 2
  ctx.strokeRect(statCardX, bottomY, statCardW, bottomH)

  ctx.fillStyle = '#87321f'
  ctx.font = '700 18px "IBM Plex Mono", monospace'
  ctx.textAlign = 'left'
  ctx.fillText('RINGKASAN PROYEK', statCardX + 28, bottomY + 38)

  const metaRows = [
    { label: 'DIMENSI RUANG', val: `${formatMeasurement(room.widthMm, unit)} × ${formatMeasurement(room.depthMm, unit)}` },
    { label: 'LUAS LANTAI', val: `${areaM2} m²` },
    { label: 'TINGGI RUANG', val: `${formatMeasurement(room.heightMm, unit)}` },
    { label: 'LEBAR PINTU', val: `${door.widthMm / 10} cm · ${door.side.toUpperCase()} (${door.openingSide === 'left' ? 'KIRI' : 'KANAN'} · ${door.swing === 'outward' ? 'LUAR' : 'DALAM'} · ${door.open !== false ? 'BUKA' : 'TUTUP'})` },
    { label: 'TOTAL FURNITUR', val: `${items.length} Objek Terpasang` },
    { label: 'STATUS TATA RUANG', val: conflicts === 0 ? 'VALID & OPTIMAL' : `${conflicts} KONFLIK` },
  ]

  metaRows.forEach((row, i) => {
    const ry = bottomY + 85 + i * 86
    ctx.fillStyle = '#8f7768'
    ctx.font = '700 13px "IBM Plex Mono", monospace'
    ctx.fillText(row.label, statCardX + 28, ry)

    ctx.fillStyle = row.label === 'STATUS TATA RUANG' && conflicts > 0 ? '#b83b2f' : '#291811'
    ctx.font = '700 22px "DM Sans", sans-serif'
    ctx.fillText(row.val, statCardX + 28, ry + 28)

    if (i < metaRows.length - 1) {
      ctx.strokeStyle = '#ece3d6'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(statCardX + 28, ry + 46)
      ctx.lineTo(statCardX + statCardW - 28, ry + 46)
      ctx.stroke()
    }
  })

  // Footer stamp inside statCard
  ctx.fillStyle = '#87321f'
  ctx.fillRect(statCardX + 28, bottomY + bottomH - 120, statCardW - 56, 4)
  ctx.fillStyle = '#654e41'
  ctx.font = '600 16px "DM Sans", sans-serif'
  ctx.fillText('Ruang Presisi 3D Simulator', statCardX + 28, bottomY + bottomH - 85)
  ctx.font = '500 13px "IBM Plex Mono", monospace'
  ctx.fillStyle = '#9c8879'
  ctx.fillText('Dokumen layout siap produksi & cetak', statCardX + 28, bottomY + bottomH - 58)

  return canvas.toDataURL('image/png')
}
