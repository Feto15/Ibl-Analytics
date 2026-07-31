# Ekstraksi Lanjutan dan Metrik Turunan

Pipeline ini melanjutkan hasil ekstraksi utama tanpa membaca ulang PDF.
Parser memakai halaman teks di `data/processed/all/raw_reports`.

## Data yang Diekstrak

### Start List

Start List adalah roster pertandingan, bukan daftar lima starter. Data yang
diambil:

- tim, nomor jersey, dan pemain;
- kapten;
- posisi;
- tinggi dan umur;
- games played serta rata-rata kompetisi.

Starter ditentukan dari lima pemain pada rotation stint yang dimulai pada
`Q1 10:00`.

### Lineup Analysis

Lineup Analysis berisi aggregate untuk kombinasi lima pemain:

- total durasi;
- points for dan points against;
- plus-minus dan points per minute;
- rebound, steal, turnover, dan assist.

### Rotations Summary

Rotation disimpan sebagai stint berurutan:

- period dan clock mulai;
- period dan clock selesai;
- durasi;
- lima pemain;
- skor dan statistik selama stint.

### Player Plus/Minus

Detailed plus-minus menyimpan perbandingan on/off:

- menit on dan off;
- skor serta plus-minus on dan off;
- points per minute;
- assist, rebound, steal, dan turnover.

Nilai `plus_minus_on` dibandingkan dengan plus-minus Player Evaluation.

### Shot Areas

Total FGM/FGA, 2PM/2PA, 3PM/3PA, dan FTM/FTA dari Shot Areas disimpan menurut
scope laporan. Laporan `full` dibandingkan dengan box score final.

## Hasil Ekstraksi

- Laporan lanjutan: **2.024**, semuanya berhasil dibaca.
- Pemain Start List: **955**.
- Lineup aggregate: **13.003**.
- Rotation stint: **16.277**.
- Detailed plus-minus: **8.653**.
- Baris total Shot Areas: **1.590**.
- File dengan payload identik: **7**, dicatat tetapi tidak dihitung ulang.

Validasi:

- **10.930 passed**.
- **67 needs review**.

Rincian review:

- 32 rotation, terutama pertandingan overtime yang laporan rotation-nya
  berhenti di Q4;
- 12 perbandingan Shot Areas terhadap box score;
- 21 pemain pada satu pertandingan tidak memiliki pasangan Player Evaluation;
- 2 lineup memiliki perbedaan skor antar-PDF.

Sebanyak 916 dari 156.008 referensi pemain pada lineup, rotation, Start List,
dan plus-minus tidak dapat dipasangkan secara pasti. Baris utamanya tetap
disimpan, tetapi referensi pemain yang tidak pasti tidak dipaksakan.

## Penanganan File Duplikat

Terdapat tujuh file yang menghasilkan payload identik untuk pertandingan dan
jenis laporan yang sama:

- 4 laporan Player PlusMinus;
- 2 laporan Shot Areas;
- 1 laporan Rotation Summary.

Sebagian besar merupakan pasangan file biasa dengan file berakhiran `(1)`.
Pada Shot Areas terdapat file biasa dan file `FULL` yang isinya sama.

Kedua PDF tetap dicatat sebagai laporan sumber. Hanya satu payload yang
digunakan, sedangkan salinannya diberi:

```json
{
  "parse_status": "duplicate",
  "duplicate_of_source_sha256": "sha256-laporan-utama"
}
```

Deduplikasi dibatasi berdasarkan game, jenis laporan, dan isi payload. Dampaknya
juga hanya pada jenis laporan tersebut:

- duplikat PlusMinus hanya memengaruhi detailed plus-minus;
- duplikat Shot Areas hanya memengaruhi total Shot Areas;
- duplikat Rotation hanya memengaruhi rotation stint.

Lineup Analysis tidak memiliki duplikat. Box score, statistik pemain,
statistik tim, shot chart, dan metrik turunan tidak berubah. Importer Neon
melewati payload duplikat sehingga tidak ada baris statistik yang dihitung dua
kali.

## Data Lineup dan Rating

Data berikut berasal langsung dari PDF Line Up Analysis:

- lima pemain dalam lineup;
- durasi;
- score for dan score against;
- plus-minus;
- points per minute (`Pts/Min`);
- rebound, steal, turnover, dan assist.

`plus_minus` dan `points_per_minute` lineup bukan hasil perhitungan pipeline.
Nilainya disalin dari PDF dan divalidasi terhadap total skor serta durasi.

Offensive Rating, Defensive Rating, Net Rating, pace, dan possessions yang
tersedia saat ini adalah metrik tingkat tim. Nilainya dihitung dari box score,
bukan diambil dari PDF.

Pipeline belum menghitung ORtg/DRtg lineup. Rating lineup yang benar memerlukan
jumlah possession untuk setiap stint, sedangkan laporan lineup tidak
menyediakan FGA, FTA, dan offensive rebound lengkap per stint. Karena itu,
analisis lineup saat ini menggunakan:

```text
plus_minus
points_per_minute
score_for
score_against
duration_seconds
```

`Pts/Min` tidak boleh ditampilkan atau diberi label sebagai Offensive Rating.

## Metrik Turunan

Metrik dihitung dari statistik yang sudah diekstrak, bukan membaca nilai baru
dari PDF.

### Efficiency

```text
PTS + REB + AST + STL + BLK
- (FGA - FGM) - (FTA - FTM) - TOV
```

### Effective Field Goal Percentage

```text
eFG% = 100 * (FGM + 0.5 * 3PM) / FGA
```

### True Shooting Percentage

```text
TS% = 100 * PTS / (2 * (FGA + 0.44 * FTA))
```

### Estimasi Possessions

```text
Poss = FGA + 0.44 * FTA - ORB + TOV
```

Angka ini adalah estimasi karena play-by-play tidak selalu dapat menentukan
akhir possession secara sempurna.

### Pace dan Rating

```text
Pace = rata-rata possession kedua tim, dinormalisasi ke 40 menit
ORtg = 100 * points / possessions tim
DRtg = 100 * points lawan / possessions lawan
Net Rating = ORtg - DRtg
```

Untuk overtime, pace dinormalisasi kembali ke durasi 40 menit menggunakan
total menit pemain pada box score.

## Audit Metrik

- Baris metrik pemain: **8.690**.
- Baris metrik tim: **792** dari **396 pertandingan**.
- Pemeriksaan aritmetika sumber: **9.482 passed**, tanpa kegagalan.
- Sampel audit lintas musim: **12 baris**.

Seluruh 396 pertandingan mempunyai box score final terstruktur dan metrik tim.

File `audit_samples.json` menyimpan input sumber, hasil, dan rumus agar angka
dapat dihitung ulang secara independen.

## Import Neon

`extractor/import_neon.py` melakukan upsert berdasarkan natural key, sehingga
aman dijalankan ulang. Dry-run memeriksa game, tim, pemain, source shot key,
dan seluruh hubungan file sebelum koneksi database dibuat.

Data dengan status review tetap dapat diimpor untuk audit, tetapi dashboard
sebaiknya memfilter data lineup/rotation yang belum lolos validasi.

Alasan review disimpan langsung di `advanced_validations.jsonl` dengan:

- `rule_code` untuk filter dan pengelompokan dashboard;
- `message` untuk penjelasan yang dapat ditampilkan;
- `severity` dan angka pembanding sebagai konteks audit;
- `issue_key` stabil agar impor ulang tidak membuat duplikat.

Importer hanya memasukkan baris `needs_review` ke tabel `validation_issues`.
Baris yang `passed` tetap tersedia di JSON sebagai jejak validasi, tetapi tidak
memenuhi tabel isu di Neon. Saat impor ulang, isu validasi advanced di Neon
disinkronkan dari JSON terbaru, sehingga isu yang sudah berubah menjadi
`passed` tidak tertinggal sebagai peringatan aktif.

Sinkronisasi tersebut dibatasi berdasarkan laporan yang terdapat dalam input.
Karena itu, mengimpor JSON musim 2026 tidak menghapus validation issue musim
2024/2025.

Lineup, rotation, detailed plus-minus, Shot Areas, dan hubungan pemain dimuat
dalam batch. Importer membaca ID hasil upsert satu kali per jenis data, bukan
menunggu respons database untuk setiap baris. Data advanced untuk laporan yang
sedang diimpor disinkronkan ulang dalam satu transaksi, sedangkan laporan musim
lain tidak disentuh.
