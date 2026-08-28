import { useEffect, useState } from "react";
import { Award, TrendingUp, AlertTriangle, Save, Download, Calendar, User2, Users2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { raportSummary, updateRaportNote, raportExportPdfUrl, listAnggota, listDivisi } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const REKOM_STYLE = {
  REWARD: { label: "REWARD", cls: "bg-emerald-100 text-emerald-900 border-emerald-300", icon: Award },
  EVALUASI: { label: "EVALUASI", cls: "bg-red-100 text-red-900 border-red-300", icon: AlertTriangle },
  NETRAL: { label: "NETRAL", cls: "bg-slate-100 text-slate-800 border-slate-200", icon: TrendingUp },
};

function firstDayOfMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; }
function lastDayOfMonth() { const d = new Date(); const l = new Date(d.getFullYear(), d.getMonth() + 1, 0); return `${l.getFullYear()}-${String(l.getMonth() + 1).padStart(2, "0")}-${String(l.getDate()).padStart(2, "0")}`; }

const PRESETS = [
  { key: "week", label: "7 hari", days: 7 },
  { key: "month", label: "Bulan ini", month: true },
  { key: "30", label: "30 hari", days: 30 },
  { key: "90", label: "90 hari", days: 90 },
];

export default function Raport() {
  const [summary, setSummary] = useState(null);
  const [note, setNote] = useState("");
  const [rekom, setRekom] = useState("NETRAL");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [start, setStart] = useState(firstDayOfMonth());
  const [end, setEnd] = useState(lastDayOfMonth());

  // Per-anggota + divisi filters
  const [divisiId, setDivisiId] = useState("ALL");
  const [anggotaId, setAnggotaId] = useState("ALL");
  const [divisiList, setDivisiList] = useState([]);
  const [anggotaList, setAnggotaList] = useState([]);

  useEffect(() => {
    listDivisi().then(setDivisiList).catch(() => {});
    listAnggota().then(setAnggotaList).catch(() => {});
  }, []);

  const filteredAnggota = anggotaList.filter((a) => divisiId === "ALL" || a.divisi_id === divisiId);

  const load = () => {
    const params = { start, end };
    if (anggotaId !== "ALL") params.anggota_id = anggotaId;
    raportSummary(params).then((s) => {
      setSummary(s);
      setNote(s.spv_note?.catatan_spv || "");
      setRekom(s.spv_note?.rekomendasi || "NETRAL");
    });
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [start, end, anggotaId]);

  // Reset anggota if divisi changes and current anggota not in it
  useEffect(() => {
    if (anggotaId !== "ALL") {
      const found = anggotaList.find((a) => a.id === anggotaId);
      if (found && divisiId !== "ALL" && found.divisi_id !== divisiId) setAnggotaId("ALL");
    }
  }, [divisiId, anggotaId, anggotaList]);

  const save = async () => {
    setSaving(true);
    try {
      await updateRaportNote({ catatan_spv: note, rekomendasi: rekom }, anggotaId !== "ALL" ? { anggota_id: anggotaId } : {});
      toast.success("Catatan SPV tersimpan");
      load();
    } catch { toast.error("Gagal simpan"); }
    setSaving(false);
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const res = await fetch(raportExportPdfUrl(start, end, anggotaId !== "ALL" ? anggotaId : null), { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const anggotaLabel = anggotaId !== "ALL" ? (anggotaList.find((x) => x.id === anggotaId)?.nama || "anggota").replace(/\s+/g, "-").toLowerCase() : "tim";
      a.download = `raport-ruang-sanad-${anggotaLabel}-${start}_${end}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("PDF terunduh");
    } catch (e) {
      toast.error("Gagal ekspor: " + (e.message || "error"));
    }
    setExporting(false);
  };

  const applyPreset = (p) => {
    if (p.month) {
      setStart(firstDayOfMonth()); setEnd(lastDayOfMonth());
    } else {
      const e = new Date();
      const s = new Date(); s.setDate(e.getDate() - (p.days - 1));
      setStart(s.toISOString().slice(0, 10));
      setEnd(e.toISOString().slice(0, 10));
    }
  };

  if (!summary) return <div className="p-8 text-center text-emerald-800/60">Menghitung raport...</div>;

  const auto = summary.auto_rekomendasi;
  const AutoMeta = REKOM_STYLE[auto] || REKOM_STYLE.NETRAL;
  const AutoIcon = AutoMeta.icon;
  const t = summary.task;
  const a = summary.amaliyah;
  const isIndividu = anggotaId !== "ALL";
  const anggotaMeta = anggotaList.find((x) => x.id === anggotaId);
  const divisiMeta = divisiList.find((x) => x.id === (anggotaMeta?.divisi_id || divisiId));

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="rounded-2xl border border-emerald-100 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            {isIndividu ? <User2 size={16} className="text-emerald-700" /> : <Users2 size={16} className="text-emerald-700" />}
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              {isIndividu ? "Raport Individu" : "Raport Tim"}
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Divisi filter */}
            <Select value={divisiId} onValueChange={setDivisiId}>
              <SelectTrigger className="h-9 w-40 text-xs" data-testid="raport-divisi-select">
                <SelectValue placeholder="Divisi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Divisi</SelectItem>
                {divisiList.map((d) => <SelectItem key={d.id} value={d.id}>{d.nama}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Anggota filter */}
            <Select value={anggotaId} onValueChange={setAnggotaId}>
              <SelectTrigger className="h-9 w-52 text-xs" data-testid="raport-anggota-select">
                <SelectValue placeholder="Anggota" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua (Raport Tim)</SelectItem>
                {filteredAnggota.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Export */}
            <Button size="sm" onClick={exportPdf} disabled={exporting} data-testid="export-pdf-btn"
              className="bg-emerald-900 hover:bg-emerald-800 text-white">
              <Download size={14} /> {exporting ? "Menyiapkan…" : "Export PDF"}
            </Button>
          </div>
        </div>

        {/* Period + presets */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-emerald-50 pt-3">
          <Calendar size={16} className="text-emerald-700" />
          <div className="flex items-center gap-1">
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 w-40" data-testid="raport-start" />
            <span className="text-emerald-800/60">→</span>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-40" data-testid="raport-end" />
          </div>
          <div className="ml-auto flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <Button key={p.key} size="sm" variant="ghost" onClick={() => applyPreset(p)} className="text-emerald-800 h-8 text-xs">
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        {isIndividu && anggotaMeta && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs" data-testid="raport-individu-header">
            <div className="grid h-8 w-8 place-items-center rounded-full text-sm font-bold text-white" style={{ background: anggotaMeta.warna || "#059669" }}>
              {anggotaMeta.nama?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-emerald-950">{anggotaMeta.nama}</p>
              <p className="text-emerald-800/70">Divisi: {divisiMeta?.nama || "-"}</p>
            </div>
            <ChevronRight size={14} className="ml-auto text-emerald-700" />
            <p className="text-emerald-800/80">Raport disaring untuk anggota ini.</p>
          </div>
        )}
      </div>

      {/* Hero */}
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-900 to-emerald-950 p-6 text-white md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-emerald-200/80">
              {isIndividu ? `Raport ${anggotaMeta?.nama || "Individu"}` : "Raport Tim Keseluruhan"}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-6xl font-bold" data-testid="combined-score">{summary.combined_score}</span>
              <span className="text-2xl text-emerald-200">/100</span>
            </div>
            <p className="mt-2 text-sm text-emerald-100/80">Kombinasi 60% Tugas + 40% Amaliyah.</p>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-widest text-emerald-200/80">Rekomendasi Otomatis</p>
            <div className="mt-2 flex items-center gap-2">
              <AutoIcon size={22} />
              <span className="font-display text-2xl font-bold">{AutoMeta.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-emerald-100 bg-white p-6">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg font-semibold text-emerald-950">Skor Tugas</p>
            <span className="font-display text-3xl font-bold text-emerald-900" data-testid="task-score">{t.score}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${t.score}%` }} />
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <li className="rounded bg-emerald-50 p-2"><span className="font-semibold text-emerald-900">{t.selesai}</span> Selesai</li>
            <li className="rounded bg-amber-50 p-2"><span className="font-semibold text-amber-900">{t.dalam_proses}</span> Proses</li>
            <li className="rounded bg-red-50 p-2"><span className="font-semibold text-red-900">{t.terkendala}</span> Terkendala</li>
            <li className="rounded bg-slate-50 p-2"><span className="font-semibold text-slate-800">{t.overdue}</span> Overdue</li>
          </ul>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-white p-6">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg font-semibold text-emerald-950">Skor Amaliyah</p>
            <span className="font-display text-3xl font-bold text-emerald-900" data-testid="amaliyah-score-raport">{a.score}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${a.score}%` }} />
          </div>
          <p className="mt-4 text-sm text-emerald-800/70">
            <span className="font-semibold text-emerald-900">{a.total_entries}</span> check-in tercatat dari target{" "}
            <span className="font-semibold text-emerald-900">{a.target}</span> ({a.items_count} amaliyah × {a.days} hari)
          </p>
          {isIndividu && a.total_entries === 0 && (
            <p className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
              Belum ada data amaliyah untuk anggota ini (mungkin belum di-link ke user).
            </p>
          )}
        </div>
      </div>

      {/* SPV Notes */}
      <div className="rounded-xl border border-emerald-100 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-semibold text-emerald-950">
              {isIndividu ? `Catatan untuk ${anggotaMeta?.nama || "Anggota"}` : "Catatan & Keputusan Tim"}
            </p>
            <p className="text-xs text-emerald-800/60">Rekomendasi otomatis boleh di-override oleh SPV.</p>
          </div>
          <Badge className={`${REKOM_STYLE[rekom].cls} border`}>Keputusan: {rekom}</Badge>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-emerald-900">Keputusan SPV</label>
            <Select value={rekom} onValueChange={setRekom}>
              <SelectTrigger data-testid="rekom-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="REWARD">REWARD - Diberi apresiasi</SelectItem>
                <SelectItem value="EVALUASI">EVALUASI - Perlu evaluasi</SelectItem>
                <SelectItem value="NETRAL">NETRAL - Lanjut monitoring</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-emerald-900">Catatan (arahan, apresiasi, evaluasi)</label>
            <Textarea rows={5} value={note} onChange={(e) => setNote(e.target.value)} data-testid="spv-note-input" placeholder="Tuliskan arahan atau catatan..." />
          </div>
          <Button onClick={save} disabled={saving} data-testid="save-spv-note" className="bg-emerald-900 text-white hover:bg-emerald-800">
            <Save size={16} /> {saving ? "Menyimpan..." : "Simpan Keputusan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
