# IBL Analytics

Pipeline untuk membaca laporan PDF IBL 2024/2025, memvalidasi hasilnya, dan
menyiapkan data untuk PostgreSQL/Neon.

## Isi

- `schema.sql`: struktur database PostgreSQL/Neon.
- `extractor/scan.py`: inventarisasi seluruh PDF dan jenis laporan.
- `extractor/extract.py`: ekstraksi teks, metadata pertandingan, statistik
  pemain, total tim, dan play-by-play dasar.
- `extractor/extract_shots.py`: ekstraksi koordinat shot location per pemain
  dari laporan Player Evaluation.
- `docs/schema.md`: penjelasan hubungan data.
- `docs/shot-chart-extraction.md`: metode, hasil, status pencocokan, dan
  batasan ekstraksi shot chart.
- `docs/advanced-extraction.md`: ekstraksi roster, lineup, rotation,
  plus-minus, Shot Areas, metrik turunan, dan import Neon.

## Konfigurasi Neon

Simpan connection string di environment lokal, bukan di README atau file yang
akan dibagikan.

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST-POOLER/DB?sslmode=require&channel_binding=require"
DIRECT_DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require&channel_binding=require"
```

Gunakan `DIRECT_DATABASE_URL` untuk menjalankan `schema.sql` atau migration.
Gunakan `DATABASE_URL` yang memakai host `-pooler` untuk app, dashboard, API,
atau script import reguler.

Menjalankan schema:

```bash
psql "$DIRECT_DATABASE_URL" -f schema.sql
```

## Menjalankan scanner

```bash
python3 extractor/scan.py \
  "/Users/rezel/Documents/GAME HOME AWAY IBL 2024" \
  "/Users/rezel/Documents/GAME HOME AWAY IBL 2025" \
  --output data/validation/inventory.json
```

## Uji ekstraksi satu pertandingan

```bash
python3 extractor/extract.py \
  "/Users/rezel/Documents/GAME HOME AWAY IBL 2025/WEEK 1/SABTU, 11 JANUARI 2025/GAME 1 RSB VS KBS" \
  --output data/processed/sample \
  --workers 4
```

## Ekstraksi penuh

```bash
python3 extractor/extract.py \
  "/Users/rezel/Documents/GAME HOME AWAY IBL 2024" \
  "/Users/rezel/Documents/GAME HOME AWAY IBL 2025" \
  --output data/processed/all \
  --workers 4
```

Jika ekstraksi penuh terhenti, jalankan lagi dengan `--resume` agar raw report
yang sudah selesai tidak diproses ulang:

```bash
python3 extractor/extract.py \
  "/Users/rezel/Documents/GAME HOME AWAY IBL 2024" \
  "/Users/rezel/Documents/GAME HOME AWAY IBL 2025" \
  --output data/processed/all \
  --workers 4 \
  --resume
```

PDF sumber hanya dibaca dan tidak diubah. Hasil ekstraksi disimpan sebagai JSONL
dan JSON agar dapat diperiksa sebelum dimuat ke Neon.

## Ekstraksi shot location

Shot location diproses setelah ekstraksi utama selesai. Script ini hanya membaca
record `player_evaluation` dari manifest dan tidak mengulang ekstraksi laporan
lain.

Uji terbatas:

```bash
python3 extractor/extract_shots.py \
  --manifest data/processed/all/manifest.jsonl \
  --output data/processed/shots-sample \
  --workers 2 \
  --season 2025 \
  --limit 20
```

Ekstraksi penuh:

```bash
python3 extractor/extract_shots.py \
  --manifest data/processed/all/manifest.jsonl \
  --output data/processed/shots \
  --workers 2
```

Jika proses terhenti, tambahkan `--resume`. Hasilnya:

- `shots.jsonl`: koordinat marker yang berhasil dideteksi;
- `shot_validations.jsonl`: perbandingan marker dengan FGM/FGA pemain;
- `summary.json`: ringkasan keberhasilan dan marker yang belum terselesaikan;
- `reports/*.json`: checkpoint per laporan untuk mendukung resume.

Nilai `points`, `area_name`, `period_no`, dan `clock` sengaja masih `null`.
Kolom tersebut baru diisi setelah koordinat lolos validasi dan dicocokkan dengan
garis tiga angka serta play-by-play.

## Pengayaan 2P/3P, area, dan play-by-play

Jalankan setelah `extract_shots.py` selesai:

```bash
python3 extractor/enrich_shots.py \
  --manifest data/processed/all/manifest.jsonl \
  --shots data/processed/shots/shots.jsonl \
  --shot-validations data/processed/shots/shot_validations.jsonl \
  --output data/processed/shots-enriched
```

Hasil pengayaan:

- `shots_enriched.jsonl`: shot dengan nilai 2P/3P, area, dan hasil pencocokan;
- `pbp_shot_events.jsonl`: event field-goal play-by-play yang dinormalisasi;
- `enrichment_validations.jsonl`: validasi klasifikasi per pemain;
- `summary.json`: ringkasan area, confidence, dan status pencocokan.

Pencocokan play-by-play bersifat konservatif. `period_no`, `clock`, dan
`pbp_event_key` hanya diisi saat satu marker dapat dipasangkan tanpa ambigu.
Untuk grup ambigu, kandidat event disimpan di `pbp_candidate_event_keys`.
Rincian metode dan hasil ekstraksi saat ini tersedia di
[`docs/shot-chart-extraction.md`](docs/shot-chart-extraction.md).

## Ekstraksi lanjutan

Parser lanjutan memakai JSON raw yang sudah tersedia, sehingga tidak membaca
ulang 4.853 PDF:

```bash
python3 extractor/extract_advanced.py \
  --manifest data/processed/all/manifest.jsonl \
  --raw-reports data/processed/all/raw_reports \
  --output data/processed/advanced
```

Hasilnya mencakup roster Start List, lineup aggregate, rotation stint,
detailed plus-minus, total Shot Areas, dan validasi silang.

## Metrik turunan

```bash
python3 extractor/derive_metrics.py \
  --manifest data/processed/all/manifest.jsonl \
  --output data/processed/metrics \
  --audit-samples 12
```

Metrik yang dihitung adalah efficiency, eFG%, TS%, estimasi possessions,
pace, offensive rating, defensive rating, dan net rating. Input dan rumus
sampel audit disimpan di `audit_samples.json`.

## Import ke Neon

Periksa semua input tanpa koneksi database:

```bash
python3 extractor/import_neon.py \
  --manifest data/processed/all/manifest.jsonl \
  --shots data/processed/shots-enriched/shots_enriched.jsonl \
  --advanced data/processed/advanced/advanced_reports.jsonl \
  --advanced-validations data/processed/advanced/advanced_validations.jsonl \
  --player-metrics data/processed/metrics/player_metrics.jsonl \
  --team-metrics data/processed/metrics/team_metrics.jsonl \
  --schema schema.sql \
  --dry-run
```

Setelah dry-run lolos, hapus `--dry-run` untuk menjalankan import. Script
bersifat idempotent dan membaca connection string dari `DATABASE_URL`.
Gunakan `DIRECT_DATABASE_URL` melalui opsi
`--database-url-env DIRECT_DATABASE_URL` saat schema perlu diterapkan.

Input dapat dibatasi ke satu musim, misalnya seluruh JSON hasil ekstraksi 2026.
Importer hanya menyinkronkan data dan validation issue milik laporan yang ada
dalam input tersebut; data musim sebelumnya tetap tersimpan.

Rincian hasil dan batasannya tersedia di
[`docs/advanced-extraction.md`](docs/advanced-extraction.md).
