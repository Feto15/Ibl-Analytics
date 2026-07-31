# Implementation Plan Dashboard IBL

## 1. Tujuan

Menyelesaikan dashboard analitik IBL di `dashboard/` sebagai aplikasi kerja
analitik yang membaca data nyata dari Neon PostgreSQL.

Hasil akhir harus:

- menampilkan overview kompetisi sebagai halaman pertama;
- menyediakan seluruh route overview, games, teams, players, lineups, dan review;
- memakai data Neon melalui data-access layer server-only;
- menerapkan aturan `needs_review` secara terbatas sesuai jenis issue;
- dapat dijalankan tanpa error lint, TypeScript, build, maupun runtime;
- dapat digunakan pada desktop dan tetap terbaca pada mobile.

## 2. Batasan Implementasi

Bagian berikut tidak boleh diubah selama implementasi dashboard:

- script dalam `extractor/`;
- JSON hasil ekstraksi;
- `schema.sql`;
- struktur tabel dan data produksi Neon;
- definisi metrik yang sudah dihitung oleh pipeline.

Aturan wajib:

- Gunakan pooled `DATABASE_URL` hanya di server.
- Jangan memakai `NEXT_PUBLIC_DATABASE_URL`.
- Jangan mengakses Neon dari Client Component.
- Jangan menjalankan `drizzle-kit push`.
- Jangan memakai `select *`.
- Jangan mengirim error database mentah ke browser.
- Jangan mengganti angka tidak tersedia menjadi `0`; tampilkan `-`.
- Jangan menggunakan mock data pada halaman produksi.

## 3. Kondisi Awal

Route berikut sudah mempunyai implementasi awal dan harus diaudit, bukan dibuat
ulang tanpa pemeriksaan:

- `/`
- `/games`
- `/games/[gameId]`
- `/teams`
- `/teams/[teamId]`
- `/players`
- `/players/[playerId]`
- `/lineups`
- `/review`
- `/api/games/[gameId]/pbp`

Data-access layer Drizzle juga sudah tersedia dalam `dashboard/lib/db/`.
Keberadaan file belum berarti fiturnya selesai. Setiap route tetap harus diuji
terhadap data Neon, aturan review, loading state, mobile, dan production build.

## 4. Urutan Implementasi

### Step 1 - Audit Baseline

Tugas:

1. Baca `AGENTS.md` dan seluruh dokumen yang dirujuk oleh prompt.
2. Catat route, komponen, query, API, dan state yang sudah tersedia.
3. Cari mock data, placeholder, link `#`, TODO, dan komponen yang belum digunakan.
4. Jalankan lint, TypeScript check, dan production build.
5. Jalankan dashboard dan buka seluruh route dengan data Neon.
6. Catat error build, runtime, browser console, dan query sebelum mengedit.

Output:

- daftar masalah berurutan P0, P1, dan P2;
- baseline command yang gagal atau berhasil;
- daftar fitur yang sudah benar dan tidak perlu dibuat ulang.

Kriteria selesai:

- setiap masalah mempunyai lokasi file dan dampak yang jelas;
- tidak ada asumsi berdasarkan keberadaan file saja.

### Step 2 - Stabilkan Build dan Runtime

Tugas:

1. Perbaiki seluruh error lint dan TypeScript.
2. Perbaiki import atau komponen yang hilang.
3. Pastikan Server Component tidak mengirim fungsi ke Client Component.
4. Pastikan Route Handler PBP dapat dipanggil dengan parameter valid.
5. Tambahkan `notFound()` untuk ID yang tidak ditemukan.
6. Pastikan error boundary tidak memperlihatkan detail internal database.

Output:

- dashboard dapat di-build;
- semua route dapat dibuka tanpa error 500;
- API PBP mengembalikan response yang tervalidasi.

Kriteria selesai:

```bash
cd dashboard
pnpm lint
pnpm exec tsc --noEmit --incremental false
pnpm build
```

Ketiga perintah harus selesai tanpa error.

### Step 3 - Rapikan Arsitektur Data

Tugas:

1. Pastikan `dashboard/lib/db/client.ts` dan seluruh query bersifat server-only.
2. Cocokkan Drizzle schema dengan `schema.sql` tanpa mengubah database.
3. Pilih kolom secara eksplisit pada setiap query.
4. Validasi season, ID, filter, sorting, dan pagination dengan Zod.
5. Pastikan agregasi besar dilakukan di PostgreSQL.
6. Gunakan satu loader untuk data yang saling berkaitan pada satu halaman.
7. Batasi jumlah row untuk PBP, shot, pencarian, dan tabel.
8. Periksa count pagination agar menghitung entitas yang ditampilkan.

Output:

- kontrak data server yang eksplisit;
- query terparameterisasi dan terbatas;
- tidak ada akses database pada browser.

Kriteria selesai:

- tidak ada import `lib/db` dari Client Component;
- tidak ada query tanpa batas untuk dataset besar;
- URL tidak valid menghasilkan fallback atau response 400 yang aman.

### Step 4 - Finalisasi Overview

Tugas:

1. Implementasikan filter season melalui URL query.
2. Tampilkan games, average score, pace, eFG%, ORtg, DRtg, dan net rating.
3. Tampilkan tren pertandingan, ranking tim, leaderboard pemain, dan recent games.
4. Gunakan `team_game_metrics` untuk metrik yang sudah tersedia.
5. Keluarkan data dengan validation issue relevan dari agregasi utama secara
   default.
6. Sediakan kontrol untuk menyertakan data review.
7. Pastikan KPI card tidak terlalu sempit dan tidak memotong label.

Kriteria selesai:

- angka sampel cocok dengan query langsung ke Neon;
- perubahan season dapat dibagikan melalui URL;
- loading, empty, dan error state tersedia.

### Step 5 - Finalisasi Games dan Game Detail

Tugas `/games`:

1. Tampilkan tanggal, week, home, away, score, venue, dan season.
2. Terapkan filter, sorting, pencarian, dan server-side pagination.
3. Jadikan row dapat membuka game detail tanpa konflik dengan link di dalam row.

Tugas `/games/[gameId]`:

1. Tampilkan skor akhir dan skor per quarter.
2. Tampilkan team dan player box score.
3. Tampilkan team metrics tanpa menghitung ulang rating di browser.
4. Tampilkan PBP bertahap melalui Route Handler.
5. Tampilkan shot chart, lineup summary, rotation timeline, dan status validasi.
6. Hubungkan nama tim dan pemain ke halaman detail yang benar.
7. Pastikan label Lineup Summary memakai `lineup_summaries`, sedangkan Rotation
   Timeline memakai `lineup_stints`.

Kriteria selesai:

- game normal, game review, dan ID tidak valid ditangani;
- PBP tidak mengambil seluruh data sekaligus;
- data ambiguous tidak dipakai untuk urutan waktu.

### Step 6 - Finalisasi Teams

Tugas `/teams`:

1. Hitung win/loss dari `games`.
2. Tampilkan points for/against, pace, ORtg, DRtg, net rating, eFG%, dan TS%.
3. Terapkan season, review filter, ranking, dan pagination bila diperlukan.

Tugas `/teams/[teamId]`:

1. Tampilkan ringkasan musim dan tren metrik.
2. Tampilkan games, roster, shot profile, dan pemain utama.
3. Tampilkan lineup terbaik dan terburuk.
4. Pertahankan season saat kembali ke daftar.

Kriteria selesai:

- variasi nama tim tidak membuat tim ganda;
- agregasi tidak terduplikasi karena join one-to-many;
- seluruh rating memakai definisi possession yang benar.

### Step 7 - Finalisasi Players

Tugas `/players`:

1. Tampilkan GP, points, rebounds, assists, efficiency, eFG%, TS%,
   plus-minus, dan minutes.
2. Terapkan search, season, team, sorting, dan server-side pagination.
3. Pastikan total pagination menghitung pemain, bukan jumlah game stats.

Tugas `/players/[playerId]`:

1. Tampilkan profil dan ringkasan statistik.
2. Tampilkan game log, tren, shot chart, detailed plus-minus, dan home/away split.
3. Pertahankan filter season dan team ketika berpindah halaman.

Kriteria selesai:

- satu pemain tidak muncul berkali-kali hanya karena berpindah tim;
- statistik agregat dapat ditelusuri ke game log;
- ID tidak valid menghasilkan not-found.

### Step 8 - Finalisasi Shot Chart

Tugas:

1. Gunakan court SVG atau Canvas dengan aspect ratio stabil.
2. Plot `x`, `y` atau koordinat meter tanpa titik keluar lapangan.
3. Bedakan made dan missed dengan bentuk, bukan hanya warna.
4. Sediakan filter team, player, period, result, area, confidence, dan PBP status.
5. Tampilkan tooltip player, team, made/missed, 2P/3P, area, confidence,
   serta period/clock hanya jika valid.
6. Shot ambiguous tetap boleh tampil berdasarkan lokasi tanpa dipaksa mempunyai
   waktu.
7. Batasi data berdasarkan game, team, player, atau season aktif.

Kriteria selesai:

- titik berada dalam batas lapangan pada desktop dan mobile;
- low-confidence dan ambiguous mempunyai indikator yang jelas;
- chart tidak berubah ukuran saat filter atau tooltip aktif.

### Step 9 - Finalisasi Lineup dan Rotation

Tugas:

1. Gunakan `lineup_summaries` dan `lineup_summary_players` untuk agregat lineup.
2. Gunakan `lineup_stints` dan `lineup_stint_players` untuk timeline rotation.
3. Tampilkan lima pemain, duration, score for/against, plus-minus,
   points/minute, dan statistik lineup.
4. Jangan melabeli `Pts/Min` sebagai ORtg.
5. Terapkan filter season, team, minutes minimum, dan status review.
6. Cegah lineup atau stint duplikat akibat join pemain.

Kriteria selesai:

- satu lineup tampil satu kali dengan lima pemain;
- warning lineup hanya memengaruhi lineup terkait;
- warning rotation hanya memengaruhi timeline terkait.

### Step 10 - Finalisasi Data Review

Tugas:

1. Query `validation_issues` bersama report, game, dan konteks yang relevan.
2. Tampilkan severity, rule code, message, game, report type, source file,
   dan comparison context.
3. Terapkan filter season, report type, severity, dan rule code.
4. Jangan cache daftar review tanpa strategi invalidasi.
5. Hubungkan badge warning pada halaman detail ke issue yang sesuai.
6. Scope issue menggunakan report, team/player context, dan rule code yang tepat.

Kriteria selesai:

- issue lineup tidak menandai rotation atau box score;
- issue rotation tidak menandai semua tim dalam report;
- file sumber dapat dikenali tanpa mengekspos path yang tidak diperlukan.

### Step 11 - UI, Responsiveness, dan Accessibility

Tugas:

1. Lengkapi sidebar untuk seluruh route.
2. Gunakan heading proporsional, radius maksimal 8px, dan layout analitik padat.
3. Hindari landing hero, gradient dekoratif, dan card di dalam card.
4. Gunakan Lucide untuk ikon dan tooltip untuk metrik.
5. Sediakan skeleton stabil, empty state dengan reset, error state dengan retry,
   dan warning state.
6. Uji keyboard navigation, focus state, label control, dan kontras.
7. Uji desktop dan mobile; tabel besar boleh horizontal scroll.
8. Gunakan `lang="id"` jika antarmuka utama berbahasa Indonesia.

Kriteria selesai:

- tidak ada teks, chart, tombol, badge, atau tabel yang bertumpuk;
- informasi status tidak bergantung pada warna saja;
- semua workflow utama tetap dapat dipakai pada mobile.

### Step 12 - Performa dan Security Review

Tugas:

1. Periksa waterfall dan query berulang pada satu halaman.
2. Cache overview dan leaderboard yang stabil.
3. Jangan cache review tanpa invalidasi.
4. Periksa batas pagination dan search.
5. Pastikan credential tidak berada di source, client bundle, log, atau response.
6. Pastikan API tidak mengirim kolom internal yang tidak digunakan.
7. Dokumentasikan usulan index berdasarkan query nyata tanpa mengubah schema.

Kriteria selesai:

- tidak ada `DATABASE_URL` atau credential dalam output client;
- request besar mempunyai batas;
- error production tidak membocorkan SQL atau connection string.

### Step 13 - Verifikasi Akhir

Jalankan:

```bash
cd dashboard
pnpm lint
pnpm exec tsc --noEmit --incremental false
pnpm build
pnpm dev
```

Checklist akhir:

- [ ] Seluruh route utama dapat dibuka.
- [ ] Tidak ada error browser console atau server log.
- [ ] Tidak ada mock data pada halaman produksi.
- [ ] Filter URL bertahan setelah reload dan dapat dibagikan.
- [ ] Semua daftar besar memakai query terbatas dan pagination server.
- [ ] Loading, empty, error, not-found, dan warning state tersedia.
- [ ] KPI sampel cocok dengan data Neon.
- [ ] Review issue mempunyai scope yang benar.
- [ ] Shot chart benar secara visual dan tidak keluar lapangan.
- [ ] Desktop dan mobile sudah diperiksa.
- [ ] Tidak ada credential dalam client bundle.
- [ ] Extractor, JSON, `schema.sql`, dan data Neon tidak berubah.

## 5. Prioritas Pengerjaan

| Prioritas | Cakupan | Syarat lanjut |
| --- | --- | --- |
| P0 | Step 1-3 | lint, TypeScript, build, dan runtime stabil |
| P1 | Step 4-7 | overview dan drilldown utama akurat |
| P1 | Step 8-10 | shot, lineup, rotation, dan review benar |
| P2 | Step 11-12 | UX, mobile, aksesibilitas, performa, security |
| Release | Step 13 | seluruh checklist akhir terpenuhi |

Jangan memulai polish P2 selama masalah P0 masih membuat build atau route utama
gagal. Setelah setiap step, jalankan kembali pemeriksaan yang relevan agar error
tidak menumpuk sampai tahap akhir.

## 6. Definition of Done

Implementasi dianggap selesai hanya jika:

1. seluruh route pada scope berfungsi dengan data Neon nyata;
2. lint, TypeScript check, dan production build lulus;
3. tidak ada mock data atau credential yang masuk browser;
4. aturan validation issue diterapkan terbatas dan konsisten;
5. angka utama telah dibandingkan dengan query Neon;
6. UI desktop dan mobile telah diperiksa secara visual;
7. semua perubahan hanya berada pada dashboard dan dokumentasi dashboard.
