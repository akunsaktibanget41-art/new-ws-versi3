"""Raport PDF for Workspace Ruang Sanad — cleaner grid, embedded logo, no overlap."""
import io
import os
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas


# =============================
# Brand palette (aligned with logo)
# =============================
EMERALD_DARK = colors.HexColor("#0F4F47")     # deep teal used in logo text
EMERALD = colors.HexColor("#12766B")
EMERALD_MED = colors.HexColor("#0EA372")
EMERALD_LIGHT = colors.HexColor("#DDF3E9")
EMERALD_TINT = colors.HexColor("#F1FAF5")
GOLD = colors.HexColor("#C8A24C")             # accent gold from logo calligraphy
INK = colors.HexColor("#0F172A")
MUTED = colors.HexColor("#64748B")
BORDER = colors.HexColor("#DDE7E4")
DANGER = colors.HexColor("#B91C1C")

LOGO_PATH = os.path.join(os.path.dirname(__file__), "assets", "ruang_sanad_logo.png")

PAGE_W, PAGE_H = A4
CONTENT_W = PAGE_W - 3.6 * cm  # 1.8 cm each side


def _footer(canvas_obj: canvas.Canvas, doc):
    canvas_obj.saveState()
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(MUTED)
    canvas_obj.drawString(1.8 * cm, 1 * cm, "Workspace Ruang Sanad · Amal • Kerja • Raport")
    canvas_obj.drawRightString(PAGE_W - 1.8 * cm, 1 * cm, f"Halaman {doc.page}")
    canvas_obj.setStrokeColor(BORDER)
    canvas_obj.line(1.8 * cm, 1.35 * cm, PAGE_W - 1.8 * cm, 1.35 * cm)
    canvas_obj.restoreState()


def _get_logo(height=16 * mm):
    if os.path.exists(LOGO_PATH):
        try:
            img = Image(LOGO_PATH)
            # scale to given height while preserving aspect
            iw, ih = img.wrap(0, 0)
            ratio = iw / max(ih, 1)
            img.drawHeight = height
            img.drawWidth = height * ratio
            return img
        except Exception:
            pass
    return None


def _paragraph_styles():
    styles = getSampleStyleSheet()
    P = {}
    P["h1"] = ParagraphStyle("h1", parent=styles["Heading1"], textColor=EMERALD_DARK, fontSize=20, spaceAfter=2, alignment=TA_LEFT, leading=24)
    P["h2"] = ParagraphStyle("h2", parent=styles["Heading2"], textColor=EMERALD_DARK, fontSize=12, spaceAfter=4, spaceBefore=0, leading=15)
    P["body"] = ParagraphStyle("body", parent=styles["BodyText"], fontSize=10, leading=13, textColor=INK, spaceAfter=0)
    P["body_r"] = ParagraphStyle("body_r", parent=P["body"], alignment=TA_RIGHT)
    P["body_c"] = ParagraphStyle("body_c", parent=P["body"], alignment=TA_CENTER)
    P["small"] = ParagraphStyle("small", parent=styles["BodyText"], fontSize=9, textColor=MUTED, leading=12, spaceAfter=0)
    P["small_r"] = ParagraphStyle("small_r", parent=P["small"], alignment=TA_RIGHT)
    P["brand_name"] = ParagraphStyle("bn", parent=P["body"], textColor=EMERALD_DARK, fontSize=14, leading=17, fontName="Helvetica-Bold")
    P["brand_sub"] = ParagraphStyle("bs", parent=P["small"], textColor=GOLD, fontSize=8, leading=11)
    P["label_kv"] = ParagraphStyle("lkv", parent=P["small"], textColor=MUTED, fontSize=8, leading=11, alignment=TA_RIGHT)
    P["value_kv"] = ParagraphStyle("vkv", parent=P["body_r"], textColor=INK, fontSize=10, leading=13, fontName="Helvetica-Bold")
    P["metric_label"] = ParagraphStyle("ml", parent=P["small"], textColor=MUTED, fontSize=7, leading=9, alignment=TA_CENTER, fontName="Helvetica-Bold")
    P["metric_val"] = ParagraphStyle("mv", parent=P["body_c"], textColor=INK, fontSize=18, leading=22, fontName="Helvetica-Bold")
    P["score_label"] = ParagraphStyle("sl", parent=P["small"], textColor=EMERALD, fontSize=9, leading=11, fontName="Helvetica-Bold")
    P["score_big"] = ParagraphStyle("sb", parent=P["body"], textColor=EMERALD_DARK, fontSize=48, leading=54, fontName="Helvetica-Bold", alignment=TA_LEFT, spaceAfter=0)
    P["score_slash"] = ParagraphStyle("ss", parent=P["body"], textColor=EMERALD_MED, fontSize=14, leading=54, alignment=TA_LEFT)
    P["rek_label"] = ParagraphStyle("rl", parent=P["small"], textColor=MUTED, fontSize=8, leading=10, fontName="Helvetica-Bold", alignment=TA_LEFT)
    P["rek_big"] = ParagraphStyle("rb", parent=P["body"], fontSize=22, leading=28, fontName="Helvetica-Bold", alignment=TA_LEFT, spaceAfter=0)
    P["subj"] = ParagraphStyle("subj", parent=P["small"], textColor=MUTED, fontSize=10, leading=13)
    P["note_head"] = ParagraphStyle("nh", parent=P["body"], fontSize=10, leading=13, fontName="Helvetica-Bold", textColor=EMERALD_DARK)
    P["note_body"] = ParagraphStyle("nb", parent=P["body"], fontSize=10, leading=14, textColor=INK)
    P["sign_lbl"] = ParagraphStyle("sil", parent=P["small"], fontSize=9, leading=12, textColor=INK, fontName="Helvetica-Bold", alignment=TA_CENTER)
    return P


def _progress_bar(pct, color=EMERALD_MED, width_cm=None):
    """Returns a Table row simulating a progress bar."""
    width_cm = width_cm or (CONTENT_W / cm)
    pct = max(0, min(100, float(pct or 0)))
    fill_w = max(0.02, width_cm * pct / 100.0)
    empty_w = max(0.01, width_cm - fill_w)
    if empty_w < 0.02:
        # Single fill cell
        t = Table([[""]], colWidths=[width_cm * cm], rowHeights=[7])
        t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), color), ("BOX", (0, 0), (-1, -1), 0, color)]))
        return t
    t = Table([["", ""]], colWidths=[fill_w * cm, empty_w * cm], rowHeights=[7])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), color),
        ("BACKGROUND", (1, 0), (1, 0), EMERALD_LIGHT),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return t


def build_raport_pdf(
    summary: dict,
    start: str,
    end: str,
    subject: str = "Raport Kinerja Tim",
    anggota_nama: str | None = None,
    divisi_nama: str | None = None,
) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        topMargin=1.4 * cm,
        bottomMargin=2 * cm,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        title=f"Workspace Ruang Sanad · {subject}",
        author="Workspace Ruang Sanad",
    )
    P = _paragraph_styles()
    story = []

    # ================================================================
    # 1) HEADER — logo | brand | period box (right)
    # ================================================================
    logo = _get_logo(height=18 * mm)
    logo_cell = logo if logo is not None else Paragraph("<b>Ruang Sanad</b>", P["brand_name"])

    brand_cell = [
        Paragraph("Workspace <font color='#C8A24C'>Ruang Sanad</font>", P["brand_name"]),
        Paragraph("Amal • Kerja • Raport", P["brand_sub"]),
    ]

    period_cell = Table(
        [
            [Paragraph("PERIODE", P["label_kv"])],
            [Paragraph(f"{start} — {end}", P["value_kv"])],
            [Paragraph(f"Dicetak: {datetime.now().strftime('%d %b %Y, %H:%M')}", P["label_kv"])],
        ],
        colWidths=[5.6 * cm],
    )
    period_cell.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("BOX", (0, 0), (-1, -1), 0.4, BORDER),
        ("BACKGROUND", (0, 0), (-1, -1), EMERALD_TINT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))

    header = Table(
        [[logo_cell, brand_cell, period_cell]],
        colWidths=[2.4 * cm, 8.4 * cm, 5.8 * cm],
    )
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (0, 0), "LEFT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(header)

    # Divider
    hr = Table([[""]], colWidths=[CONTENT_W], rowHeights=[2])
    hr.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), GOLD), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    story.append(Spacer(1, 6))
    story.append(hr)
    story.append(Spacer(1, 14))

    # ================================================================
    # 2) TITLE + META LINE
    # ================================================================
    story.append(Paragraph(subject, P["h1"]))
    meta_parts = []
    if anggota_nama:
        meta_parts.append(f"Anggota: <b>{anggota_nama}</b>")
        if divisi_nama:
            meta_parts.append(f"Divisi: <b>{divisi_nama}</b>")
    meta_parts.append(f"Rentang: <b>{start}</b> s/d <b>{end}</b>")
    story.append(Paragraph(" &nbsp;&nbsp;·&nbsp;&nbsp; ".join(meta_parts), P["subj"]))
    story.append(Spacer(1, 14))

    # ================================================================
    # 3) SCORE HERO — 2 columns, each with STACKED rows (no inline size mix)
    # ================================================================
    combined = summary.get("combined_score", 0)
    auto = summary.get("auto_rekomendasi", "NETRAL")
    rek_color = {"REWARD": EMERALD_MED, "EVALUASI": DANGER, "NETRAL": MUTED}[auto]
    rek_bg = {"REWARD": EMERALD_LIGHT, "EVALUASI": colors.HexColor("#FEE2E2"), "NETRAL": colors.HexColor("#F1F5F9")}[auto]

    # LEFT: score
    score_left = Table(
        [
            [Paragraph("SKOR GABUNGAN", P["score_label"])],
            [Table(
                [[
                    Paragraph(f"{combined}", P["score_big"]),
                    Paragraph("/100", P["score_slash"]),
                ]],
                colWidths=[4.8 * cm, 2.0 * cm],
            )],
            [Paragraph("60% Tugas + 40% Amaliyah", P["small"])],
        ],
        colWidths=[7 * cm],
    )
    score_left.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    # Kill inner padding on inner table too
    inner_left = score_left._cellvalues[1][0]
    inner_left.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
    ]))

    # RIGHT: recommendation
    rek_style = ParagraphStyle("rek_big_c", parent=P["rek_big"], textColor=rek_color)
    score_right = Table(
        [
            [Paragraph("REKOMENDASI OTOMATIS", P["rek_label"])],
            [Paragraph(auto, rek_style)],
            [Paragraph({
                "REWARD": "Kinerja di atas 80% — layak apresiasi.",
                "EVALUASI": "Kinerja di bawah 50% — perlu evaluasi.",
                "NETRAL": "Kinerja di antara 50–80% — lanjut monitoring.",
            }[auto], P["small"])],
        ],
        colWidths=[6.6 * cm],
    )
    score_right.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    hero = Table(
        [[score_left, score_right]],
        colWidths=[9.2 * cm, 7.4 * cm],
    )
    hero.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("LINEBEFORE", (1, 0), (1, 0), 0.5, BORDER),
        ("BACKGROUND", (0, 0), (0, 0), EMERALD_TINT),
        ("BACKGROUND", (1, 0), (1, 0), rek_bg),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 16),
        ("RIGHTPADDING", (0, 0), (-1, -1), 16),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
    ]))
    story.append(hero)
    story.append(Spacer(1, 18))

    # ================================================================
    # 4) TASK BREAKDOWN — 6 metric cells uniform, then progress bar
    # ================================================================
    t = summary.get("task", {}) or {}
    story.append(Paragraph("Ringkasan Tugas", P["h2"]))

    def _metric_cell(label, val, val_color=INK):
        val_style = ParagraphStyle(f"mv_{label}", parent=P["metric_val"], textColor=val_color)
        return Table(
            [
                [Paragraph(str(val), val_style)],
                [Paragraph(label, P["metric_label"])],
            ],
            rowHeights=[26, 12],
        )

    metrics = Table(
        [[
            _metric_cell("TOTAL", t.get("total", 0)),
            _metric_cell("SELESAI", t.get("selesai", 0), EMERALD_MED),
            _metric_cell("PROSES", t.get("dalam_proses", 0), colors.HexColor("#B45309")),
            _metric_cell("BELUM", t.get("belum_mulai", 0), MUTED),
            _metric_cell("KENDALA", t.get("terkendala", 0), DANGER),
            _metric_cell("OVERDUE", t.get("overdue", 0), DANGER),
        ]],
        colWidths=[CONTENT_W / 6.0] * 6,
        rowHeights=[52],
    )
    metrics.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.4, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
    ]))
    story.append(metrics)
    story.append(Spacer(1, 8))

    # Progress row: label + bar + %
    tscore = t.get("score", 0)
    tp_lbl = Table(
        [[
            Paragraph("Skor Tugas", P["note_head"]),
            Paragraph(f"<b>{tscore}%</b>", P["value_kv"]),
        ]],
        colWidths=[CONTENT_W - 3 * cm, 3 * cm],
    )
    tp_lbl.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
    ]))
    story.append(tp_lbl)
    story.append(_progress_bar(tscore, EMERALD_MED))
    story.append(Spacer(1, 18))

    # ================================================================
    # 5) AMALIYAH — 5 uniform metric cells
    # ================================================================
    a = summary.get("amaliyah", {}) or {}
    story.append(Paragraph("Ringkasan Amaliyah", P["h2"]))
    amal_metrics = Table(
        [[
            _metric_cell("CHECK-IN", a.get("total_entries", 0), EMERALD_MED),
            _metric_cell("TARGET", a.get("target", 0)),
            _metric_cell("AMALIYAH", a.get("items_count", 0)),
            _metric_cell("HARI", a.get("days", 0)),
            _metric_cell("SKOR", f"{a.get('score', 0)}%", EMERALD_DARK),
        ]],
        colWidths=[CONTENT_W / 5.0] * 5,
        rowHeights=[52],
    )
    amal_metrics.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.4, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
    ]))
    story.append(amal_metrics)
    story.append(Spacer(1, 8))

    ascore = a.get("score", 0)
    ap_lbl = Table(
        [[
            Paragraph("Skor Amaliyah", P["note_head"]),
            Paragraph(f"<b>{ascore}%</b>", P["value_kv"]),
        ]],
        colWidths=[CONTENT_W - 3 * cm, 3 * cm],
    )
    ap_lbl.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
    ]))
    story.append(ap_lbl)
    story.append(_progress_bar(ascore, EMERALD))
    story.append(Spacer(1, 18))

    # ================================================================
    # 6) TASK LIST (per-anggota)
    # ================================================================
    tasks_list = summary.get("tasks_list") or []
    if tasks_list:
        story.append(Paragraph(f"Daftar Tugas ({len(tasks_list)})", P["h2"]))
        rows = [[
            Paragraph("<b>No</b>", ParagraphStyle("th_c", parent=P["body_c"], textColor=colors.white, fontName="Helvetica-Bold")),
            Paragraph("<b>Nama Tugas</b>", ParagraphStyle("th_l", parent=P["body"], textColor=colors.white, fontName="Helvetica-Bold")),
            Paragraph("<b>Status</b>", ParagraphStyle("th_c2", parent=P["body_c"], textColor=colors.white, fontName="Helvetica-Bold")),
            Paragraph("<b>Deadline</b>", ParagraphStyle("th_c3", parent=P["body_c"], textColor=colors.white, fontName="Helvetica-Bold")),
        ]]
        for i, tk in enumerate(tasks_list[:60], 1):
            status_txt = (tk.get("status") or "-").replace("_", " ").title()
            rows.append([
                Paragraph(str(i), P["body_c"]),
                Paragraph((tk.get("nama") or "-")[:90], P["body"]),
                Paragraph(status_txt, P["body_c"]),
                Paragraph(tk.get("deadline") or "-", P["body_c"]),
            ])
        col_no = 0.9 * cm
        col_dl = 2.4 * cm
        col_st = 2.7 * cm
        col_nm = CONTENT_W - col_no - col_dl - col_st
        tbl = Table(rows, colWidths=[col_no, col_nm, col_st, col_dl], repeatRows=1)
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), EMERALD_DARK),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, EMERALD_TINT]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(tbl)
        story.append(Spacer(1, 16))

    # ================================================================
    # 7) SPV NOTE
    # ================================================================
    note = summary.get("spv_note", {}) or {}
    story.append(Paragraph("Catatan &amp; Keputusan SPV", P["h2"]))
    keputusan = note.get("rekomendasi", "NETRAL")
    catatan = (note.get("catatan_spv") or "").strip() or "<i>Belum ada catatan dari SPV.</i>"
    kep_color = rek_color.hexval()
    note_head_tbl = Table(
        [[
            Paragraph(f"Keputusan SPV: <font color='{kep_color}'><b>{keputusan}</b></font>", P["note_head"]),
            Paragraph(f"Update: {note.get('updated_at', '-')[:10] if note.get('updated_at') else '-'}", P["small_r"]),
        ]],
        colWidths=[CONTENT_W - 4 * cm, 4 * cm],
    )
    note_head_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), EMERALD_TINT),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    note_body_tbl = Table(
        [[Paragraph(catatan.replace("\n", "<br/>"), P["note_body"])]],
        colWidths=[CONTENT_W],
    )
    note_body_tbl.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("LINEABOVE", (0, 0), (-1, 0), 0, colors.white),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(note_head_tbl)
    story.append(note_body_tbl)
    story.append(Spacer(1, 22))

    # ================================================================
    # 8) SIGNATURE + FOOTER FLAVOR
    # ================================================================
    sign_line = Table(
        [
            [Paragraph("&nbsp;", P["body"])],  # empty space for signature
            [Paragraph("_____________________________", P["sign_lbl"])],
            [Paragraph("Ttd. SPV / Koordinator", P["sign_lbl"])],
        ],
        colWidths=[6 * cm],
        rowHeights=[24, 12, 12],
    )
    sign_line.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    left_col = Paragraph(
        "Dokumen ini dihasilkan otomatis oleh <b>Workspace Ruang Sanad</b>.<br/>"
        "<i>Fokus pada niat, ikhlaskan usaha. Raport hanyalah cermin, bukan hakim.</i>",
        P["small"],
    )
    sign_tbl = Table(
        [[left_col, sign_line]],
        colWidths=[CONTENT_W - 6 * cm - 0.5 * cm, 6 * cm],
    )
    sign_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(sign_tbl)

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    buf.seek(0)
    return buf.getvalue()
