# Ruang Presisi

> Studio tata ruang interior presisi 1:1 berbasis WebGL, Three.js, dan React 19.

**Ruang Presisi** adalah aplikasi simulator dan perencana tata ruang interior dengan akurasi skala nyata (1 milimeter). Aplikasi ini dirancang untuk memudahkan perencanaan kamar tidur dan ruang interior, penataan furnitur utama serta aksesoris dekoratif, analisis kelayakan sirkulasi gerak, dan ekspor lembar presentasi arsitektural resolusi tinggi siap cetak.

---

## Fitur Utama

### 1. Manajemen Multi-Ruangan (Multi-Room)
- **Kamar Independen**: Pengguna dapat membuat dan mengelola beberapa ruangan sekaligus (misalnya Kamar Tidur Utama, Kamar Anak, Kamar Tamu).
- **Ruangan Baru Kosong**: Setiap penambahan kamar baru dimulai dalam keadaan kosong tanpa furnitur awal, memberi kebebasan penuh dalam mendesain dari nol.
- **Isolasi Data Penuh**: Setiap kamar memiliki dimensi, tata letak pintu, visibilitas dinding, serta susunan objek tersendiri.
- **Penyimpanan Lokal Otomatis**: Data tersimpan di `localStorage` peramban dan secara otomatis memigrasikan skema data versi terdahulu tanpa kehilangan tata letak yang sudah dibuat.

### 2. Katalog Furnitur & Aksesoris Realistis
Katalog dikelompokkan ke dalam dua kategori dengan model 3D prosedural detail dan proporsi akurat:
- **Furnitur Utama**:
  - Tempat Tidur (160 × 200 cm) lengkap dengan kasur, bantal, selimut, dan sandaran kepala ranjang yang posisinya dapat dibalik (atas/bawah).
  - Lemari Pakaian (120 × 60 × 210 cm) dengan alur pintu dan pegangan kuningan.
  - Meja Kerja (120 × 60 × 75 cm) dengan laci samping bertingkat.
  - Kursi Kerja (50 × 50 × 85 cm) dengan sandaran ergonomis bertekstur rotan.
  - Rak Buku (80 × 35 × 160 cm) 4 tingkat lengkap dengan buku warna-warni.
- **Aksesoris & Dekorasi**:
  - Nakas Samping (45 × 40 × 55 cm) dengan laci ganda.
  - Rak Sepatu (80 × 32 × 60 cm) 3 tingkat berpenyangga bilah kayu.
  - Gantungan Baju Berdiri (*Standing Coat Rack*, 45 × 45 × 175 cm) dengan 8 pasang kait gantung kuningan.
  - Vas Bunga & Meja Pedestal (40 × 40 × 85 cm) dengan guci porselen dan tanaman bunga.
  - Lampu Sudut (*Floor Lamp*, 40 × 40 × 155 cm) dengan kap lampu kain hangat dan pilar kuningan.

### 3. Penempatan Cerdas Ruang Kosong (*Smart Placement*)
- Saat menambahkan furnitur atau aksesoris baru, sistem secara otomatis memindai area lantai yang kosong tanpa bertumpuk dengan furnitur yang sudah ada.
- Algoritma penempatan menjaga jarak aman dari dinding dan secara otomatis menghindari area bukaan ayunan pintu.

### 4. Rotasi Derajat Penuh (0°–359°) & Arah Hadap
- **Preset 8 Arah Mata Angin**: Selatan (Depan / 0°), Barat (Kanan / 90°), Utara (Belakang / 180°), Timur (Kiri / 270°), serta 4 sudut serong (45°, 135°, 225°, 315°).
- **Sudut Derajat Bebas**: Input numerik derajat (0–359°) dengan tombol putar cepat ±90°.
- **Perhitungan Dimensi Trigonometrik**: Dimensi *footprint* dihitung otomatis menggunakan fungsi sinus dan kosinus untuk memastikan batas dinding dan deteksi tabrakan tetap akurat pada semua sudut putar.

### 5. Navigasi & Kanvas 3D Interaktif
Toolbar navigasi presisi berada di tengah atas kanvas:
- **Mode Pilih (V)**:
  - *Klik Instan*: Klik pertama langsung memilih objek tanpa perlu menahan (*hold*) atau menyeret (*drag*).
  - *Seret Objek*: Memindahkan objek terpilih di sepanjang bidang lantai secara real-time.
  - *Multi-Seleksi Shift/Ctrl + Klik*: Menahan tombol Shift, Ctrl, atau Command saat mengklik objek menambah atau mengurangi objek dari seleksi.
  - *Kotak Seleksi (Marquee Drag)*: Menyeret kursor pada area kanvas kosong membentuk kotak seleksi bertema; semua furnitur yang bersinggungan langsung terpilih.
- **Mode Geser / Tangan (H)**:
  - Menggeser posisi pandangan kamera (*camera pan*) dengan menyeret kanvas di mana saja.
- **Mode Orbit / Putar (O)**:
  - Memutar sudut pandang 3D (*camera orbit*) mengitari pusat ruangan.
- **Indikator Seleksi Arsitektural**:
  - Seluruh objek yang terpilih ditandai dengan garis batas kuning keemasan (*amber wireframe*) dan plat penanda lantai.

### 6. Penghapusan Aman & Terproteksi
- Menekan tombol **Delete** atau **Backspace** pada keyboard, atau mengklik tombol **Hapus** pada toolbar / panel samping, akan membuka modal konfirmasi bertema bata merah.
- **Proteksi Pengetikan**: Tombol Delete dan Backspace secara otomatis diabaikan jika pengguna sedang mengetik di dalam bidang input teks (nama kamar, ukuran numerik) atau ketika modal dialog lain sedang aktif.
- Modal menampilkan nama objek atau jumlah total objek terpilih, dan dapat dibatalkan sewaktu-waktu dengan tombol **Batal** atau tombol **Escape**.

### 7. Ekspor Lembar Presentasi Arsitektural (2400 × 2400 px PNG)
- **Pemilihan Kamar Eksplisit**: Pengguna wajib memilih satu kamar yang ingin diekspor, menjaga kejelasan dokumentasi (satu kamar per lembar).
- **Sinkronisasi Render 3D**: Sistem menunggu buffer WebGL kamar terpilih selesai dirender sebelum melakukan perekaman gambar, mencegah ketidaksesuaian antara denah dan snapshot 3D.
- **Komponen Lembar Presentasi**:
  - *Denah 2D Tampak Atas Berdimensi*: Dinding berketebalan, bukaan dan ayunan pintu, serta furnitur dengan orientasi bantal dan sandaran tempat tidur yang mengikuti rotasi 3D sebenarnya secara akurat.
  - *Analisis Sirkulasi & Kelayakan*: Ringkasan luas lantai, tinggi plafon, dan verifikasi tabrakan objek.
  - *Tabel Dimensi Furnitur*: Daftar lengkap furnitur yang terpasang beserta dimensi panjang, lebar, dan tinggi dalam sentimeter.
  - *Render 3D Perspektif Realistis*: Snapshot resolusi tinggi dari sudut pandang 3D Three.js.
  - *Metadata & Cap Dokumen Teknis*: Nama kamar, tanggal cetak, dan ringkasan status tata ruang.

### 8. Desain Visual & Aksesibilitas Bertema
- Antarmuka mengusung palet warna klasik bata merah terakota (`#87321f`, `#4a1f17`) dan krem arsitektural (`#f7f0e3`), berpadu dengan tipografi *Newsreader* dan *IBM Plex Mono*.
- Komponen *dropdown* kustom dirancang khusus dengan dukungan navigasi keyboard lengkap (Panah Atas/Bawah, Enter, Space, Escape) sehingga seluruh elemen opsi tampil konsisten di semua sistem operasi.
- Semua kombinasi warna teks memenuhi standar kontras WCAG AA (rasio kontras > 7.6:1).

---

## Pintasan Keyboard (Shortcuts)

| Tombol | Fungsi |
|---|---|
| `V` | Mengaktifkan Mode Pilih (*Select Tool*) |
| `H` | Mengaktifkan Mode Geser / Tangan (*Hand / Pan Tool*) |
| `O` | Mengaktifkan Mode Orbit / Putar (*Orbit Tool*) |
| `Del` / `Backspace` | Membuka konfirmasi hapus untuk objek terpilih |
| `Shift` / `Ctrl` + Klik | Menambah / mengurangi objek dari multi-seleksi |
| `Ctrl + A` / `Cmd + A` | Memilih seluruh objek dalam kamar aktif |
| `Esc` | Membatalkan seleksi objek atau menutup modal dialog |

---

## Struktur Berkas Proyek

```text
interior-design-simulator/
├── public/
│   ├── favicon.svg          # Ikon peramban bertema geometris 3D bata merah
│   └── icons.svg
├── src/
│   ├── App.tsx              # Komponen utama: state multi-kamar, toolbar, modal, panel samping
│   ├── App.css              # Tata letak dasar aplikasi
│   ├── index.css            # Gaya visual bertema bata merah arsitektural, modal, dropdown, toolbar
│   ├── main.tsx             # Titik masuk React
│   ├── model.ts             # Logika bisnis: model data, rotasi trigonometrik, multi-seleksi, deteksi tabrakan
│   ├── model.test.ts        # Unit test Vitest (geometri, seleksi, kamar independen)
│   ├── RoomCanvas.tsx       # Render 3D Three.js / React Three Fiber: kontrol kamera, model furnitur prosedural, marquee drag
│   └── exportPreview.ts     # Generator lembar presentasi arsitektural 2400×2400 px PNG
├── index.html               # Halaman HTML utama dengan tautan favicon
├── package.json             # Konfigurasi dependensi dan skrip
├── tsconfig.json            # Konfigurasi TypeScript
└── vite.config.ts           # Konfigurasi bundler Vite
```

---

## Teknologi yang Digunakan

- **React 19**: Pustaka inti antarmuka pengguna berbasis komponen.
- **TypeScript**: Pengecekan tipe data statis untuk keandalan logika geometri dan tata ruang.
- **Three.js & React Three Fiber (@react-three/fiber)**: Mesin render 3D grafis WebGL.
- **@react-three/drei**: Ekstensi kontrol kamera (`OrbitControls`) dan pencahayaan kontak bayangan (`ContactShadows`).
- **Vite 8**: *Build tool* dan peladen pengembangan ultra-cepat.
- **Vitest**: Kerangka kerja pengujian unit berbasis TDD.
- **Oxlint**: *Linter* performa tinggi berbasis Rust.

---

## Panduan Instalasi & Menjalankan

### Kebutuhan Sistem
- **Node.js**: versi 18.0.0 atau yang lebih baru.
- **npm**, **pnpm**, atau **yarn**.

### Langkah Instalasi

1. **Klon repositori**:
   ```bash
   git clone https://github.com/alrescha79-cmd/ruang-presisi.git
   cd ruang-presisi
   ```

2. **Pasang dependensi**:
   ```bash
   npm install
   ```

3. **Jalankan server pengembangan**:
   ```bash
   npm run dev
   ```
   Buka peramban pada alamat `http://localhost:5173`.

4. **Menjalankan pengujian (*unit tests*)**:
   ```bash
   npm test
   ```

5. **Pemeriksaan tipe data & linter**:
   ```bash
   npm run typecheck
   npm run lint
   ```

6. **Kompilasi produksi**:
   ```bash
   npm run build
   ```
   Hasil kompilasi siap disajikan dari direktori `dist/`.
