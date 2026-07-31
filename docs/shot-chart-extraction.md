# Ekstraksi Shot Chart IBL 2024-2025

Dokumen ini mencatat metode dan hasil ekstraksi shot chart dari laporan IBL
2024 dan 2025. Hasil disimpan sebagai JSON terlebih dahulu agar dapat diperiksa
sebelum dimuat ke Neon.

## Sumber Data

- Laporan `Player Evaluation` digunakan untuk memperoleh marker lokasi
  tembakan per pemain.
- Laporan `Play-by-Play` (PBP) digunakan untuk memperoleh quarter, waktu,
  jenis aksi, dan deskripsi tembakan.
- Statistik pemain pada `Player Evaluation` digunakan untuk memvalidasi jumlah
  FGM/FGA dan 3PM/3PA.
- Nama tim dinormalisasi ke kode tim kanonis. Contohnya, `Pelita Jaya` dan
  `Pelita Jaya Jakarta` dipetakan ke kode `PJB`, sedangkan nama asli tetap
  disimpan untuk audit.

## Tahapan Ekstraksi

### 1. Deteksi marker

Shot chart pada PDF bukan data koordinat terstruktur. Lapisan gambar marker
dipisahkan dari gambar dasar lapangan, lalu marker tembakan masuk dan gagal
dideteksi berdasarkan bentuk serta warnanya.

Setiap marker menghasilkan:

- identitas game, tim, dan pemain;
- koordinat sumber `x` dan `y`;
- status masuk atau gagal;
- halaman dan lapisan gambar sumber;
- confidence dan status validasi.

Jumlah marker dibandingkan dengan FGM/FGA pemain. Marker yang bertumpuk tepat
pada piksel yang sama tidak dapat dipisahkan secara andal dan dicatat sebagai
`unresolved`, bukan dibuat sebagai koordinat perkiraan.

### 2. Penentuan 2P/3P

Geometri lapangan dikalibrasi dari gambar dasar pada laporan:

- posisi ring;
- garis baseline;
- garis tiga angka berbentuk busur;
- garis tiga angka di sudut;
- skala piksel ke meter.

Jarak marker terhadap garis tiga angka menentukan nilai awal 2P atau 3P.
Hasilnya kemudian diperiksa terhadap 3PM/3PA pemain.

Jika marker sangat dekat garis dan hasil geometri tidak mungkin cocok dengan
statistik pemain, marker terdekat dari garis disesuaikan. Penyesuaian ini diberi
metode `stats_adjusted` dan confidence `low` agar tetap dapat diaudit.

### 3. Penentuan area lapangan

Setiap marker dimasukkan ke salah satu area:

- `restricted_area`;
- `paint_non_restricted`;
- `left_short_corner` dan `right_short_corner`;
- `left_mid_range`, `center_mid_range`, dan `right_mid_range`;
- `left_corner_3` dan `right_corner_3`;
- `left_wing_3`, `top_3`, dan `right_wing_3`.

Koordinat versi meter juga disimpan dalam `court_x_meters` dan
`court_y_meters`.

### 4. Pencocokan dengan PBP

Event field-goal PBP dinormalisasi menggunakan game, nomor jersey, nama
pemain, tim, status masuk/gagal, dan nilai 2P/3P.

Petunjuk seperti `in the paint`, `outside the paint`, `layup`, dan `dunk`
digunakan untuk mempersempit kandidat. Sebuah waktu hanya dipasang apabila
marker dan event sama-sama memiliki satu pasangan yang mungkin.

Pencocokan sengaja bersifat konservatif karena lapisan marker PDF tidak
menyimpan urutan kejadian. Jika seorang pemain memiliki beberapa tembakan
dengan hasil dan nilai yang sama, koordinat tertentu sering tidak dapat
dibuktikan berasal dari event PBP tertentu.

## Status Pencocokan

| Status | Arti |
| --- | --- |
| `unique` | Hanya ada satu marker dan satu event yang sesuai. |
| `area_constrained` | Pasangan menjadi unik setelah memakai petunjuk area atau jenis aksi. |
| `ambiguous` | Ada beberapa event yang mungkin; kandidat disimpan tetapi waktu tidak diisi. |
| `no_event` | Tidak ada event PBP terselesaikan yang sesuai. |

Untuk status `ambiguous` dan `no_event`, `period_no`, `clock`, dan
`pbp_event_key` dibiarkan kosong. Ini mencegah dashboard menampilkan waktu yang
belum dapat dibuktikan.

## Hasil Saat Ini

### Deteksi koordinat

- Laporan Player Evaluation diproses: **394 dari 394**.
- Percobaan tembakan menurut statistik: **55.907**.
- Koordinat marker berhasil dideteksi: **52.871**.
- Marker unresolved karena tumpang tindih raster: **3.036**.
- Kegagalan laporan: **0**.

### Klasifikasi 2P/3P dan area

- Total shot yang diperkaya: **52.871**.
- Shot 2P: **31.348**.
- Shot 3P: **21.523**.
- Klasifikasi langsung dari geometri: **52.841**.
- Penyesuaian terhadap statistik: **30**.
- Confidence tinggi: **51.193**.
- Confidence sedang: **1.648**.
- Confidence rendah: **30**.
- Pemain yang divalidasi: **7.821**, seluruhnya lolos.

### Pencocokan PBP

- Event field-goal PBP: **55.877**.
- Pemain terselesaikan melalui nama: **53.584 event**.
- Pemain terselesaikan melalui nomor jersey: **1.952 event**.
- Identitas pemain PBP masih ambigu: **341 event**.
- Pasangan `unique`: **6.671 shot**.
- Pasangan `area_constrained`: **2.438 shot**.
- Shot dengan kandidat ambigu: **41.203**.
- Shot tanpa event yang sesuai: **2.559**.

Total **9.109 shot** memiliki quarter dan waktu yang dapat dipasangkan tanpa
event ganda.

## File Hasil

Folder hasil:

```text
data/processed/shots-enriched/
```

Isinya:

- `shots_enriched.jsonl`: shot chart final untuk staging;
- `pbp_shot_events.jsonl`: event field-goal PBP yang telah dinormalisasi;
- `enrichment_validations.jsonl`: validasi 2P/3P per pemain;
- `summary.json`: ringkasan hasil proses.

## Batasan Penggunaan

- Semua 52.871 koordinat dapat digunakan untuk shot chart dan analisis area.
- Hanya status `unique` dan `area_constrained` yang aman untuk analisis
  berdasarkan quarter atau waktu.
- Data `ambiguous` tetap berguna untuk statistik lokasi, tetapi tidak boleh
  dianggap memiliki urutan waktu tertentu.
- Sebanyak 3.036 attempt unresolved tetap dihitung pada statistik pemain,
  tetapi tidak mempunyai koordinat individual.
- JSON ini merupakan staging. Sinkronisasi ke Neon dilakukan setelah aturan
  import dan pemeriksaan data disepakati.
