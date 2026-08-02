# Hasil Ekstraksi Data IBL 2026

## Ringkasan

Ekstraksi penuh dilakukan dari sumber:

```text
/Users/rezel/Documents/HOME AWAY 2026
```

Output disimpan terpisah di:

```text
data/processed/2026
```

Status akhir:

- ekstraksi penuh selesai;
- seluruh PDF berhasil dibaca;
- validasi dan importer `--dry-run` lulus;
- data sudah diimpor nyata ke Neon pada 2 Agustus 2026;
- data yang tidak cocok tetap disimpan dan disiapkan untuk halaman Data Review.

## Base Extraction

| Metrik | Jumlah |
| --- | ---: |
| PDF diproses | 1.628 |
| PDF berhasil | 1.628 |
| PDF gagal | 0 |
| Report parsed | 403 |
| Report raw-only | 1.217 |
| PBP parsial/duplicate | 8 |
| Pertandingan | 132 |

Delapan PBP dengan versi parsial tidak dibuang. File tersebut tetap disimpan
dengan status `duplicate`, tetapi event parsialnya tidak digunakan oleh shot
enrichment atau importer.

## Data Lanjutan

| Data | Jumlah |
| --- | ---: |
| Advanced reports | 679 |
| Start List players | 454 |
| Lineup summaries | 3.892 |
| Rotation stints | 5.233 |
| Detailed player plus-minus | 2.754 |
| Shot Area totals | 530 |

Hasil validasi advanced:

| Status | Jumlah |
| --- | ---: |
| Passed | 3.520 |
| Needs review | 18 |

Issue advanced mencakup validasi lineup, rotation, plus-minus, dan Shot Areas.

## Shot Location

| Metrik | Jumlah |
| --- | ---: |
| Player Evaluation diproses | 132 |
| Player Evaluation gagal | 0 |
| Pemain diperiksa | 2.776 |
| Expected shots | 18.717 |
| Koordinat terdeteksi | 17.544 |
| Unresolved shots | 1.173 |
| Pemain passed | 2.163 |
| Pemain needs review | 613 |

Seluruh 17.544 koordinat yang terdeteksi berhasil diklasifikasikan:

| Klasifikasi | Jumlah |
| --- | ---: |
| 2P | 10.268 |
| 3P | 7.276 |
| Confidence high | 16.962 |
| Confidence medium | 572 |
| Confidence low | 10 |

Metode klasifikasi:

- 17.534 marker memakai geometri lapangan;
- 10 marker memakai penyesuaian terhadap statistik pemain;
- marker yang tidak dapat ditemukan tidak dibuatkan koordinat estimasi;
- perbedaan marker terhadap FGA/FGM disimpan sebagai `needs_review`.

## Pencocokan PBP

| Status | Jumlah |
| --- | ---: |
| Unique | 2.177 |
| Area constrained | 773 |
| Ambiguous | 14.227 |
| No event | 367 |

Pencocokan ambigu tidak dipaksakan. Kandidat event tetap disimpan di
`pbp_candidate_event_keys`, sedangkan period dan clock hanya diisi saat hasil
pencocokan cukup pasti.

## Metrik Turunan

| Data | Jumlah |
| --- | ---: |
| Player metric rows | 2.776 |
| Team metric rows | 264 |
| Pertandingan dengan team metrics | 132 |
| Validasi aritmetika passed | 3.040 |

Metrik memakai formula versi `ibl-derived-metrics-v1` dengan free-throw weight
`0.44`. Data yang dihitung mencakup efficiency, eFG%, TS%, possessions, pace,
offensive rating, defensive rating, dan net rating.

Satu box score final, `BHB vs HTJ, 15 Maret 2026`, awalnya tidak dikenali karena
filename tidak memakai akhiran `Q4` atau `FULL`. Classifier sudah diperbaiki,
file diproses ulang, dan sekarang seluruh 132 pertandingan memiliki team
metrics.

## Data Review

Importer menyiapkan total **631 issue** untuk halaman Data Review:

| Rule | Jumlah |
| --- | ---: |
| Validasi advanced | 18 |
| `shot_marker_count_mismatch` | 613 |
| `team_metrics_unavailable` | 0 |
| Total | 631 |

Data review tidak dibuang dari dataset. Setelah import Neon:

- issue advanced masuk ke tabel `validation_issues`;
- ketidaksesuaian shot per pemain masuk dengan rule
  `shot_marker_count_mismatch`;
- shot yang terdeteksi juga membawa `detection_status`;
- dashboard dapat memfilter musim 2026 dan status review;
- PBP ambigu tetap ditandai melalui `pbp_match_status`, tetapi tidak dibuat
  menjadi ribuan issue Data Review terpisah.

## Hasil Dry-Run Importer

Status importer: `passed`.

Seluruh pemeriksaan berikut menghasilkan nilai nol:

```text
shots_unknown_game: 0
shots_missing_team: 0
shots_missing_player: 0
duplicate_source_shot_keys: 0
advanced_unknown_game: 0
advanced_validations_unknown_report: 0
shot_validations_unknown_report: 0
player_metrics_unknown_game: 0
team_metrics_unknown_game: 0
```

## Quality Gate

- 30 unit test extractor lulus.
- Tidak ada PDF gagal.
- Tidak ada game key kosong.
- Seluruh 1.628 PDF terdeteksi sebagai musim 2026.
- Terdapat 132 game key unik.
- Kode folder `SMB` dikoreksi menjadi kode kanonis `SMP` berdasarkan filename.
- Output lokal berukuran sekitar 156 MB.

## Hasil Import Neon

Import incremental selesai pada 2 Agustus 2026. Verifikasi read-only langsung
dari Neon menghasilkan:

| Data 2026 | Jumlah |
| --- | ---: |
| Games | 132 |
| Reports | 1.628 |
| Duplicate PBP reports | 8 |
| Team metrics | 264 |
| Shots | 17.544 |
| Validation issues | 631 |

Distribusi issue yang tersimpan:

| Rule | Jumlah |
| --- | ---: |
| `rotation_totals_mismatch` | 18 |
| `shot_marker_count_mismatch` | 613 |

Schema Neon juga diperbarui agar `reports.parse_status` menerima status
`duplicate`. Import dilakukan secara incremental dan tidak menghapus data musim
2024-2025.

## Koreksi Overtime SMP vs RSB

File `FIBA Box Score SMP vs RSB 04 April OT1.pdf` awalnya tidak dikenali sebagai
overtime karena filename memakai format rapat `OT1`. Standings sempat memakai
skor regulasi 79-79 sehingga satu win/loss tidak terhitung.

Classifier sudah diperbaiki untuk mengenali `OT`, `OT 1`, dan `OT1`. Setelah
file diproses ulang dan Neon diperbarui, hasil regular season menjadi:

| Tim | GP | W | L | PF | PA |
| --- | ---: | ---: | ---: | ---: | ---: |
| SMP | 20 | 15 | 5 | 1.678 | 1.460 |
| RSB | 20 | 7 | 13 | 1.644 | 1.622 |

Angka tersebut sudah diverifikasi langsung dari Neon dan cocok dengan data
pembanding resmi.

Sinkronisasi data lain untuk pertandingan tersebut juga diverifikasi:

- game periods menyimpan Q1-Q4 dan overtime sebagai period 5;
- team stats menyimpan SMP 84 dan RSB 95;
- total poin player stats adalah SMP 84 dan RSB 95;
- team pace serta offensive, defensive, dan net rating dihitung ulang;
- tersedia 29 lineup summaries, 37 rotation stints, 20 detail plus-minus, dan
  4 Shot Area rows;
- PBP menyimpan 63 event overtime sebagai period 5;
- shot yang berhasil dicocokkan dengan event overtime menyimpan `period_no=5`.

Audit juga menemukan heading `Overtime 1` pada delapan PBP 2026. Seluruh
delapan PBP kanonis sudah diproses ulang agar event overtime tidak lagi
tergabung ke period 4.
