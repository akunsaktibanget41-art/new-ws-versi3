# Workspace Ruang Sanad API

## Share API

Ganti `BASE_URL` dengan domain backend yang sudah dideploy.

- Swagger UI: `https://BASE_URL/docs`
- OpenAPI JSON: `https://BASE_URL/openapi.json`
- API prefix: `https://BASE_URL/api`

Swagger UI adalah referensi kontrak utama: berisi skema request/response, parameter, dan tombol **Try it out** untuk semua endpoint.

## Authentication

Endpoint selain `/api`, `/api/auth/register`, `/api/auth/login`, `/api/auth/google/session`, `/api/auth/me`, dan `/api/auth/logout` memerlukan sesi pengguna yang telah disetujui.

- Login berhasil mengatur cookie HTTP-only `session_token`.
- Client browser harus mengirim cookie dengan `credentials: "include"`.
- Integrasi server-to-server dapat mengirim `Authorization: Bearer <session_token>`.
- Role: `spv` memiliki akses administrasi; `anggota` memiliki akses sesuai divisi/tugasnya.

Contoh login:

```bash
curl -i -X POST "https://BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

Contoh request terautentikasi dengan cookie hasil login:

```bash
curl "https://BASE_URL/api/tasks" \
  --cookie "session_token=SESSION_TOKEN"
```

## Endpoint Catalog

Semua path di bawah diawali `/api`.

### Auth dan User

| Method | Path | Keterangan |
| --- | --- | --- |
| POST | `/auth/register` | Daftarkan akun baru (status pending) |
| POST | `/auth/login` | Login email/password dan buat sesi |
| POST | `/auth/google/session` | Buat sesi dari Google OAuth |
| GET | `/auth/me` | Profil sesi aktif |
| POST | `/auth/logout` | Hapus sesi aktif |
| GET | `/auth/users` | Daftar user (SPV) |
| POST | `/auth/users` | Buat user approved langsung (SPV) |
| PUT | `/auth/users/{user_id}` | Ubah status, role, atau tautan anggota (SPV) |
| DELETE | `/auth/users/{user_id}` | Hapus user (SPV) |
| PUT | `/auth/users/{user_id}/password` | Reset password user (SPV) |
| PUT | `/auth/profile` | Ubah profil atau password sendiri |
| GET | `/auth/api-keys` | Daftar API key milik SPV aktif |
| POST | `/auth/api-keys` | Buat API key untuk integrasi (SPV) |
| DELETE | `/auth/api-keys/{key_id}` | Cabut API key (SPV) |
| GET | `/me/scope` | Role dan cakupan akses sesi aktif |

### Dashboard, Search, dan Notification

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/dashboard/digest` | Ringkasan deadline, tugas mandek, dan prioritas |
| GET | `/search?q=` | Pencarian tugas, amaliyah, anggota, divisi |
| GET | `/notifications/feed` | Delegasi, pengingat deadline, approval pending |
| GET | `/notifications/incoming` | Tugas baru yang didelegasikan ke pengguna |
| POST | `/notifications/mark_seen` | Tandai notifikasi delegasi sudah dibaca |
| GET | `/task_unread` | Jumlah tugas yang dipindahkan dan belum dilihat |
| POST | `/task_mark_seen` | Tandai tugas pindahan sudah dibaca |

### Tasks dan Kolaborasi

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/tasks` | Daftar tugas; filter `kategori`, `status`, `list_id`, `label_id`, `divisi_id`, `archived`, `search`, `tipe` |
| POST | `/tasks` | Buat tugas di workspace sendiri |
| GET | `/tasks/{task_id}` | Detail tugas |
| PUT | `/tasks/{task_id}` | Ubah tugas |
| DELETE | `/tasks/{task_id}` | Hapus tugas |
| POST | `/tasks/{task_id}/move` | Pindah list/divisi atau delegasikan ke anggota lain |
| POST | `/tasks/{task_id}/revisi` | Minta revisi hasil tugas |
| POST | `/tasks/{task_id}/archive` | Arsipkan tugas |
| POST | `/tasks/{task_id}/unarchive` | Pulihkan tugas dari arsip |
| GET | `/tasks/{task_id}/activity` | Riwayat aktivitas dan komentar |
| POST | `/tasks/{task_id}/comment` | Tambah komentar tugas |
| POST | `/tasks/reorder` | Urutkan tugas dalam list |
| POST | `/tasks/bulk_delete` | Hapus banyak tugas |
| POST | `/tasks/bulk_archive` | Arsipkan banyak tugas |
| POST | `/tasks/bulk_unarchive` | Pulihkan banyak tugas |
| POST | `/tasks/bulk_move` | Pindahkan banyak tugas (SPV) |

### Struktur Workspace

| Method | Path | Keterangan |
| --- | --- | --- |
| GET, POST | `/divisi` | Daftar atau buat divisi |
| PUT, DELETE | `/divisi/{divisi_id}` | Ubah atau hapus divisi |
| PUT | `/divisi/{divisi_id}/head` | Tetapkan kepala divisi |
| GET, POST | `/anggota` | Daftar atau buat anggota |
| GET | `/anggota/analytics` | Analitik anggota per divisi/bulan |
| GET, PUT, DELETE | `/anggota/{anggota_id}` | Detail, ubah, atau hapus anggota |
| GET, POST | `/kategori` | Daftar atau buat kategori |
| PUT, DELETE | `/kategori/{kategori_id}` | Ubah atau hapus kategori |
| GET, POST | `/task_lists` | Daftar atau buat kolom kanban |
| PUT, DELETE | `/task_lists/{list_id}` | Ubah atau hapus kolom kanban |
| GET, POST | `/task_labels` | Daftar atau buat label tugas |
| PUT, DELETE | `/task_labels/{label_id}` | Ubah atau hapus label tugas |

### Tracker Rutin dan Amaliyah

| Method | Path | Keterangan |
| --- | --- | --- |
| GET, POST | `/todo/entries` | Baca atau upsert checklist tugas rutin |
| GET, POST | `/amaliyah/items` | Daftar atau buat item amaliyah |
| PUT, DELETE | `/amaliyah/items/{item_id}` | Ubah atau hapus item amaliyah |
| POST | `/amaliyah/items/reorder` | Atur urutan item amaliyah |
| POST | `/amaliyah/items/bulk_delete` | Hapus banyak item amaliyah |
| GET | `/amaliyah/streak` | Streak, badge, dan target berikutnya |
| GET, POST | `/amaliyah/entries` | Baca atau upsert check-in amaliyah pribadi |

### Raport dan Import

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/raport/summary` | Ringkasan raport; filter `start`, `end`, `anggota_id` |
| PUT | `/raport/note` | Simpan catatan dan rekomendasi SPV |
| GET | `/raport/export.pdf` | Unduh PDF raport (SPV) |
| POST | `/import/excel` | Import tugas dan amaliyah dari Excel (SPV) |

### Monitoring

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/monitoring/deadline-radar` | Radar tenggat waktu |
| GET | `/monitoring/workload` | Beban kerja anggota |
| GET | `/monitoring/amaliyah-compliance` | Kepatuhan amaliyah |
| GET | `/monitoring/stagnant-tasks` | Tugas mandek |
| GET | `/monitoring/division-progress` | Progress per divisi |
| GET | `/monitoring/workload-heatmap` | Heatmap beban kerja |
| GET | `/monitoring/user/{anggota_id}` | Monitoring seorang anggota |

### Strategi dan Eksekusi

| Method | Path | Keterangan |
| --- | --- | --- |
| GET, POST | `/strategy/periods` | Daftar atau buat periode strategi |
| GET | `/strategy/periods/active` | Periode strategi aktif |
| PUT, DELETE | `/strategy/periods/{period_id}` | Ubah atau hapus periode |
| POST | `/strategy/periods/{period_id}/activate` | Aktifkan periode |
| GET | `/strategy/dashboard` | Ringkasan strategi periode |
| GET, PUT | `/strategy/vision` | Baca atau upsert visi dan misi |
| GET, POST | `/strategy/bsc` | Daftar atau buat target BSC |
| PUT, DELETE | `/strategy/bsc/{bsc_id}` | Ubah atau hapus target BSC |
| GET | `/strategy/okr` | Daftar OKR; filter `period_id` dan level/owner |
| GET | `/strategy/okr/my` | OKR yang dimiliki atau didukung pengguna |
| POST | `/strategy/okr` | Buat OKR |
| PUT, DELETE | `/strategy/okr/{okr_id}` | Ubah atau hapus OKR |
| POST | `/strategy/okr/{okr_id}/keyresults` | Buat key result |
| PUT, DELETE | `/strategy/okr/{okr_id}/keyresults/{keyresult_id}` | Ubah atau hapus key result |
| POST | `/strategy/okr/{okr_id}/initiatives` | Buat inisiatif OKR |
| PUT, DELETE | `/strategy/okr/{okr_id}/initiatives/{initiative_id}` | Ubah atau hapus inisiatif |
| GET, POST | `/strategy/kpi` | Daftar atau buat KPI |
| PUT, DELETE | `/strategy/kpi/{kpi_id}` | Ubah atau hapus KPI |
| GET, POST | `/strategy/projects` | Daftar atau buat proyek strategis |
| PUT, DELETE | `/strategy/projects/{project_id}` | Ubah atau hapus proyek |
| POST | `/strategy/projects/{project_id}/link-tasks` | Tautkan tugas ke proyek |
| POST | `/strategy/projects/{project_id}/unlink-task` | Lepas tautan tugas dari proyek |
| GET, PUT | `/strategy/evaluation` | Baca atau upsert evaluasi periode |
| GET | `/strategy/komitmen.pdf` | Unduh PDF komitmen divisi (SPV) |
| GET | `/strategy/evaluasi.pdf` | Unduh PDF evaluasi periode (SPV) |

## Error Format

Respons kesalahan FastAPI menggunakan format berikut:

```json
{
  "detail": "Pesan kesalahan"
}
```

Status yang umum: `401` belum login, `403` akses tidak diizinkan, `404` data tidak ditemukan, dan `422` payload tidak valid.
