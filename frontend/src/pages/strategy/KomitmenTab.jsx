import { useEffect, useState } from "react";
import { Download, FileSignature, Loader2, Users2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { listDivisi, listAnggota, bscList, okrList, kpiList, visionGet, komitmenPdfUrl } from "@/lib/api";

export default function KomitmenTab({ periodId }) {
  const [divisiList, setDivisiList] = useState([]);
  const [anggotaList, setAnggotaList] = useState([]);
  const [divisiId, setDivisiId] = useState("");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    listDivisi().then(setDivisiList).catch(() => {});
    listAnggota().then(setAnggotaList).catch(() => {});
  }, []);

  useEffect(() => {
    if (!periodId || !divisiId) { setPreview(null); return; }
    setLoading(true);
    Promise.all([
      visionGet(periodId).catch(() => null),
      bscList(periodId).catch(() => []),
      okrList(periodId).catch(() => []),
      kpiList(periodId).catch(() => ({ items: [] })),
    ]).then(([v, b, o, k]) => {
      const divMembers = anggotaList.filter((a) => a.divisi_id === divisiId);
      const memIds = new Set(divMembers.map((m) => m.id));
      const filteredOkr = o.filter((x) => x.divisi_id === divisiId || x.level === "COMPANY");
      const filteredKpi = (k.items || []).filter((x) => memIds.has(x.anggota_id));
      setPreview({
        vision: v || {},
        bsc: b || [],
        okr: filteredOkr,
        kpi: filteredKpi,
        members: divMembers,
      });
    }).finally(() => setLoading(false));
  }, [periodId, divisiId, anggotaList]);

  const download = async () => {
    if (!divisiId) { toast.error("Pilih divisi dulu"); return; }
    setExporting(true);
    try {
      const res = await fetch(komitmenPdfUrl(periodId, divisiId), { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const div = divisiList.find((d) => d.id === divisiId);
      const slug = (div?.nama || "divisi").toLowerCase().replace(/\s+/g, "-");
      a.download = `komitmen-${slug}.pdf`;
      document.body.appendChild(a);
      a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Surat Kesepakatan terunduh");
    } catch (e) {
      toast.error("Gagal ekspor: " + (e.message || "error"));
    }
    setExporting(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5">
        <div className="flex items-center gap-2">
          <FileSignature className="text-emerald-800" size={18} />
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Surat Kesepakatan Target</p>
        </div>
        <p className="mt-1 text-sm text-emerald-950">
          Cetak surat kesepakatan target per divisi. Berisi Visi Misi, BSC, OKR (divisi + company), KPI anggota,
          pernyataan komitmen, dan blok tanda tangan setiap anggota tim.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-white p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Label className="text-xs">Pilih divisi</Label>
            <Select value={divisiId} onValueChange={setDivisiId}>
              <SelectTrigger data-testid="komitmen-divisi-select"><SelectValue placeholder="Pilih divisi untuk cetak surat…" /></SelectTrigger>
              <SelectContent>
                {divisiList.map((d) => <SelectItem key={d.id} value={d.id}>{d.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={download} disabled={!divisiId || exporting} data-testid="komitmen-download-btn"
            className="bg-emerald-900 text-white hover:bg-emerald-800">
            <Download size={14} /> {exporting ? "Menyiapkan..." : "Download PDF"}
          </Button>
        </div>
      </div>

      {loading && <div className="grid place-items-center rounded-xl border border-emerald-100 bg-white p-10"><Loader2 className="animate-spin text-emerald-800" /></div>}

      {preview && !loading && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <PreviewCard title="Visi Misi" filled={!!preview.vision?.visi} sub={preview.vision?.visi ? "Terisi" : "Belum diisi"} testId="prev-vision" />
          <PreviewCard title="BSC Target" filled={preview.bsc.length > 0} sub={`${preview.bsc.length} item`} testId="prev-bsc" />
          <PreviewCard title="OKR" filled={preview.okr.length > 0} sub={`${preview.okr.length} objective`} testId="prev-okr" />
          <PreviewCard title="KPI Anggota" filled={preview.kpi.length > 0} sub={`${preview.kpi.length} indikator`} testId="prev-kpi" />
        </div>
      )}

      {preview && !loading && (
        <div className="rounded-2xl border border-emerald-100 bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <Users2 size={16} className="text-emerald-800" />
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Anggota Tim yang akan menandatangani ({preview.members.length})</p>
          </div>
          {preview.members.length === 0 ? (
            <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50 p-4 text-center text-sm italic text-amber-800">
              Belum ada anggota di divisi ini. Tambahkan anggota di menu Manajemen User sebelum cetak.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {preview.members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3" data-testid="komitmen-member">
                  <div className="grid h-8 w-8 place-items-center rounded-full font-bold text-white text-sm"
                    style={{ background: m.warna || "#059669" }}>
                    {m.nama?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-emerald-950">{m.nama}</p>
                    <p className="text-[10px] text-emerald-800/60">{m.jabatan || "Anggota Tim"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewCard({ title, filled, sub, testId }) {
  return (
    <div data-testid={testId} className={`rounded-xl border p-4 ${filled ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40"}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/70">{title}</p>
        {filled ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Badge variant="outline" className="text-[9px]">Perlu isi</Badge>}
      </div>
      <p className="mt-1 text-sm font-medium text-emerald-950">{sub}</p>
    </div>
  );
}
