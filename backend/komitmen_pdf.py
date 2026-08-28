"""Surat Kesepakatan Target PDF — commitment letter for a division team per period."""
import io
import os
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfgen import canvas


EMERALD_DARK = colors.HexColor("#0F4F47")
EMERALD_MED = colors.HexColor("#0EA372")
EMERALD_TINT = colors.HexColor("#F1FAF5")
GOLD = colors.HexColor("#C8A24C")
INK = colors.HexColor("#0F172A")
MUTED = colors.HexColor("#64748B")
BORDER = colors.HexColor("#DDE7E4")

LOGO_PATH = os.path.join(os.path.dirname(__file__), "assets", "ruang_sanad_logo.png")
PAGE_W, PAGE_H = A4
CONTENT_W = PAGE_W - 3.6 * cm


def _footer(canvas_obj: canvas.Canvas, doc):
    canvas_obj.saveState()
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(MUTED)
    canvas_obj.drawString(1.8 * cm, 1 * cm, "Workspace Ruang Sanad · Surat Kesepakatan Target")
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


def build_komitmen_pdf(
    period: dict,
    divisi: dict,
    vision: dict,
    bsc_items: list,
    okr_items: list,
    kpi_items: list,
    members: list,
) -> bytes:
    """Generate a commitment letter PDF for one division for one period.

    Args:
        period: {nama, start, end, siklus_bulan}
        divisi: {nama, warna}
        vision: {visi, misi[], nilai[]}
        bsc_items: BSC target rows (nama, target, aspek)
        okr_items: OKR objectives for this division (objective + key_results)
        kpi_items: KPI items for members of this division
        members: [{nama, ...}] anggota of this division
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=1.4 * cm, bottomMargin=2 * cm,
        leftMargin=1.8 * cm, rightMargin=1.8 * cm,
        title=f"Surat Kesepakatan Target — {divisi.get('nama')} — {period.get('nama')}",
        author="Workspace Ruang Sanad",
    )
    styles = getSampleStyleSheet()
    body = ParagraphStyle("body", parent=styles["BodyText"], fontSize=10, leading=14, textColor=INK)
    small = ParagraphStyle("small", parent=styles["BodyText"], fontSize=9, textColor=MUTED, leading=12)
    small_r = ParagraphStyle("small_r", parent=small, alignment=TA_RIGHT)
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], textColor=EMERALD_DARK, fontSize=18, alignment=TA_CENTER, spaceAfter=2)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=EMERALD_DARK, fontSize=12, spaceAfter=4, spaceBefore=6)
    subj = ParagraphStyle("subj", parent=small, alignment=TA_CENTER, textColor=INK, spaceAfter=4)
    body_j = ParagraphStyle("body_j", parent=body, alignment=TA_JUSTIFY)
    brand_name = ParagraphStyle("bn", parent=body, textColor=EMERALD_DARK, fontSize=14, leading=17, fontName="Helvetica-Bold")
    brand_sub = ParagraphStyle("bs", parent=small, textColor=GOLD, fontSize=8, leading=11)
    label_kv = ParagraphStyle("lkv", parent=small, fontSize=8, leading=11, alignment=TA_RIGHT)
    value_kv = ParagraphStyle("vkv", parent=small_r, textColor=INK, fontSize=10, leading=13, fontName="Helvetica-Bold")
    sign_lbl = ParagraphStyle("sil", parent=small, fontSize=9, leading=12, textColor=INK, fontName="Helvetica-Bold", alignment=TA_CENTER)

    story = []

    # ============ HEADER ============
    logo = _get_logo(height=16 * mm)
    period_cell = Table(
        [
            [Paragraph("PERIODE", label_kv)],
            [Paragraph(f"{period.get('nama')}", value_kv)],
            [Paragraph(f"{period.get('start')} — {period.get('end')}", small_r)],
        ],
        colWidths=[5.6 * cm],
    )
    period_cell.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("BOX", (0, 0), (-1, -1), 0.4, BORDER),
        ("BACKGROUND", (0, 0), (-1, -1), EMERALD_TINT),
    ]))
    header = Table(
        [[logo if logo else Paragraph("<b>Sanad</b>", brand_name),
          [Paragraph("Workspace <font color='#C8A24C'>Ruang Sanad</font>", brand_name),
           Paragraph("Surat Kesepakatan Target", brand_sub)],
          period_cell]],
        colWidths=[2.4 * cm, 8.4 * cm, 5.8 * cm],
    )
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    story.append(header)
    story.append(Spacer(1, 4))
    # Gold divider
    hr = Table([[""]], colWidths=[CONTENT_W], rowHeights=[2])
    hr.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), GOLD)]))
    story.append(hr)
    story.append(Spacer(1, 14))

    # ============ TITLE ============
    story.append(Paragraph("SURAT KESEPAKATAN TARGET", h1))
    story.append(Paragraph(f"Divisi <b>{divisi.get('nama')}</b> · Periode <b>{period.get('nama')}</b>", subj))
    story.append(Spacer(1, 12))

    # ============ PREAMBLE ============
    story.append(Paragraph(
        f"Kami, tim <b>{divisi.get('nama')}</b> di Workspace Ruang Sanad, dengan penuh kesadaran dan komitmen, "
        f"menyepakati untuk menjalankan target strategi berikut selama periode <b>{period.get('nama')} "
        f"({period.get('start')} — {period.get('end')})</b>. Kesepakatan ini menjadi acuan kerja bersama, "
        f"pengukuran capaian, serta bahan evaluasi berkala.",
        body_j,
    ))
    story.append(Spacer(1, 12))

    # ============ VISI MISI ============
    if vision and (vision.get("visi") or vision.get("misi")):
        story.append(Paragraph("Visi &amp; Misi", h2))
        if vision.get("visi"):
            story.append(Paragraph(f"<b>Visi:</b> {vision['visi']}", body_j))
        if vision.get("misi"):
            items = [f"{i+1}. {m}" for i, m in enumerate(vision["misi"] or [])]
            story.append(Paragraph("<b>Misi:</b><br/>" + "<br/>".join(items), body_j))
        if vision.get("nilai"):
            story.append(Paragraph(f"<b>Nilai:</b> {', '.join(vision['nilai'])}", body))
        story.append(Spacer(1, 10))

    # ============ BSC TARGETS ============
    if bsc_items:
        story.append(Paragraph("Target Strategis (Balanced Scorecard)", h2))
        rows = [["No", "Aspek", "Nama Target", "Target"]]
        aspek_label = {"FINANCIAL": "Financial", "CUSTOMER": "Customer", "INTERNAL": "Internal", "LEARNING": "Learning"}
        for i, b in enumerate(bsc_items, 1):
            rows.append([str(i), aspek_label.get(b.get("aspek"), b.get("aspek", "-")),
                         Paragraph(b.get("nama", "-"), body), b.get("target") or "-"])
        tbl = Table(rows, colWidths=[0.9 * cm, 2.6 * cm, CONTENT_W - 0.9 * cm - 2.6 * cm - 3 * cm, 3 * cm], repeatRows=1)
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), EMERALD_DARK),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, EMERALD_TINT]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ]))
        story.append(tbl)
        story.append(Spacer(1, 12))

    # ============ OKR ============
    if okr_items:
        story.append(Paragraph("Objectives &amp; Key Results (OKR)", h2))
        for i, o in enumerate(okr_items, 1):
            title = f"<b>Objective {i}:</b> {o.get('objective')}"
            owner_txt = f"Owner: <b>{(o.get('owner') or {}).get('nama', '-')}</b>" if o.get("owner") else "Owner: -"
            supporters = ", ".join([s.get("nama") for s in (o.get("supporters") or [])]) or "-"
            story.append(Paragraph(title, body))
            story.append(Paragraph(f"<font size=9 color='#64748B'>{owner_txt} · Supporters: {supporters}</font>", small))
            krs = o.get("key_results") or []
            if krs:
                rows = [["#", "Key Result", "Target", "Aktual"]]
                for j, kr in enumerate(krs, 1):
                    rows.append([str(j), Paragraph(kr.get("nama", "-"), body), kr.get("target") or "-", kr.get("actual") or "-"])
                t = Table(rows, colWidths=[0.9 * cm, CONTENT_W - 0.9 * cm - 3 * cm - 3 * cm, 3 * cm, 3 * cm], repeatRows=1)
                t.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), EMERALD_TINT),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("ALIGN", (0, 0), (0, -1), "CENTER"),
                    ("ALIGN", (2, 0), (-1, -1), "CENTER"),
                ]))
                story.append(t)
            story.append(Spacer(1, 8))

    # ============ KPI ============
    if kpi_items:
        story.append(Paragraph("Indikator Kinerja Individu (KPI)", h2))
        rows = [["#", "Anggota", "Indikator KPI", "Bobot", "Target"]]
        for i, k in enumerate(kpi_items, 1):
            rows.append([str(i), k.get("anggota_nama", "-"),
                         Paragraph(k.get("indikator", "-"), body),
                         f"{k.get('bobot', 0)}%", str(k.get("target", "-"))])
        t = Table(rows, colWidths=[0.9 * cm, 3.5 * cm, CONTENT_W - 0.9 * cm - 3.5 * cm - 4 * cm, 2 * cm, 2 * cm], repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), EMERALD_DARK),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, EMERALD_TINT]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (3, 0), (-1, -1), "CENTER"),
        ]))
        story.append(t)
        story.append(Spacer(1, 12))

    # ============ COMMITMENT STATEMENT ============
    story.append(Paragraph("Pernyataan Komitmen", h2))
    story.append(Paragraph(
        "Dengan menandatangani surat kesepakatan ini, kami menyatakan bahwa:",
        body_j,
    ))
    story.append(Paragraph(
        "1. Kami memahami target strategis dan KPI yang telah disepakati bersama.<br/>"
        "2. Kami berkomitmen mengeksekusi tugas dan mencapai target sesuai timeline periode.<br/>"
        "3. Kami akan memberikan laporan progres secara berkala kepada SPV.<br/>"
        "4. Kami siap dievaluasi berdasarkan capaian yang telah disepakati.",
        body_j,
    ))
    story.append(Spacer(1, 16))

    # ============ SIGNATURES ============
    story.append(Paragraph("Tanda Tangan Anggota Tim", h2))
    tanggal = datetime.now().strftime("%d %B %Y")
    story.append(Paragraph(f"<font color='#64748B'>Ditandatangani pada: <b>{tanggal}</b></font>", small))
    story.append(Spacer(1, 10))

    # signature grid, 2 columns
    sign_cells = []
    row_cells = []
    for i, m in enumerate(members or []):
        cell = Table(
            [
                [Paragraph("&nbsp;", body)],  # blank signature space
                [Paragraph("____________________", sign_lbl)],
                [Paragraph(f"<b>{m.get('nama', '-')}</b>", sign_lbl)],
                [Paragraph(f"{m.get('jabatan', '') or 'Anggota Tim'}", small)],
            ],
            colWidths=[(CONTENT_W - 0.5 * cm) / 2],
            rowHeights=[26, 10, 12, 10],
        )
        cell.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("BOX", (0, 0), (-1, -1), 0.4, BORDER),
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ]))
        row_cells.append(cell)
        if len(row_cells) == 2:
            sign_cells.append(row_cells)
            row_cells = []
    if row_cells:
        row_cells.append(Paragraph("", body))
        sign_cells.append(row_cells)

    if sign_cells:
        sign_grid = Table(sign_cells, colWidths=[(CONTENT_W - 0.5 * cm) / 2, (CONTENT_W - 0.5 * cm) / 2])
        sign_grid.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(sign_grid)

    # SPV signature block
    story.append(Spacer(1, 18))
    spv_sign = Table(
        [
            [Paragraph("Mengetahui,", small), Paragraph("Menyetujui,", small)],
            [Paragraph("&nbsp;<br/>&nbsp;<br/>_____________________", sign_lbl),
             Paragraph("&nbsp;<br/>&nbsp;<br/>_____________________", sign_lbl)],
            [Paragraph("<b>SPV / Koordinator</b>", sign_lbl),
             Paragraph(f"<b>PIC {divisi.get('nama')}</b>", sign_lbl)],
        ],
        colWidths=[(CONTENT_W - 1 * cm) / 2, (CONTENT_W - 1 * cm) / 2],
    )
    spv_sign.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(spv_sign)

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    buf.seek(0)
    return buf.getvalue()
