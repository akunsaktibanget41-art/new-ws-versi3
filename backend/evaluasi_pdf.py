"""Rekap Evaluasi Raker PDF — full strategy recap (Visi, BSC, OKR, Action Plan, KPI) per period."""
import io
import os
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image,
)
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfgen import canvas


EMERALD_DARK = colors.HexColor("#0F4F47")
EMERALD_MED = colors.HexColor("#0EA372")
EMERALD_TINT = colors.HexColor("#F1FAF5")
GOLD = colors.HexColor("#C8A24C")
INK = colors.HexColor("#0F172A")
MUTED = colors.HexColor("#64748B")
BORDER = colors.HexColor("#DDE7E4")
GREEN = colors.HexColor("#059669")
AMBER = colors.HexColor("#D97706")
RED = colors.HexColor("#DC2626")

LOGO_PATH = os.path.join(os.path.dirname(__file__), "assets", "ruang_sanad_logo.png")
PAGE_W, PAGE_H = A4
CONTENT_W = PAGE_W - 3.6 * cm

ASPEK_LABEL = {"FINANCIAL": "Financial", "CUSTOMER": "Customer", "INTERNAL": "Internal Process", "LEARNING": "Learning & Growth"}
STATUS_LABEL = {"ON_TRACK": "ON TRACK", "NEED_IMPROVEMENT": "NEED IMPROVEMENT", "OFF_TRACK": "OFF TRACK", "EXCELLENT": "ON TRACK", "AT_RISK": "NEED IMPROVEMENT"}
STATUS_COLOR = {"ON_TRACK": GREEN, "NEED_IMPROVEMENT": AMBER, "OFF_TRACK": RED, "EXCELLENT": GREEN, "AT_RISK": AMBER}


def _footer(canvas_obj: canvas.Canvas, doc):
    canvas_obj.saveState()
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(MUTED)
    canvas_obj.drawString(1.8 * cm, 1 * cm, "Workspace Ruang Sanad · Rekap Evaluasi Raker")
    canvas_obj.drawRightString(PAGE_W - 1.8 * cm, 1 * cm, f"Halaman {doc.page}")
    canvas_obj.setStrokeColor(BORDER)
    canvas_obj.line(1.8 * cm, 1.35 * cm, PAGE_W - 1.8 * cm, 1.35 * cm)
    canvas_obj.restoreState()


def _get_logo(height=16 * mm):
    if os.path.exists(LOGO_PATH):
        try:
            img = Image(LOGO_PATH)
            iw, ih = img.wrap(0, 0)
            ratio = iw / max(ih, 1)
            img.drawHeight = height
            img.drawWidth = height * ratio
            return img
        except Exception:
            pass
    return None


def build_evaluasi_pdf(period: dict, data: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=1.4 * cm, bottomMargin=2 * cm,
        leftMargin=1.8 * cm, rightMargin=1.8 * cm,
        title=f"Rekap Evaluasi Raker — {period.get('nama')}",
        author="Workspace Ruang Sanad",
    )
    styles = getSampleStyleSheet()
    body = ParagraphStyle("body", parent=styles["BodyText"], fontSize=10, leading=14, textColor=INK)
    small = ParagraphStyle("small", parent=styles["BodyText"], fontSize=9, textColor=MUTED, leading=12)
    small_r = ParagraphStyle("small_r", parent=small, alignment=TA_RIGHT)
    cell = ParagraphStyle("cell", parent=body, fontSize=9, leading=12)
    cell_w = ParagraphStyle("cell_w", parent=cell, textColor=colors.white)
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], textColor=EMERALD_DARK, fontSize=18, alignment=TA_CENTER, spaceAfter=2)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=EMERALD_DARK, fontSize=12, spaceAfter=4, spaceBefore=10)
    subj = ParagraphStyle("subj", parent=small, alignment=TA_CENTER, textColor=INK, spaceAfter=4)
    body_j = ParagraphStyle("body_j", parent=body, alignment=TA_JUSTIFY)
    brand_name = ParagraphStyle("bn", parent=body, textColor=EMERALD_DARK, fontSize=14, leading=17, fontName="Helvetica-Bold")
    brand_sub = ParagraphStyle("bs", parent=small, textColor=GOLD, fontSize=8, leading=11)
    label_kv = ParagraphStyle("lkv", parent=small, fontSize=8, leading=11, alignment=TA_RIGHT)
    value_kv = ParagraphStyle("vkv", parent=small_r, textColor=INK, fontSize=10, leading=13, fontName="Helvetica-Bold")

    story = []

    # ---------- HEADER ----------
    logo = _get_logo(height=16 * mm)
    period_cell = Table(
        [[Paragraph("PERIODE", label_kv)],
         [Paragraph(f"{period.get('nama')}", value_kv)],
         [Paragraph(f"{period.get('start')} — {period.get('end')}", small_r)]],
        colWidths=[5.6 * cm],
    )
    period_cell.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("BOX", (0, 0), (-1, -1), 0.4, BORDER), ("BACKGROUND", (0, 0), (-1, -1), EMERALD_TINT),
    ]))
    header = Table(
        [[logo if logo else Paragraph("<b>Sanad</b>", brand_name),
          [Paragraph("Workspace <font color='#C8A24C'>Ruang Sanad</font>", brand_name),
           Paragraph("Rekap Evaluasi Raker", brand_sub)],
          period_cell]],
        colWidths=[2.4 * cm, 8.4 * cm, 5.8 * cm],
    )
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                                ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    story.append(header)
    story.append(Spacer(1, 4))
    hr = Table([[""]], colWidths=[CONTENT_W], rowHeights=[2])
    hr.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), GOLD)]))
    story.append(hr)
    story.append(Spacer(1, 12))

    story.append(Paragraph("REKAP EVALUASI STRATEGI &amp; EKSEKUSI", h1))
    story.append(Paragraph(f"Bahan Rapat Kerja (Raker) · Periode <b>{period.get('nama')}</b>", subj))
    story.append(Spacer(1, 6))

    # ---------- RINGKASAN EKSEKUTIF ----------
    overall = data.get("overall_okr", {}) or {}
    okr_stats = data.get("okr_stats", {}) or {}
    stat_cards = [[
        _stat_cell("Rata-rata OKR", f"{overall.get('avg', 0)}%", STATUS_LABEL.get(overall.get('label'), '-'), STATUS_COLOR.get(overall.get('label'), MUTED)),
        _stat_cell("Skor KPI Tim", f"{data.get('kpi_final_score', 0)}", f"dari bobot {data.get('kpi_total_bobot', 0)}%", EMERALD_DARK),
        _stat_cell("Total OKR", f"{okr_stats.get('total', 0)}", f"{okr_stats.get('on_track', 0)} on-track · {okr_stats.get('off_track', 0)} off", EMERALD_DARK),
        _stat_cell("Proyek Strategis", f"{len(data.get('projects', []))}", "Action Plan", EMERALD_DARK),
    ]]
    grid = Table(stat_cards, colWidths=[CONTENT_W / 4] * 4)
    grid.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                              ("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 3)]))
    story.append(grid)

    # ---------- VISI & MISI ----------
    vision = data.get("vision") or {}
    if vision.get("visi") or vision.get("misi"):
        story.append(Paragraph("Visi &amp; Misi", h2))
        if vision.get("visi"):
            story.append(Paragraph(f"<b>Visi:</b> {vision['visi']}", body_j))
        if vision.get("misi"):
            items = "<br/>".join(f"{i+1}. {m}" for i, m in enumerate(vision.get("misi") or []))
            story.append(Paragraph(f"<b>Misi:</b><br/>{items}", body_j))
        if vision.get("nilai"):
            story.append(Paragraph(f"<b>Nilai:</b> {', '.join(vision.get('nilai') or [])}", body))

    # ---------- BSC ----------
    bsc_goals = data.get("bsc_goals") or []
    if bsc_goals:
        story.append(Paragraph("Balanced Scorecard (BSC)", h2))
        rows = [[Paragraph("<b>Aspek</b>", cell_w), Paragraph("<b>Sasaran / Indikator</b>", cell_w),
                 Paragraph("<b>Target</b>", cell_w), Paragraph("<b>Realisasi</b>", cell_w)]]
        for g in bsc_goals:
            aspek = ASPEK_LABEL.get(g.get("aspek"), g.get("aspek", "-"))
            inds = [x for x in (g.get("indikators") or []) if (x.get("nama") or x.get("target") or x.get("realisasi"))]
            rows.append([Paragraph(f"<b>{aspek}</b>", cell), Paragraph(f"<b>{g.get('judul','-')}</b>", cell), "", ""])
            for ind in inds:
                rows.append(["", Paragraph(f"• {ind.get('nama') or '(indikator)'}", cell),
                             Paragraph(ind.get("target") or "-", cell), Paragraph(ind.get("realisasi") or "-", cell)])
        t = Table(rows, colWidths=[3.2 * cm, CONTENT_W - 3.2 * cm - 5.2 * cm, 2.6 * cm, 2.6 * cm], repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), EMERALD_DARK),
            ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("ALIGN", (2, 0), (-1, -1), "CENTER"),
        ]))
        story.append(t)

    # ---------- OKR ----------
    okr_list = data.get("okr_list") or []
    if okr_list:
        story.append(Paragraph("Objectives &amp; Key Results (OKR)", h2))
        rows = [[Paragraph("<b>Objective</b>", cell_w), Paragraph("<b>Owner</b>", cell_w),
                 Paragraph("<b>Divisi</b>", cell_w), Paragraph("<b>Capaian</b>", cell_w), Paragraph("<b>Status</b>", cell_w)]]
        style_cmds = [
            ("BACKGROUND", (0, 0), (-1, 0), EMERALD_DARK),
            ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("ALIGN", (3, 0), (-1, -1), "CENTER"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, EMERALD_TINT]),
        ]
        for i, o in enumerate(okr_list, 1):
            owner = o.get("owner_nama") or "-"
            if o.get("owner_jabatan"):
                owner = f"{owner}<br/><font size=7 color='#64748B'>{o['owner_jabatan']}</font>"
            st = o.get("status")
            rows.append([Paragraph(o.get("objective", "-"), cell), Paragraph(owner, cell),
                         Paragraph(o.get("divisi_nama") or "-", cell), Paragraph(f"<b>{o.get('progress',0)}%</b>", cell),
                         Paragraph(f"<b>{STATUS_LABEL.get(st,'-')}</b>", cell)])
            style_cmds.append(("TEXTCOLOR", (4, i), (4, i), STATUS_COLOR.get(st, MUTED)))
        t = Table(rows, colWidths=[CONTENT_W - 3.2 * cm - 2.6 * cm - 2 * cm - 3 * cm, 3.2 * cm, 2.6 * cm, 2 * cm, 3 * cm], repeatRows=1)
        t.setStyle(TableStyle(style_cmds))
        story.append(t)

    # ---------- OKR per Divisi ----------
    okr_div = data.get("okr_by_divisi") or []
    if okr_div:
        story.append(Paragraph("Capaian OKR per Divisi", h2))
        rows = [[Paragraph("<b>Divisi</b>", cell_w), Paragraph("<b>Jml OKR</b>", cell_w),
                 Paragraph("<b>Rata-rata</b>", cell_w), Paragraph("<b>Status</b>", cell_w)]]
        style_cmds = [
            ("BACKGROUND", (0, 0), (-1, 0), EMERALD_DARK),
            ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ]
        for i, d in enumerate(okr_div, 1):
            st = d.get("label")
            rows.append([Paragraph(d.get("nama", "-"), cell), Paragraph(str(d.get("count", 0)), cell),
                         Paragraph(f"<b>{d.get('avg',0)}%</b>", cell), Paragraph(f"<b>{STATUS_LABEL.get(st,'-')}</b>", cell)])
            style_cmds.append(("TEXTCOLOR", (3, i), (3, i), STATUS_COLOR.get(st, MUTED)))
        t = Table(rows, colWidths=[CONTENT_W - 3 * cm - 3 * cm - 3.5 * cm, 3 * cm, 3 * cm, 3.5 * cm], repeatRows=1)
        t.setStyle(TableStyle(style_cmds))
        story.append(t)

    # ---------- ACTION PLAN ----------
    projects = data.get("projects") or []
    if projects:
        story.append(Paragraph("Action Plan (Proyek Strategis)", h2))
        rows = [[Paragraph("<b>Proyek</b>", cell_w), Paragraph("<b>Divisi</b>", cell_w),
                 Paragraph("<b>Task</b>", cell_w), Paragraph("<b>Progres</b>", cell_w), Paragraph("<b>Status</b>", cell_w)]]
        for p in projects:
            rows.append([Paragraph(p.get("nama", "-"), cell), Paragraph(p.get("divisi_nama") or "-", cell),
                         Paragraph(f"{p.get('selesai',0)}/{p.get('total',0)}", cell), Paragraph(f"<b>{p.get('pct',0)}%</b>", cell),
                         Paragraph(p.get("status", "-"), cell)])
        t = Table(rows, colWidths=[CONTENT_W - 3 * cm - 2 * cm - 2.4 * cm - 3 * cm, 3 * cm, 2 * cm, 2.4 * cm, 3 * cm], repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), EMERALD_DARK),
            ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("ALIGN", (2, 0), (-1, -1), "CENTER"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, EMERALD_TINT]),
        ]))
        story.append(t)

    # ---------- KPI RANKING ----------
    kpi_rank = data.get("kpi_ranking") or []
    if kpi_rank:
        story.append(Paragraph("Peringkat KPI Individu", h2))
        rows = [[Paragraph("<b>#</b>", cell_w), Paragraph("<b>Anggota</b>", cell_w),
                 Paragraph("<b>Divisi</b>", cell_w), Paragraph("<b>Bobot</b>", cell_w), Paragraph("<b>Skor</b>", cell_w)]]
        for i, r in enumerate(kpi_rank, 1):
            rows.append([Paragraph(str(i), cell), Paragraph(r.get("anggota_nama", "-"), cell),
                         Paragraph(r.get("divisi_nama", "-"), cell), Paragraph(f"{round(r.get('bobot',0),1)}%", cell),
                         Paragraph(f"<b>{round(r.get('score',0),1)}%</b>", cell)])
        t = Table(rows, colWidths=[1 * cm, CONTENT_W - 1 * cm - 3.5 * cm - 2.5 * cm - 2.5 * cm, 3.5 * cm, 2.5 * cm, 2.5 * cm], repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), EMERALD_DARK),
            ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("ALIGN", (0, 0), (0, -1), "CENTER"), ("ALIGN", (3, 0), (-1, -1), "CENTER"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, EMERALD_TINT]),
        ]))
        story.append(t)

    # ---------- CATATAN SPV ----------
    note = data.get("note") or {}
    kesimpulan = note.get("kesimpulan") or "NETRAL"
    if note.get("summary") or note.get("highlights") or note.get("improvements") or note.get("next_focus"):
        story.append(Paragraph("Catatan &amp; Kesimpulan SPV", h2))
        story.append(Paragraph(f"<b>Kesimpulan:</b> {kesimpulan}", body))
        if note.get("summary"):
            story.append(Paragraph(note["summary"], body_j))
        for title, key in [("Highlights", "highlights"), ("Perbaikan", "improvements"), ("Fokus Berikutnya", "next_focus")]:
            arr = note.get(key) or []
            if arr:
                items = "<br/>".join(f"• {x}" for x in arr)
                story.append(Paragraph(f"<b>{title}:</b><br/>{items}", body))

    # ---------- SIGN ----------
    story.append(Spacer(1, 20))
    tanggal = datetime.now().strftime("%d %B %Y")
    story.append(Paragraph(f"<font color='#64748B'>Dicetak pada: <b>{tanggal}</b></font>", small))
    story.append(Spacer(1, 10))
    spv_sign = Table(
        [[Paragraph("Mengetahui,", small), Paragraph("Dibuat oleh,", small)],
         [Paragraph("&nbsp;<br/>&nbsp;<br/>_____________________", subj),
          Paragraph("&nbsp;<br/>&nbsp;<br/>_____________________", subj)],
         [Paragraph("<b>Pimpinan / Koordinator</b>", subj), Paragraph("<b>SPV Strategi</b>", subj)]],
        colWidths=[(CONTENT_W - 1 * cm) / 2, (CONTENT_W - 1 * cm) / 2],
    )
    spv_sign.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(spv_sign)

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    buf.seek(0)
    return buf.getvalue()


def _stat_cell(label, value, sub, color):
    styles = getSampleStyleSheet()
    lbl = ParagraphStyle("sl", parent=styles["BodyText"], fontSize=7, textColor=MUTED, leading=9, alignment=TA_CENTER)
    val = ParagraphStyle("sv", parent=styles["BodyText"], fontSize=17, textColor=color, leading=19, alignment=TA_CENTER, fontName="Helvetica-Bold")
    sb = ParagraphStyle("ss", parent=styles["BodyText"], fontSize=7, textColor=INK, leading=9, alignment=TA_CENTER)
    inner = Table(
        [[Paragraph(label.upper(), lbl)], [Paragraph(value, val)], [Paragraph(sub, sb)]],
        colWidths=[CONTENT_W / 4 - 6],
    )
    inner.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER), ("BACKGROUND", (0, 0), (-1, -1), EMERALD_TINT),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    return inner
