# Perbedaan dan Audit Data IBL 2026

## Tujuan

Dokumen ini mencatat perbedaan dataset 2026 terhadap dataset IBL 2024-2025,
hasil pemeriksaan kompatibilitas extractor, serta hal yang harus diperbaiki
sebelum ekstraksi penuh dan import ke Neon.

Sumber data:

```text
/Users/rezel/Documents/HOME AWAY 2026
```

Status saat pembaruan terakhir: perbaikan kompatibilitas, ekstraksi penuh, dan
import nyata 2026 ke Neon sudah selesai. Jumlah data sudah diverifikasi langsung
dari database.

## Status Implementasi

Perbaikan berikut sudah selesai pada extractor versi `0.2.0`:

- root `HOME AWAY 2026` dikenali sebagai musim 2026;
- seluruh 1.628 PDF menghasilkan `source_game_key`, dengan 132 game key unik;
- kode tim dari filename dipakai sebagai sumber kanonis ketika nama folder
  berbeda, sehingga folder `SMB VS RSB` menghasilkan `SMP VS RSB`;
- perbedaan folder dan filename dicatat melalui `team_code_mismatch` serta
  kode tim versi folder tetap disimpan untuk audit;
- satu PBP terlengkap dipilih per pertandingan, sedangkan delapan versi parsial
  `(1)` ditandai `duplicate` dan tidak dipakai oleh enrichment atau importer;
- 28 unit test extractor lulus;
- alur sampel dari base extraction sampai importer `--dry-run` lulus tanpa
  referensi game, tim, atau pemain yang hilang.

Setelah ekstraksi penuh, total unit test bertambah menjadi 29 dan semuanya
lulus.

## Ringkasan Dataset

- Total PDF: **1.628**.
- Folder pertandingan: **132**.
- PDF rusak: **0**.
- PDF terenkripsi: **0**.
- Seluruh pertandingan memiliki Player Evaluation, Line Up Analysis, dan
  Rotations Summary.
- Struktur visual laporan secara umum sama dengan 2024-2025 dan tetap memakai
  format Genius Sports/FIBA.

Distribusi jenis laporan:

| Jenis laporan | Jumlah |
| --- | ---: |
| FIBA Box Score | 536 |
| Play by Play | 140 |
| Player Evaluation | 132 |
| Line Up Analysis | 132 |
| Rotations Summary | 132 |
| Player PlusMinus Summary | 131 |
| Shot Areas | 265 |
| Shot Chart | 133 |
| Start List | 19 |
| Scoresheet/unknown | 8 |

Jumlah Box Score lebih besar dari empat per pertandingan karena terdapat
pertandingan overtime. Jumlah PBP lebih besar karena terdapat delapan file
versi parsial dengan akhiran `(1)`.

## Perbedaan Utama

### 1. Nama root folder

Dataset sebelumnya berada pada folder yang mengandung pola berikut:

```text
GAME HOME AWAY IBL 2024
GAME HOME AWAY IBL 2025
```

Dataset baru memakai:

```text
HOME AWAY 2026
```

Sebelum perbaikan, `path_metadata()` hanya mendeteksi musim melalui pola
`IBL 20xx`, sehingga scanner menghasilkan:

```text
season_year: null
source_game_key: null
```

Masalah ini sudah diperbaiki. Scanner sekarang mengenali kedua pola root dan
menghasilkan 132 game key yang stabil tanpa nilai kosong.

### 2. Variasi nama scope laporan

Dataset 2026 menambahkan beberapa variasi nama:

```text
FULL TIME
HALF TIME
FT
HT
OT
Q4
```

Classifier saat ini sudah mengenali variasi tersebut. Sampel Box Score OT dan
Shot Areas `FULL TIME`/`HALF TIME` berhasil diklasifikasikan dengan benar.

### 3. Folder dengan kode tim salah

Terdapat satu folder:

```text
WEEK 10/SABTU, 4 APRIL 2026/GAME 2 - SMB VS RSB
```

Seluruh nama PDF dan isi laporan pada folder tersebut menyebut:

```text
SMP VS RSB
```

Extractor sekarang memakai pasangan kode tim pada filename sebagai nilai
kanonis dan menyimpan nilai folder sebagai metadata audit. Scanner melaporkan
13 mismatch karena satu folder tersebut berisi 13 PDF; ini satu pertandingan,
bukan 13 pertandingan berbeda. Tidak ada game key yang memakai kode `SMB`.

### 4. PBP parsial dengan akhiran `(1)`

Terdapat delapan pasangan file PBP seperti:

```text
Play by Play ... (1).pdf
Play by Play ....pdf
```

File `(1)` bukan duplikat byte yang sama. File tersebut merupakan versi parsial
yang hanya berisi sekitar 85-99 event, sedangkan file utama umumnya berisi
sekitar 500-600 event.

Pipeline sekarang memilih PBP kanonis berdasarkan jumlah event, jumlah halaman,
dan jumlah karakter teks. File lainnya diberi status `duplicate`, menyimpan
hash sumber PBP kanonis, dan event parsialnya tidak diteruskan ke enrichment
atau importer.

### 5. Scoresheet belum didukung

Terdapat delapan file `Scoresheet`. Classifier saat ini menandainya sebagai:

```text
report_type: unknown
parse_status: raw_only
```

Scoresheet tidak dibutuhkan oleh dashboard saat ini sehingga boleh tetap
disimpan sebagai raw audit dan tidak perlu diparsing pada tahap awal.

### 6. Kelengkapan report tidak seragam

- Start List hanya tersedia untuk 19 dari 132 pertandingan.
- Satu pertandingan tidak memiliki Player PlusMinus Summary:
  `SWS vs BHB, 8 Februari 2026`.
- Satu pertandingan tidak memiliki team Shot Chart:
  `SMP vs SWS, 4 Maret 2026`.
- Dua pertandingan mempunyai Shot Chart `FULL` dan `HALF` sebagai file terpisah.
- Satu pertandingan mempunyai tiga Shot Areas: `HALF`, `Q4`, dan `OT`.

Kekurangan tersebut tidak boleh membuat ekstraksi pertandingan lain gagal.
Nilai yang tidak tersedia harus tetap `null`/kosong dan tidak diganti menjadi
nol.

### 7. Typo tahun pada satu folder

Folder berikut berada di root 2026 tetapi tertulis 2024:

```text
WEEK 6/SABTU, 14 FEBRUARI 2024
```

Nama file dan header PDF menunjukkan pertandingan 14 Februari 2026. Setelah
deteksi root 2026 diperbaiki, musim harus tetap 2026. Header PDF digunakan untuk
memvalidasi tanggal pertandingan.

## Hasil Uji Kompatibilitas

Pengujian dilakukan langsung dari root `HOME AWAY 2026` pada satu pertandingan
reguler yang mempunyai PBP parsial dan satu pertandingan overtime.

Hasil base extraction:

```text
reports: 27
failed: 0
parsed: 7
raw_only: 19
duplicate: 1
games: 2
```

Data terstruktur yang berhasil dibaca:

- Box Score final reguler dan overtime;
- 37 player game stats;
- 1 PBP parsial dikeluarkan dari pemrosesan;
- 55 lineup summaries;
- 75 rotation stints;
- 37 detailed player plus-minus rows;
- 8 Shot Areas totals;
- 4 team metric rows.

Shot extraction sampel:

```text
expected attempts: 305
coordinates detected: 281
unresolved attempts: 24
players passed: 28
players needs_review: 9
```

Seluruh 281 marker yang terdeteksi berhasil diklasifikasikan sebagai 2P/3P dan
area lapangan. Marker unresolved tetap disimpan secara eksplisit melalui
validation status dan tidak dibuat-buat koordinatnya.

Importer `--dry-run` untuk sampel menghasilkan status `passed` dengan:

```text
shots_unknown_game: 0
shots_missing_team: 0
shots_missing_player: 0
duplicate_source_shot_keys: 0
advanced_unknown_game: 0
player_metrics_unknown_game: 0
team_metrics_unknown_game: 0
```

## Hasil Ekstraksi Penuh

Base extraction:

```text
files_seen: 1628
files_failed: 0
parsed: 403
raw_only: 1217
duplicate PBP: 8
```

Data lanjutan dan metrik:

```text
games: 132
lineup_summaries: 3892
rotation_stints: 5233
player_plus_minus: 2754
shot_area_totals: 530
player_metrics: 2776
team_metrics: 264 (132 pertandingan)
```

Shot location:

```text
expected_shots: 18717
coordinates_detected: 17544
unresolved_shots: 1173
players_needing_review: 613
```

Importer `--dry-run` lulus tanpa game, tim, pemain, report, atau source shot key
yang hilang/duplikat. Sebanyak 631 issue disiapkan untuk halaman Data Review:

- 18 issue validasi rotation;
- 613 issue ketidaksesuaian jumlah shot marker per pemain;
- 0 issue team metrics setelah box score final `BHB vs HTJ, 15 Maret 2026`
  berhasil dikenali sebagai final meskipun filename tidak memakai `Q4`/`FULL`.

Seluruh 30 unit test extractor lulus setelah implementasi akhir.

Koreksi lanjutan dilakukan untuk `FIBA Box Score SMP vs RSB 04 April OT1.pdf`.
Format filename `OT1` sebelumnya tidak terdeteksi sebagai overtime, sehingga
standings memakai skor regulasi 79-79. Setelah classifier, metrics, dan Neon
diperbarui, skor final 84-95 menghasilkan standings regular season SMP 15-5 dan
RSB 7-13. Dua issue Shot Areas terkait pertandingan ini ikut terselesaikan.
Parser PBP juga diperbarui untuk heading `Overtime 1`. Delapan PBP overtime
diproses ulang sehingga event tambahan tersimpan sebagai period 5, bukan
tergabung ke period 4.

## Status Kompatibilitas

| Komponen | Status | Catatan |
| --- | --- | --- |
| PDF reading | Aman | Tidak ada file rusak/encrypted |
| Report classification | Aman untuk scope dashboard | Scoresheet tetap unknown/raw-only |
| Season detection | Aman | Seluruh 1.628 PDF terdeteksi sebagai 2026 |
| Game key | Aman | 132 unik dan tidak ada yang kosong |
| Team code | Aman dengan audit | Filename mengoreksi `SMB` menjadi `SMP` |
| Box Score dan overtime | Aman | Q4 dan OT berhasil dibaca |
| Player Evaluation | Aman dengan review | Marker unresolved tetap dicatat |
| PBP | Aman | PBP terlengkap dipilih; versi parsial ditandai duplicate |
| Lineup dan rotation | Aman | Sampel berhasil diparsing |
| Derived metrics | Aman | Sampel dan audit formula berhasil |
| Import incremental | Selesai | Import dan verifikasi Neon lulus |

## Pemeriksaan Sebelum Ekstraksi Penuh

Seluruh perbaikan wajib sudah diterapkan. Hasil scanner penuh terakhir:

```text
by_season.2026: 1628
unique_game_keys: 132
missing_game_keys: 0
unrecognized_team_paths: 0
team_code_mismatches: 13 PDF dalam 1 pertandingan
numbered_copy_candidates: 8
unknown_report_types: 8 Scoresheet
```

Nilai mismatch dan unknown di atas merupakan catatan audit, bukan blocker.

## Urutan Proses yang Disarankan

Simpan output 2026 terpisah dari output 2024-2025:

```text
data/processed/2026/base
data/processed/2026/shots
data/processed/2026/shots-enriched
data/processed/2026/advanced
data/processed/2026/metrics
```

Urutan pengerjaan dan status:

1. Selesai: perbaiki metadata path dan deduplikasi PBP.
2. Selesai: jalankan scanner dan audit 132 game key.
3. Selesai: jalankan base extraction penuh 2026.
4. Selesai: periksa failed, raw-only, final Box Score, dan report duplicate.
5. Selesai: jalankan advanced extraction penuh.
6. Selesai: jalankan shot extraction dan enrichment penuh.
7. Selesai: jalankan derived metrics penuh.
8. Selesai: jalankan importer seluruh output 2026 dengan `--dry-run`.
9. Selesai: bandingkan jumlah game, team, report, player stats, shots, lineup,
   dan validation issues.
10. Selesai: import incremental ke Neon dan verifikasi jumlah data.

Importer bersifat incremental dan idempotent. Input khusus 2026 tidak akan
menghapus data 2024-2025, tetapi import hanya boleh dijalankan setelah season,
game key, team code, dan pemilihan PBP telah tervalidasi.
