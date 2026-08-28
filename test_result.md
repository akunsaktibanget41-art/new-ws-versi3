#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================
# (Preserved.)
#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

user_problem_statement: |
  Iterasi 10 — Enhance Strategi & Eksekusi module + branding tweak:
  (1) Add "Komitmen" tab yang generate Surat Kesepakatan Target PDF per divisi (tanda tangan tim).
  (2) Sidebar: hilangkan text "Ruang Sanad", biar cuma logo + kata "WORKSPACE".
  (3) Sempurnakan flow strategi & eksekusi:
      - Add Visi & Misi (belum ada — jangkar strategi).
      - Link BSC ↔ OKR (sebelumnya tidak terhubung).
      - Update Beranda dashboard menampilkan visi + alur (Visi→BSC→OKR→KPI→Action Plan→Komitmen).

backend:
  - task: "Vision & Mission endpoints (per-period)"
    implemented: true
    working: true
    file: "backend/strategy.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "GET /strategy/vision?period_id= returns {period_id, visi, misi[], nilai[], updated_at} or default empty. PUT /strategy/vision?period_id= (SPV-only) upserts by period_id. Verified via curl."

  - task: "OKR ↔ BSC alignment via bsc_target_id"
    implemented: true
    working: true
    file: "backend/strategy.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "OKR Create/Update models sekarang menerima `bsc_target_id: Optional[str]`. GET /okr response now includes `bsc_target: {id, aspek, nama, target, ...}` decoration (joined from bsc_targets by IDs, batched). Backwards-compatible (nullable)."

  - task: "Komitmen PDF endpoint — Surat Kesepakatan per Divisi"
    implemented: true
    working: true
    file: "backend/strategy.py, backend/komitmen_pdf.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "GET /strategy/komitmen.pdf?period_id=&divisi_id= (SPV-only) generates PDF with: header logo, judul + divisi + periode, Visi & Misi + Nilai, tabel BSC targets, blok OKR + Key Results (DIVISI + COMPANY level untuk divisi tsb), tabel KPI anggota divisi tsb, 4-point pernyataan komitmen, grid tanda tangan tim (2 kolom, blank space + garis + nama), blok Mengetahui SPV / Menyetujui PIC Divisi. Analyze tool result: ALL SECTIONS present and RAPI. File ~374KB (logo embedded). Filename slug per divisi + periode."

frontend:
  - task: "Sidebar rebrand: only 'WORKSPACE' text (hide 'Ruang Sanad')"
    implemented: true
    working: true
    file: "frontend/src/layouts/AppShell.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Sidebar & mobile header sekarang: logo + 'WORKSPACE' (tracking 0.14em, teal-dark), + tagline 'Amal • Kerja • Raport'. 'Ruang Sanad' text dihapus. Screenshot verified."

  - task: "Visi & Misi tab (fondasi strategi)"
    implemented: true
    working: true
    file: "frontend/src/pages/strategy/VisiMisiTab.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Tab baru dengan card visi (Textarea), misi (list of Input, add/delete), nilai (grid 2-col dengan Sparkles icon). Tombol Simpan panggil PUT /strategy/vision. Anchor banner amber."

  - task: "OKR-BSC alignment picker + card badge"
    implemented: true
    working: true
    file: "frontend/src/pages/strategy/OkrTab.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "OkrTab load BSC list (parallel). Dialog OKR sekarang punya Select 'Selaraskan dengan target BSC' (opsional, format '[Aspek] Nama Target'). Card OKR tampilkan badge amber 'BSC: [nama]' bila ada bsc_target_id. Empty BSC = disabled option 'Isi BSC dulu'."

  - task: "Komitmen tab: divisi picker + preview + download PDF"
    implemented: true
    working: true
    file: "frontend/src/pages/strategy/KomitmenTab.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Divisi select + tombol Download PDF (call komitmenPdfUrl + fetch as blob). Preview grid 4 kartu (Visi Misi/BSC/OKR/KPI dengan status Terisi/Perlu isi) + list anggota tim yg akan menandatangani. Empty state kalau divisi belum punya anggota."

  - task: "Strategy Overview: vision banner + flow diagram (Visi→BSC→OKR→KPI→Action Plan→Komitmen)"
    implemented: true
    working: true
    file: "frontend/src/pages/strategy/StrategyOverview.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Beranda dashboard sekarang: banner Visi (quote italic + nilai chips) kalau ada, warning 'belum diisi' kalau kosong. Flow diagram 6-step dengan arrow. Panduan text updated menjelaskan alignment BSC↔OKR. Screenshot verified."

  - task: "Strategy.jsx: add Visi & Misi + Komitmen tabs"
    implemented: true
    working: true
    file: "frontend/src/pages/Strategy.jsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "8 tabs sekarang: Beranda | Visi & Misi | BSC | OKR | KPI | Action Plan | Linimasa | Komitmen. Icon BookOpen dan FileSignature added."

metadata:
  created_by: "main_agent"
  version: "1.10"
  test_sequence: 10
  run_ui: false

test_plan:
  current_focus:
    - "Vision & Mission endpoints (per-period)"
    - "OKR ↔ BSC alignment via bsc_target_id"
    - "Komitmen PDF endpoint — Surat Kesepakatan per Divisi"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Iteration 10 additions on top of Strategy module (iter 9):
        1) NEW backend collection `strategy_vision` — GET/PUT /api/strategy/vision?period_id= (SPV-only PUT).
        2) OKR model updated: `bsc_target_id: Optional[str]`. GET /okr response now includes `bsc_target` object (batched lookup, no N+1).
        3) NEW `/api/strategy/komitmen.pdf?period_id=&divisi_id=` (SPV-only) — PDF Surat Kesepakatan per Divisi.
      Testing focus:
        - PUT /vision idempotent upsert (create then update, same period_id merges).
        - OKR bsc_target_id: create OKR with bsc_target_id → response includes decorated bsc_target block; update to null → block removed.
        - Komitmen PDF: SPV can GET → returns application/pdf > 100KB (with logo). Missing period/divisi → 404. Non-SPV → 403. Empty divisi (0 anggota) → still returns PDF (member section empty but rest OK).
      Regression: iter7/8/9 endpoints still work. Verify /api/ still returns 'Workspace Ruang Sanad API' v1.2.
      Base URL: https://sanad-webapp.preview.emergentagent.com/api. SPV creds in /app/memory/test_credentials.md.
