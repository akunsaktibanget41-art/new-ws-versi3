import { useEffect, useState } from "react";
import { Save, Plus, Trash2, Eye, Sparkles, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { visionGet, visionUpsert } from "@/lib/api";

export default function VisiMisiTab({ periodId }) {
  const [visi, setVisi] = useState("");
  const [misi, setMisi] = useState([""]);
  const [nilai, setNilai] = useState([""]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await visionGet(periodId);
      setVisi(d?.visi || "");
      setMisi((d?.misi || []).length ? d.misi : [""]);
      setNilai((d?.nilai || []).length ? d.nilai : [""]);
    } finally { setLoading(false); }
  };
  useEffect(() => { if (periodId) load(); /* eslint-disable-next-line */ }, [periodId]);

  const save = async () => {
    setSaving(true);
    try {
      await visionUpsert(periodId, {
        visi: visi.trim(),
        misi: misi.map((m) => m.trim()).filter(Boolean),
        nilai: nilai.map((n) => n.trim()).filter(Boolean),
      });
      toast.success("Visi & Misi tersimpan");
    } catch { toast.error("Gagal simpan"); }
    setSaving(false);
  };

  if (loading) return <div className="grid place-items-center rounded-xl bg-white p-12"><Loader2 className="animate-spin text-emerald-800" /></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-5">
        <div className="flex items-center gap-2">
          <BookOpen className="text-amber-800" size={18} />
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-900">Fondasi Strategi</p>
        </div>
        <p className="mt-1 text-sm text-emerald-950">
          <b>Visi &amp; Misi</b> menjadi jangkar seluruh peta strategi eksekusi. BSC → OKR → KPI → Action Plan semua diturunkan dari sini.
          Isi terlebih dahulu sebelum menyusun BSC dan OKR.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-white p-6">
        <Label className="text-xs font-semibold uppercase tracking-wider text-emerald-800/70">Visi Perusahaan</Label>
        <Textarea rows={3} value={visi} onChange={(e) => setVisi(e.target.value)}
          placeholder="cth: Menjadi perusahaan digital terdepan yang menyeimbangkan kerja profesional dengan amal ibadah."
          data-testid="visi-input" className="mt-1" />
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-white p-6">
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wider text-emerald-800/70">Misi (poin per baris)</Label>
          <Button size="sm" variant="outline" onClick={() => setMisi([...misi, ""])} data-testid="misi-add">
            <Plus size={12} /> Tambah misi
          </Button>
        </div>
        <div className="space-y-2">
          {misi.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-100 font-semibold text-emerald-800">{i + 1}</span>
              <Input value={m} onChange={(e) => setMisi(misi.map((x, idx) => idx === i ? e.target.value : x))}
                placeholder={`Misi ${i + 1}`} data-testid={`misi-input-${i}`} />
              {misi.length > 1 && (
                <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setMisi(misi.filter((_, idx) => idx !== i))} data-testid={`misi-del-${i}`}>
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-white p-6">
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wider text-emerald-800/70">Nilai / Core Values</Label>
          <Button size="sm" variant="outline" onClick={() => setNilai([...nilai, ""])} data-testid="nilai-add">
            <Plus size={12} /> Tambah nilai
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {nilai.map((n, i) => (
            <div key={i} className="flex items-center gap-2">
              <Sparkles size={14} className="text-amber-600" />
              <Input value={n} onChange={(e) => setNilai(nilai.map((x, idx) => idx === i ? e.target.value : x))}
                placeholder={`Nilai ${i + 1} (cth: Amanah)`} data-testid={`nilai-input-${i}`} />
              {nilai.length > 1 && (
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setNilai(nilai.filter((_, idx) => idx !== i))}>
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="bg-emerald-900 text-white hover:bg-emerald-800" data-testid="visi-save-btn">
          <Save size={16} /> {saving ? "Menyimpan..." : "Simpan Visi & Misi"}
        </Button>
      </div>
    </div>
  );
}
