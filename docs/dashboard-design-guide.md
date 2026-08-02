# Dashboard Design Guide

Dokumen ini menjadi panduan desain untuk dashboard analitik IBL. Fokusnya adalah
arah visual, arsitektur aplikasi, struktur halaman, pola komponen, dan cara
menampilkan data basket secara jelas.

## Stack Frontend

Stack yang direkomendasikan:

- Next.js untuk routing, API route, server rendering, dan deployment web.
- React untuk komponen UI.
- TypeScript untuk kontrak data yang eksplisit.
- Tailwind CSS untuk styling.
- shadcn/ui dan Radix UI untuk komponen dasar yang aksesibel.
- Recharts untuk grafik standar seperti line, bar, area, radar, dan pie.
- TanStack Table untuk tabel besar dengan sorting, filter, dan pagination.
- Zustand atau URL query state untuk filter lokal yang ringan.

Database dan pipeline data:

- Neon PostgreSQL sebagai sumber data dashboard.
- Python extractor/importer untuk memproses PDF dan mengisi tabel.
- Raw JSON tetap menjadi artefak audit, bukan sumber utama UI harian.

## Arsitektur Aplikasi

Dashboard menggunakan Next.js sebagai aplikasi full-stack. Browser tidak boleh
terhubung langsung ke Neon.

```text
Browser
  -> Next.js Server Component atau Route Handler
  -> data-access layer server-only
  -> Neon PostgreSQL
```

Aturan arsitektur:

- Query Neon hanya dijalankan dari Server Component, Server Action, atau Route
  Handler.
- Modul database wajib ditandai sebagai server-only dan tidak boleh diimpor
  oleh Client Component.
- `DATABASE_URL` menggunakan koneksi pooled Neon dan hanya tersedia di runtime
  server.
- Nama environment variable database tidak boleh memakai awalan
  `NEXT_PUBLIC_`.
- Client Component menerima data yang sudah dipilih dan dibatasi, bukan akses
  database atau kredensial.
- Route Handler digunakan untuk kebutuhan client-side interaktif, export, atau
  integrasi aplikasi lain.
- Validasi parameter, otorisasi, filter status, dan pembatasan jumlah baris
  dilakukan di server.

Backend terpisah belum diperlukan untuk MVP. API terpisah dapat dibuat jika
data yang sama nanti dipakai aplikasi lain, membutuhkan API publik, atau
menjalankan pekerjaan analitik di luar request web.

## Struktur Halaman

Navigasi utama:

| Route | Tujuan |
| --- | --- |
| `/` | Ringkasan kompetisi dan tren musim |
| `/games` | Daftar dan pencarian pertandingan |
| `/games/[gameId]` | Box score, PBP, shot chart, lineup, dan rotation |
| `/teams` | Ranking dan perbandingan tim |
| `/teams/[teamId]` | Profil, tren, pemain, shot profile, dan lineup tim |
| `/players` | Leaderboard dan pencarian pemain |
| `/players/[playerId]` | Statistik, tren, shot chart, dan on/off pemain |
| `/lineups` | Eksplorasi kombinasi lima pemain |
| `/review` | Daftar validation issue dan laporan sumber |

Urutan implementasi MVP:

1. Overview kompetisi.
2. Game list dan game detail.
3. Team list dan team detail.
4. Player list dan player detail.
5. Shot chart.
6. Lineup dan rotation.
7. Data review.

Setiap halaman detail harus menyediakan jalur kembali ke daftar asal dan
mempertahankan filter season yang sedang aktif.

## Prinsip Desain

Dashboard harus terasa seperti alat kerja analitik, bukan landing page. Prioritas
utama adalah keterbacaan, perbandingan cepat, dan drilldown data.

Prinsip utama:

- Padat tetapi tetap rapi.
- Minim dekorasi yang tidak membantu keputusan.
- Navigasi dan filter selalu mudah ditemukan.
- Angka utama harus bisa dibaca dalam satu pandangan.
- Tabel, grafik, dan shot chart harus saling mendukung, bukan berdiri sendiri.
- Semua metrik turunan harus bisa diaudit kembali ke sumber data.

Hindari:

- Hero section marketing.
- Gradient besar sebagai dekorasi utama.
- Card terlalu besar untuk data kecil.
- Warna satu nada yang membuat semua grafik sulit dibedakan.
- Label metrik yang tidak sesuai sumber data.

## Bahasa Visual

Gunakan tampilan modern yang tenang dan analitis:

- Background netral terang atau gelap.
- Border tipis untuk memisahkan area kerja.
- Card radius kecil, sekitar 6-8 px.
- Spacing konsisten dan tidak terlalu longgar.
- Typography jelas, tanpa ukuran heading berlebihan.
- Warna aksen dipakai untuk status, trend, dan kategori data.

Palet warna harus mendukung data basket:

- Netral untuk struktur UI.
- Hijau untuk made shot, positif, atau sukses.
- Merah untuk missed shot, negatif, atau warning.
- Biru atau cyan untuk konteks netral seperti volume dan pace.
- Kuning/oranye untuk peringatan validasi atau data needs review.

## Komponen Utama

Gunakan komponen shadcn/ui sebagai dasar:

- Button untuk aksi eksplisit.
- Tabs untuk berpindah konteks analitik.
- Select dan Combobox untuk filter season, team, player, dan game.
- Table untuk data detail.
- Tooltip untuk definisi metrik dan angka turunan.
- Dialog atau Sheet untuk detail cepat tanpa meninggalkan konteks.
- Badge untuk status validasi, home/away, starter, captain, dan confidence.
- Skeleton untuk loading state.

Komponen dashboard khusus yang perlu dibuat:

- KPI summary card.
- Metric comparison card.
- Shot chart court.
- Player stat table.
- Team stat table.
- Game score summary.
- Play-by-play event list.
- Lineup stint visualization.
- Validation status panel.

## Grafik

Gunakan Recharts untuk grafik umum:

- Bar chart untuk ranking pemain/tim.
- Line chart untuk tren antar pertandingan.
- Area chart untuk volume atau pace trend.
- Radar chart untuk profil pemain atau tim.
- Scatter plot untuk distribusi shot jika tidak memakai court view.

Aturan grafik:

- Semua grafik harus punya tooltip.
- Axis dan legend harus singkat.
- Jangan pakai terlalu banyak warna dalam satu chart.
- Gunakan satu format angka yang konsisten.
- Grafik harus tetap terbaca di mobile dan desktop.

## Shot Chart

Shot chart adalah komponen khusus dan tidak cukup memakai chart library biasa.
Gunakan court SVG atau canvas sebagai dasar visual, lalu render titik tembakan
dari koordinat hasil ekstraksi.

Aturan shot chart:

- Koordinat disimpan dan dipakai dalam format relatif atau meter.
- Made shot dan missed shot harus mudah dibedakan.
- Shot 2P dan 3P dapat diberi bentuk, ukuran, atau layer berbeda.
- Area lapangan harus bisa dipakai untuk filter atau tooltip.
- Shot dengan status `ambiguous` tidak boleh dipaksa punya waktu/quarter.
- Confidence rendah harus ditandai secara visual atau bisa difilter.

Tooltip shot minimal berisi:

- pemain;
- tim;
- hasil made/missed;
- nilai 2P/3P;
- area lapangan;
- period dan clock jika status pencocokan valid;
- status pencocokan PBP.

## Tabel

Tabel adalah bagian utama dashboard, bukan pelengkap. Gunakan TanStack Table
untuk data yang besar atau perlu banyak interaksi.

Fitur tabel yang direkomendasikan:

- sorting;
- search;
- filter;
- pagination;
- column visibility;
- sticky header;
- export CSV jika diperlukan;
- row click untuk membuka detail.

Format angka harus konsisten:

- Persentase memakai satu desimal.
- Durasi memakai `MM:SS` atau menit desimal sesuai konteks.
- Rating memakai satu desimal.
- Plus-minus selalu menampilkan tanda positif atau negatif.

## Metrik dan Label

Label metrik harus akurat terhadap definisi data.

Contoh:

- `eFG%` hanya untuk effective field goal percentage.
- `TS%` hanya untuk true shooting percentage.
- `ORtg` dan `DRtg` hanya untuk rating berbasis possession.
- `Pts/Min` dari lineup PDF tidak boleh dilabeli sebagai Offensive Rating.
- Data `needs review` harus tetap terlihat sebagai status audit.

Setiap metrik turunan sebaiknya punya tooltip definisi singkat dan, jika perlu,
referensi rumus dari dokumentasi pipeline.

## Filter dan State

Filter harus konsisten di seluruh dashboard:

- season;
- fase pertandingan (musim reguler, playoff, atau semua fase);
- team;
- player;
- game;
- home/away;
- report status;
- confidence;
- period;
- shot result;
- shot area.

Filter penting sebaiknya disimpan di URL query agar hasil analisis mudah
dibagikan dan direproduksi.

Aturan state:

- URL query menjadi sumber utama untuk season, team, player, game, period,
  home/away, area, dan status.
- Server membaca URL query dan menjalankan query Neon yang sesuai.
- Zustand hanya digunakan untuk state UI sementara seperti sidebar, sheet,
  dialog, dan preferensi kolom.
- Filter tidak boleh disimpan dalam dua sumber state yang saling bersaing.
- Perubahan filter yang mahal dapat memakai debounce dan tombol apply.
- Reset filter harus tersedia saat hasil kosong.

## Pemetaan Data

| Fitur dashboard | Tabel utama |
| --- | --- |
| Jadwal dan hasil | `games`, `game_periods` |
| Box score tim | `team_game_stats` |
| Box score pemain | `player_game_stats`, `game_rosters` |
| Rating dan pace | `team_game_metrics` |
| Play-by-play | `play_by_play_events` |
| Shot chart | `shots`, `shot_pbp_candidates` |
| Lineup aggregate | `lineup_summaries`, `lineup_summary_players` |
| Rotation timeline | `lineup_stints`, `lineup_stint_players` |
| Detailed plus-minus | `player_plus_minus_details` |
| Validasi Shot Areas | `shot_area_report_totals` |
| Audit dan review | `reports`, `validation_issues` |

Query UI tidak boleh menghitung ulang metrik yang sudah tersedia di
`team_game_metrics` atau statistik turunan pada tabel game stats. Perhitungan
baru yang bersifat agregasi musim boleh dilakukan di server dan harus memakai
definisi rumus yang sama dengan pipeline.

`rotation_segments` bukan sumber utama visualisasi rotation saat ini. Timeline
lima pemain menggunakan `lineup_stints` dan `lineup_stint_players`.

## Data dan Audit

Dashboard membaca data dari Neon PostgreSQL. Raw JSON digunakan untuk audit dan
debug, bukan untuk query UI utama.

Aturan audit:

- Setiap angka yang berasal dari PDF harus punya jalur balik ke report source.
- Data hasil parser dengan status `duplicate` tidak dihitung dua kali.
- Data dengan status review boleh ditampilkan, tetapi harus diberi tanda.
- Dashboard tidak boleh menyembunyikan kegagalan validasi.

Aturan `needs_review`:

- KPI, ranking, dan tren utama memakai data yang tidak memiliki validation
  issue relevan secara default.
- Pengguna dapat mengaktifkan filter untuk menyertakan data review.
- Halaman detail tetap boleh menampilkan data review dengan badge warning.
- Badge membuka detail `rule_code`, `message`, konteks pembanding, dan laporan
  sumber.
- Warning lineup hanya memengaruhi analisis lineup terkait.
- Warning rotation hanya memengaruhi timeline rotation terkait.
- Warning Shot Areas tidak membatalkan box score final.
- Shot ber-confidence rendah tetap dapat ditampilkan jika pengguna
  mengaktifkan filternya.
- Status PBP `ambiguous` tidak boleh digunakan untuk analisis urutan waktu.

## Kontrak Data dan API

Response server harus memakai tipe yang eksplisit dan stabil. Jangan
mengirimkan hasil `select *` langsung ke browser.

Aturan endpoint dan query:

- ID, season, sort, filter, dan pagination divalidasi di server.
- Daftar memakai cursor pagination atau page pagination dengan batas maksimum.
- PBP diambil per game dan dapat dipaginasi atau dikelompokkan per period.
- Shot chart dibatasi berdasarkan game, team, player, atau season yang aktif.
- Query pencarian pemain dan tim memakai batas hasil.
- Export CSV dibuat di server dan mengikuti filter aktif.
- Error database tidak boleh menampilkan connection string atau query sensitif.
- Endpoint yang mahal diberi timeout dan respons error yang dapat dipahami UI.

Kontrak response minimal menyertakan data, metadata pagination jika ada,
filter yang diterapkan, dan status audit yang relevan.

## Performa dan Cache

- Gunakan pooled `DATABASE_URL` untuk request dashboard.
- Pilih kolom yang dibutuhkan dan hindari `select *`.
- Agregasi besar dilakukan di database, bukan di browser.
- Tambahkan index berdasarkan query nyata untuk season, game, team, player,
  report, dan status.
- Cache ringkasan musim dan leaderboard yang jarang berubah.
- Jangan cache data review tanpa strategi invalidasi setelah import baru.
- Shot dan PBP dikirim bertahap agar initial render tetap cepat.
- Tabel besar memakai server-side pagination, sorting, dan filtering.
- Hindari query database berulang dari setiap card pada halaman yang sama;
  gunakan satu data loader server bila datanya berkaitan.

## Loading, Empty, dan Error State

- Gunakan skeleton yang dimensinya sama dengan konten akhir.
- Empty state menjelaskan bahwa filter tidak menghasilkan data dan menyediakan
  reset filter.
- Error state menyediakan retry tanpa menghilangkan filter pengguna.
- Komponen parsial boleh gagal tanpa merusak seluruh halaman jika datanya tidak
  kritis.
- Nilai yang tidak tersedia ditampilkan sebagai `-`, bukan nol.
- Data review, confidence rendah, dan PBP ambiguous bukan error aplikasi.

## Responsiveness

Desktop adalah target utama untuk analisis mendalam. Mobile tetap harus bisa
membaca ringkasan dan tabel penting.

Aturan responsif:

- Filter dapat berubah menjadi sheet atau drawer di mobile.
- Tabel besar boleh memakai horizontal scroll.
- Shot chart harus menjaga aspect ratio.
- Grafik harus punya tinggi tetap agar tidak layout shift.
- Text dalam button, badge, dan card tidak boleh terpotong.

## Aksesibilitas

Gunakan pola aksesibilitas bawaan Radix dan shadcn/ui:

- Semua control punya label yang jelas.
- Warna tidak boleh menjadi satu-satunya pembeda status.
- Tooltip tidak boleh memuat informasi yang wajib untuk memahami data.
- Keyboard navigation harus tetap bekerja untuk filter, tabs, dialog, dan table.

## Implementasi

Template Square UI dapat digunakan sebagai shell awal karena sudah memakai pola
Next.js, TypeScript, Tailwind CSS, dan shadcn/ui. Konten demo harus diganti
dengan komponen domain basket.

Prioritas implementasi:

- Bangun layout dan tema dasar.
- Buat data-access layer server-only dan sambungkan ke Neon.
- Definisikan tipe response serta validasi parameter.
- Buat komponen KPI, chart, table, dan shot chart.
- Tambahkan filter global.
- Tambahkan status audit dan validasi.
- Tambahkan loading, empty, error, pagination, dan cache.

Jangan memasukkan credential ke source code. Gunakan `.env.local` sebagai
environment server Next.js dan `.env` untuk script lokal, dengan file contoh
yang hanya berisi placeholder. Jangan mengekspos `DATABASE_URL` ke Client
Component.
