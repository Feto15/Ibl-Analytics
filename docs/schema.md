# Desain Data

Satu pertandingan disimpan sekali di `games`, sedangkan semua PDF sumber
dicatat di `reports`. Statistik pemain, statistik tim, dan play-by-play selalu
menunjuk kembali ke laporan sumber agar angka dashboard bisa diaudit.

Data utama dashboard:

- `games` dan `game_periods`: jadwal, hasil, dan skor quarter.
- `team_game_stats`: statistik tim per pertandingan.
- `player_game_stats`: statistik pemain.
- `play_by_play_events`: kronologi pertandingan.

Data lanjutan:

- `shots`: lokasi, 2P/3P, area, dan hasil tembakan.
- `shot_pbp_candidates`: kandidat play-by-play untuk shot yang belum bisa
  dipasangkan secara unik.
- `game_rosters`: roster, posisi, tinggi, umur, rata-rata kompetisi, serta
  starter yang diturunkan dari rotation.
- `lineup_summaries`: performa aggregate kombinasi lima pemain.
- `lineup_stints`: urutan kombinasi lima pemain di lapangan.
- `rotation_segments`: waktu pemain berada di lapangan.
- `player_plus_minus_details`: perbandingan statistik saat pemain on/off.
- `shot_area_report_totals`: total laporan Shot Areas untuk validasi silang.
- `team_game_metrics`: possessions, pace, dan rating turunan.
- `validation_issues`: data yang harus diperiksa.

`shots.event_id`, quarter, dan waktu hanya diisi untuk status `unique` atau
`area_constrained`. Status `ambiguous` tetap dapat dipakai untuk shot chart,
tetapi tidak untuk analisis urutan waktu sampai kandidatnya diselesaikan.

PDF asli tetap berada di Documents. Teks mentah sebaiknya disimpan sebagai JSON
atau object storage, sedangkan Neon hanya menyimpan data terstruktur.
