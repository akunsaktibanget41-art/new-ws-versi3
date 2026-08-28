# Workspace Ruang Sanad — Product Requirements Document

**App**: Notion-style Project Management + Spiritual Tracker + Strategy Execution untuk tim & SPV
**Stack**: React (CRA) + FastAPI + MongoDB
**Language**: Indonesian (Bahasa)
**Brand**: **Workspace Ruang Sanad** — logo: crescent calligraphy + gold accent, tagline "Amal • Kerja • Raport"

## User Personas
- **SPV / Admin**: Approve user baru, atur role & link anggota, monitor deadline & beban kerja, export raport (tim & individu), review keputusan, kelola Strategi & Eksekusi (BSC/OKR/KPI/Action Plan).
- **Anggota**: Isi/update tugas divisi mereka, tracker amaliyah pribadi, tracker rutin pribadi, update aktual KPI mereka, kontribusi KR sebagai owner/supporter OKR.

## Iterasi 11 (Agu 2026) — Workspace Per-Anggota, Delegasi, Revisi, Profil

### 11.1 Workspace Per-Anggota + Delegasi
- Task fields baru: `pemberi_id`, `brief_link`, `hasil_link`, `hasil_catatan`.
- Scope anggota: `$or` [penerima=me, pemberi=me, rutin divisiku]; SPV lihat semua.
- Delegasi: tugas tampil di workspace pemberi (read-only "Monitor") & penerima (editable); hanya penerima/SPV bisa ubah status/hasil.
- Kolom Hasil Tugas di tabel & kanban; RBAC hide "+ Tim"/"Anggota" untuk anggota.
- Fix auth trap: Login.jsx tidak redirect paksa pending; banner amber + "Keluar & ganti akun"; DB promote akunsaktibanget33@gmail.com → SPV.

### 11.2 Delegasi Lintas Divisi + Rapikan Tabel
- `GET /anggota` & `/divisi` mengembalikan semua data ke semua role (picker delegasi).
- `list_tasks`: tanpa filter divisi top-level untuk anggota; `create_task`: divisi_id ikut penerima, list_id null jika lintas.
- Tabel: min-w 1280px, Nama truncate + badge baris kedua, Hasil max-220px.

### 11.3 Review Hasil & Revisi
- Status `REVISI` + fields `revisi_catatan/revisi_at/revisi_count`; endpoint `POST /tasks/{id}/revisi` (pemberi/SPV only).
- Revisi-box untuk pemberi/SPV; revisi-banner merah untuk penerima; dropdown Status di dialog edit; badge REVISI di kanban & tabel.

### 11.4 Profil & Manajemen User
- `/profile` semua role: edit nama/email (unik), ganti password (wajib current, sesi lain dicabut).
- `PUT /auth/profile`, `POST /auth/users` (SPV buat user langsung approved), `PUT /auth/users/{id}/password` (reset + cabut sesi).
- Sidebar: tombol "Profil Saya"; Manajemen User: "Tambah User" + reset password per baris.

### 11.6 Fix Gagal Simpan + Notifikasi Tugas Masuk + Pindah Per-Orang
- Fix "Gagal simpan" saat penerima edit hasil tugas lintas divisi: guard `divisi_id` di `update_task`/`move_task` hanya menolak jika nilai BENAR-BENAR berubah (bukan sekadar ikut terkirim dari form). Toast kini menampilkan pesan error server asli.
- Notifikasi: endpoint `GET /notifications/incoming` (tugas didelegasikan ke saya sejak last_seen, `user_task_seen` collection) + `POST /notifications/mark_seen`. Komponen `NotificationBell.jsx` (lonceng + badge + panel) di header desktop & mobile.
- Pindah tugas per-orang: `MoveTaskPayload.penerima_tugas_id` — SPV/pemberi/penerima boleh reassign, lintas divisi; dialog Pindahkan punya picker "Penerima Baru" grouped per divisi.

### 11.5 Fix Default Backlog, Sinkron Status & Crash Tabel
- Delegasi tidak lagi memindahkan divisi/list tugas — tugas tetap di divisi & list pembuat (default Backlog); penerima melihat via scope. SPV tertaut anggota tercatat sebagai pemberi.
- Sinkron status otomatis saat `list_id` berubah (backend `update_task` + drag kanban): is_done→SELESAI, urutan≤1→BELUM_MULAI, lainnya→DALAM_PROSES.
- Kanban fallback: tugas dengan list milik divisi lain dikelompokkan per status. Tabel: badge status statis untuk list lintas divisi (`row-status-{id}`).
- Fix crash `listMap is not defined` di Row TableView; fix isolasi test profile (temp user per-class untuk xdist).

### Test
- `test_iter11_delegasi.py` (11), `test_iter11_2_cross_divisi.py` (2+1 skip), `test_iter11_3_revisi.py` (7), `test_profile_usermgmt.py` (8) — 28 passed, 1 skipped; reports: test_reports/iteration_13..19.json.

## Iterasi 10 (Feb 2026) — Vision/Mission + BSC↔OKR link + Komitmen PDF + Sidebar rebrand

### 1. Sidebar rebrand
- Hapus text "Ruang Sanad" — cukup logo + kata "WORKSPACE" (tracking 0.14em, teal-dark).

### 2. Visi & Misi (Fondasi Strategi)
- Collection baru `strategy_vision` — 1 doc per periode.
- Endpoints `/api/strategy/vision?period_id=` (GET semua, PUT SPV-only upsert).
- Tab baru "Visi & Misi" di Strategy (setelah Beranda, sebelum BSC).

### 3. BSC ↔ OKR alignment
- OKR model tambah `bsc_target_id: Optional[str]`. GET /okr sekarang include decorated `bsc_target` object (batched lookup).
- Dialog OKR: dropdown "Selaraskan dengan target BSC" (format `[Aspek] Nama Target`). Card OKR tampilkan badge amber "BSC: [nama]".

### 4. Komitmen PDF (Surat Kesepakatan Target)
- New `/app/backend/komitmen_pdf.py` — PDF builder dengan header logo, judul + divisi + periode, blok Visi & Misi + Nilai, tabel BSC, blok OKR + Key Results, tabel KPI anggota, 4-poin pernyataan komitmen, grid tanda tangan 2-kolom per-anggota, blok Mengetahui SPV + Menyetujui PIC Divisi.
- Endpoint `GET /api/strategy/komitmen.pdf?period_id=&divisi_id=` (SPV-only).
- Tab baru "Komitmen" di Strategy dengan divisi picker, preview 4-card status (visi/BSC/OKR/KPI: Terisi/Perlu isi), list anggota yang akan tandatangan, tombol download PDF.

### 5. Strategy Overview updated
- Banner Visi (quote italic) + nilai chips di bagian atas kalau ada visi.
- Warning "Visi & Misi belum diisi" kalau kosong.
- Diagram alur 6-step: Visi & Misi → BSC → OKR → KPI → Action Plan → Komitmen (dengan arrow).

### 6. RCA bug: PUT handlers explicit null unset
- Sebelumnya semua PUT handler pakai `{k:v for k,v in payload.model_dump().items() if v is not None}` → drop explicit null.
- Consequence: PUT /okr/{id} {bsc_target_id: null} TIDAK unset link, karena field null di-drop sebelum $set.
- Fix: 7 update handlers (period/bsc/okr/kr/kpi/project) sekarang pakai `model_dump(exclude_unset=True)` — Pydantic v2 `model_fields_set` respected → field yang sengaja di-null pass through; field yang tidak dikirim tetap di-exclude. KPI anggota RBAC guard juga tightened dengan exclude_unset.


### 1. Menu baru "Strategi & Eksekusi" (SPV-only)
- Route `/strategy`, icon `Target`, nav item baru di antara Monitoring & Manajemen User.
- Hero teal-gradient dengan period selector dropdown + tombol "Periode baru" & "Jadikan aktif".
- 6 tab: **Beranda** (dashboard), **BSC**, **OKR**, **KPI**, **Action Plan**, **Linimasa**.

### 2. Periode dinamis
- CRUD `/api/strategy/periods` — dukung siklus 2/3/6/12 bulan (Siklus/Kuartal/Semester/Tahun) via preset.
- Endpoint `POST /periods/{id}/activate` — only 1 active period at a time.
- Cascade delete: BSC, OKR, KR, KPI, Projects untuk periode itu.

### 3. Balanced Scorecard (BSC)
- 4 aspek: FINANCIAL, CUSTOMER, INTERNAL, LEARNING. Tampilan kartu berwarna per aspek.
- CRUD `/api/strategy/bsc?period_id=` dengan nama/target/achieved.

### 4. OKR (Objectives & Key Results) — dinamis
- Level: COMPANY / DIVISI / INDIVIDU. Tab per-level.
- **Owner (PIC) dinamis**: SPV pilih dari dropdown (nullable → "belum ada owner"). Anggota tanpa OKR tetap bisa jadi **Supporter** (multi via Popover+Checkbox).
- Filter: Semua / Tanpa owner / Per anggota.
- Key Results: inline editable (Input onBlur autosave), progress % = avg (actual/target).
- RBAC: SPV always; owner/supporters bisa update KR (via `user_scope().anggota_id`, not lookup by user_id).

### 5. KPI Dashboard
- Manual entry per periode (SPV) — bobot, target, aktual, polaritas MAX/MIN, optional link ke OKR.
- Formula: MAX → `(aktual/target)*100`, MIN → `(target/aktual)*100`, clamped 200%.
- Weighted score = ach%/100 × bobot. Status: EXCELLENT ≥100, ON_TRACK ≥80, AT_RISK ≥60, else OFF_TRACK.
- Summary per-anggota (grid kartu) + tabel editable (bobot/target/aktual inline).
- RBAC: SPV full CRUD; **anggota bisa update `aktual` saja** pada KPI mereka (fixed via `_my_anggota_id()` helper).

### 6. Action Plan (Proyek Strategis)
- CRUD proyek dengan nama, target_outcome, OMTM, anggaran, divisi, owner, tim.
- **Link ke tasks existing** via multi-select dialog. Progress otomatis dari status task tertaut:
  - `selesai/total × 100` = pct
  - Status: SELESAI (all done), TERLAMBAT (overdue > 0), BERJALAN (has tasks), BELUM_MULAI.
- `start_effective/end_effective` auto-derived dari tasks jika tidak explicit set.

### 7. Linimasa (Gantt-style)
- Peta jadwal proyek berdasarkan `start_effective`→`end_effective`.
- Header bulan otomatis dari range, bar berwarna sesuai status (sky/emerald/red/slate).
- Empty state kalau proyek tidak punya tanggal.

### 8. RBAC Fix
- Helper baru `_my_anggota_id(user)` menggunakan `user_scope()` (baca `user.anggota_id` sesuai auth).
- Sebelumnya, lookup `db.anggota.find_one({user_id: ...})` selalu return None → anggota tidak pernah bisa update aktual KPI/KR. Sekarang berfungsi.
- KPI PUT payload guard tightened: `forbidden = [k for k,v in payload if k!='aktual' and v is not None]` → 403 jika ada field terlarang.

## Architecture

```
/app
├── backend
│   ├── server.py          (register /strategy router)
│   ├── auth.py
│   ├── monitoring.py
│   ├── strategy.py        (NEW — 25+ endpoints for BSC/OKR/KPI/Projects/Dashboard)
│   └── pdf_export.py
└── frontend
    └── src/pages
        ├── Strategy.jsx           (NEW — main page with tabs + period)
        └── strategy/
            ├── PeriodDialog.jsx
            ├── StrategyOverview.jsx
            ├── BscTab.jsx
            ├── OkrTab.jsx
            ├── KpiTab.jsx
            ├── ActionPlanTab.jsx
            └── LinimasaTab.jsx
```

## Testing
- iter7: 13/13 pass (raport digest, per-anggota, monitoring/user)
- iter8: 11/11 pass (rebrand + PDF logo embed)
- iter9: 28/28 pass (Strategy module + RBAC)
- Test files: /app/backend/tests/test_iter7*.py, test_iter8*.py, test_iter9_strategy.py

## Roadmap Backlog
1. **Komitmen** tab — Surat Kesepakatan PDF (generate)
2. **Evaluasi** tab — self-assessment + SPV review per periode
3. **Chart Beban Tim** heatmap divisi × status
4. **Sparkline Individu** — tren task+amaliyah 30-hari di Raport per-anggota
5. **Notifikasi Email approval** (Resend/SendGrid) untuk user baru
6. **Bulk Approve Users** di Manajemen User
7. **Custom SPV Signature** upload untuk PDF raport

## Test Credentials
`/app/memory/test_credentials.md` — SPV: `akunsaktibanget06@gmail.com` / `Qolbu2026!`
