"""Create the client report with the bundled Codex Python runtime.

Run only after the parent workflow records the artifact operation and supplies
fresh screenshots and final verification evidence. No application secret is read.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BLACK = "000000"
GRAY = "5B625A"
LINK = "244B3E"


def element(tag: str, **attrs):
    node = OxmlElement(tag)
    for key, value in attrs.items():
        node.set(qn(f"w:{key}"), str(value))
    return node


def set_font(run, size=None, bold=False, color=BLACK):
    run.font.name = "Arial"
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), "Arial")
    run._element.rPr.rFonts.set(qn("w:hAnsi"), "Arial")
    run.font.color.rgb = RGBColor.from_string(color)
    run.bold = bold
    if size is not None:
        run.font.size = Pt(size)


def paragraph(doc, text="", *, style=None, bold=False, size=None, color=BLACK):
    p = doc.add_paragraph(style=style)
    set_font(p.add_run(text), size, bold, color)
    return p


def hyperlink(p, text, target):
    rel = p.part.relate_to(
        target,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
        is_external=True,
    )
    link = OxmlElement("w:hyperlink")
    link.set(qn("r:id"), rel)
    run = OxmlElement("w:r")
    props = OxmlElement("w:rPr")
    props.append(element("w:color", val=LINK))
    props.append(element("w:u", val="single"))
    props.append(element("w:sz", val="19"))
    run.append(props)
    text_node = OxmlElement("w:t")
    text_node.text = text
    run.append(text_node)
    link.append(run)
    p._p.append(link)


def heading(doc, text, level=1):
    if not re.fullmatch(r"[A-Za-z0-9 ]+", text):
        raise ValueError(f"Headings must use words and numbers only: {text}")
    p = doc.add_paragraph(text, f"Heading {level}")
    for run in p.runs:
        set_font(run, bold=True)
    return p


def page(doc, title):
    doc.add_page_break()
    heading(doc, title)


def screenshot(doc, name, caption, *, mobile=False, max_height=4.4):
    path = ROOT / "docs" / "screenshots" / name
    if not path.is_file():
        raise FileNotFoundError(f"Fresh screenshot is required: {path}")
    with Image.open(path) as image:
        width, height = image.size
    max_width = 2.5 if mobile else 6.75
    scale = min(max_width / width, max_height / height)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(5)
    inline = p.add_run().add_picture(
        str(path), width=Inches(width * scale), height=Inches(height * scale)
    )
    inline._inline.docPr.set("descr", caption)
    p.paragraph_format.keep_with_next = True
    cap = paragraph(doc, caption, style="Caption", size=9.5, color=GRAY)
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_after = Pt(12)


def table(doc, headers, rows, widths, *, links=None):
    tab = doc.add_table(rows=1, cols=len(headers))
    tab.alignment = WD_TABLE_ALIGNMENT.CENTER
    tab.autofit = False
    for column, width in zip(tab.columns, widths):
        column.width = Inches(width)
    tbl_pr = tab._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        borders.append(element(f"w:{side}", val="single", sz="5", color="D9D9D9"))
    tbl_pr.append(borders)
    for i, row_values in enumerate([headers, *rows]):
        row = tab.rows[0] if i == 0 else tab.add_row()
        row._tr.get_or_add_trPr().append(element("w:cantSplit"))
        if i == 0:
            row._tr.trPr.append(element("w:tblHeader", val="true"))
        for j, (cell, value) in enumerate(zip(row.cells, row_values)):
            cell.width = Inches(widths[j])
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_pr.append(element("w:shd", fill="343A35" if i == 0 else "F4F5F2" if i % 2 == 0 else "FFFFFF"))
            margins = OxmlElement("w:tcMar")
            for side, width in (("top", 100), ("bottom", 100), ("left", 120), ("right", 120)):
                margins.append(element(f"w:{side}", w=width, type="dxa"))
            tc_pr.append(margins)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if len(headers) == 3 and j == 2 else WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.08
            if links and i > 0 and j == 0 and value in links:
                hyperlink(p, value, links[value])
            else:
                set_font(p.add_run(value), 9.5, i == 0, "FFFFFF" if i == 0 else BLACK)
    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(0)
    spacer.paragraph_format.space_before = Pt(0)
    spacer.paragraph_format.line_spacing = 0.3
    return tab


def bullet(doc, text):
    return paragraph(doc, text, style="List Bullet")


def load_sections():
    raw = (ROOT / "docs" / "report-content-v2.md").read_text(encoding="utf-8")
    parts = re.split(r"^## ", raw, flags=re.MULTILINE)
    return {
        part.split("\n", 1)[0].strip(): part.split("\n", 1)[1].strip()
        for part in parts[1:]
    }


def content_paragraphs(sections, title):
    text = sections[title]
    for block in re.split(r"\n\s*\n", text):
        if block.startswith(("Screenshot", "|", "Official pricing", "- [")):
            continue
        if "must be checked" in block or "to be confirmed" in block:
            continue
        yield re.sub(r"\s+", " ", block).strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(ROOT / "docs/deliverables/Food-Go-Development-Report.docx"))
    parser.add_argument("--evidence", required=True, help="JSON of actual final checks from the parent workflow")
    args = parser.parse_args()
    evidence = json.loads(Path(args.evidence).read_text(encoding="utf-8"))
    sections = load_sections()
    doc = Document()
    sec = doc.sections[0]
    sec.page_width = Inches(8.2677)
    sec.page_height = Inches(11.6929)
    sec.top_margin = Inches(0.62)
    sec.bottom_margin = Inches(0.62)
    sec.left_margin = Inches(0.72)
    sec.right_margin = Inches(0.72)
    sec.footer_distance = Inches(0.28)
    for name in ("Normal", "Title", "Subtitle", "Heading 1", "Heading 2", "Caption", "List Bullet"):
        style = doc.styles[name]
        style.font.name = "Arial"
        style.font.color.rgb = RGBColor.from_string(BLACK)
        style._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), "Arial")
        style._element.rPr.rFonts.set(qn("w:hAnsi"), "Arial")
        for border in list(style._element.xpath(".//w:pBdr")):
            border.getparent().remove(border)
    normal = doc.styles["Normal"]
    normal.font.size = Pt(10.5)
    normal.paragraph_format.line_spacing = 1.12
    normal.paragraph_format.space_after = Pt(7)
    normal.paragraph_format.widow_control = True
    doc.styles["Title"].font.size = Pt(28)
    doc.styles["Title"].paragraph_format.space_after = Pt(13)
    doc.styles["Heading 1"].font.size = Pt(18)
    doc.styles["Heading 1"].paragraph_format.space_after = Pt(12)
    doc.styles["Heading 1"].paragraph_format.space_before = Pt(0)
    doc.styles["Heading 2"].font.size = Pt(12)
    doc.styles["Heading 2"].paragraph_format.space_before = Pt(12)
    doc.styles["Heading 2"].paragraph_format.space_after = Pt(5)
    doc.styles["Caption"].font.size = Pt(9.5)
    doc.styles["Footer"].font.name = "Arial"
    doc.styles["Footer"].font.size = Pt(8)
    doc.styles["Footer"].font.color.rgb = RGBColor.from_string(GRAY)
    footer = sec.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    set_font(footer.add_run("Food Go  |  Page "), 8, color=GRAY)
    field = OxmlElement("w:fldSimple")
    field.set(qn("w:instr"), "PAGE")
    footer._p.append(field)
    doc.core_properties.title = "Food Go development report"
    doc.core_properties.subject = "Development progress screenshots subscriptions and owner actions"
    doc.core_properties.author = "Food Go development team"
    doc.core_properties.keywords = "Food Go development progress"

    paragraph(doc, "Food Go development report", style="Title")
    paragraph(doc, "Website and mobile progress", style="Subtitle")
    paragraph(doc, "Prepared for the Food Go project owner\n11 November 2026", size=10, color=GRAY)
    paragraph(doc, "Food Go now has a working discovery preview and a React Native mobile foundation. You can search example venues, save places, plan trails and try the restaurant draft. This report shows what works, what still needs a live connection, and the decisions needed before launch.")
    paragraph(doc, "The website and mobile code are kept in the same repository and are designed to use one shared venue database. An owner should enter a venue once, with approved information then appearing in both the marketplace and the game.")
    heading(doc, "What you can review now", 2)
    table(doc, ["Area", "Current position"], [
        ("Discovery and collections", "Working preview with clearly labelled example venues and dishes."),
        ("Restaurant onboarding", "Three-step draft with validation, review and an in-page preview."),
        ("Accounts", evidence["identity_status"]),
        ("Android and iOS", evidence["mobile_status"]),
        ("Live restaurant service", "Ownership checks, published listings, check-ins, bookings and payments still need implementation or connection."),
    ], [1.65, 5.15])
    paragraph(doc, "The screenshots show the revised interface. Example bookmarks are plans, not proof of a visit. No venue is published and no reward is earned by completing a local preview.")
    heading(doc, "Reading this report", 2)
    paragraph(doc, "The following pages explain the important screens, the technical and security work, and the remaining launch work. The final two sections list the subscriptions to buy and the actions required from your side.")
    p = doc.add_paragraph()
    hyperlink(p, "Project source and development history", "https://github.com/DasuniPathirana/food-go")

    page(doc, "Exploring places")
    screenshot(doc, "02-explore-desktop.jpg", "The revised desktop Explore screen with example places.")
    for text in content_paragraphs(sections, "Exploring places"):
        paragraph(doc, text)
    heading(doc, "Try it", 2)
    bullet(doc, "Choose Melbourne and search for a cuisine or suburb.")
    bullet(doc, "Change the category, switch the view and select a map marker.")
    bullet(doc, "Save a place, then open VenueDex to find it again.")

    page(doc, "Website on a phone")
    screenshot(doc, "02-explore-mobile.jpg", "The website at a phone width. This is not a native device screenshot.", mobile=True, max_height=5.2)
    paragraph(doc, "The phone layout uses a bottom navigation bar and one main page scroll. The content changes width instead of creating a second scrolling panel.")
    paragraph(doc, evidence["mobile_status"])
    paragraph(doc, "Native Android and iOS device testing is still required. The React Native application is separate from this mobile-width website view. Live camera, QR and location features are not connected.")

    page(doc, "React Native app preview")
    screenshot(doc, "02-native-preview.jpg", "The React Native application running through Expo Web in a browser.", mobile=True, max_height=5.2)
    for text in content_paragraphs(sections, "React Native app preview"):
        paragraph(doc, text)
    paragraph(doc, "The mobile source uses the same five main sections: Map, FoodDex, VenueDex, Quests and Profile. Saved examples and plans do not create verified visits or earned rewards.")

    for title, name, caption, trial in [
        ("Looking at a venue", "02-venue-detail.jpg", "An example venue page with a save action and signature dish idea.", "Open a venue, save it and use the food trail link. The save action should change its label and the saved count."),
        ("FoodDex", "02-food-dex.jpg", "Dish ideas are separate from verified food experiences.", "Save an example dish idea, then switch between the discovery, saved and verified views. The verified count remains zero."),
        ("VenueDex", "02-venue-dex.jpg", "Saved places and verified visits are kept separate.", "Open a saved place or remove its bookmark. A saved place must not become a verified visit."),
        ("Quests and trails", "02-quests.jpg", "Example trails can be added to the current plan.", "Add a trail to the plan, open the planned view and remove it again. Verified progress must remain zero."),
        ("Explorer profile", "02-profile.jpg", "The profile reflects the current preview account state.", "Check the saved count and clear the example bookmarks. No invented level or earned badge should appear."),
    ]:
        page(doc, title)
        screenshot(doc, name, caption)
        for text in content_paragraphs(sections, title):
            paragraph(doc, text)
        heading(doc, "Try it", 2)
        paragraph(doc, trial)

    page(doc, "Restaurant partner entry")
    screenshot(doc, "02-partner.jpg", "The partner entry page opens the venue draft.")
    for text in content_paragraphs(sections, "Restaurant partner entry"):
        paragraph(doc, text)
    heading(doc, "Try it", 2)
    paragraph(doc, "Open the venue draft and complete it with fictional details. No account, contract or published restaurant is created by this preview.")

    page(doc, "Restaurant onboarding")
    screenshot(doc, "02-onboarding.jpg", "The restaurant draft review before an in-page preview.", max_height=4.1)
    for text in content_paragraphs(sections, "Restaurant onboarding"):
        paragraph(doc, text)
    heading(doc, "The owner journey", 2)
    bullet(doc, "Start with the venue name and contact details.")
    bullet(doc, "Add the location, food style and a short description.")
    bullet(doc, "Review the details, edit if needed and create a preview.")

    page(doc, "Accounts and recovery")
    screenshot(doc, "02-auth.jpg", "The account screen states whether its connection is ready.", max_height=4.0)
    paragraph(doc, evidence["identity_details"])
    paragraph(doc, "The account connection remains disabled until the client-owned Supabase project and its email sender are configured. No live account or email delivery has been tested in this local preview.")
    paragraph(doc, "Account deletion and CAPTCHA integration are not implemented yet. Before public registration opens, we need to complete that work, agree reliable one-use handling for recovery links and test confirmation, sign-out, expiry and recovery against the real account service.")

    page(doc, "Security and remaining work")
    for text in content_paragraphs(sections, "Security and technical work"):
        paragraph(doc, text)
    heading(doc, "Checks completed", 2)
    for text in evidence["checks"]:
        bullet(doc, text)
    heading(doc, "What remains", 2)
    paragraph(doc, "Live database access tests and native phone testing are still required. We also need real venue ownership checks, saved server drafts, secure uploads, publication, live maps, verified visits and dishes, rewards, offers, bookings and administration tools. Payments and community features follow the agreed business model.")
    paragraph(doc, "The next practical step is a disposable Supabase test project, followed by account and email testing and checks that two venue organisations cannot access each other's private records.")

    page(doc, "Subscriptions to buy")
    paragraph(doc, "You do not need to buy a subscription to review the local preview. Set up the client-owned accounts first. Use free test allowances where they are suitable, then upgrade before production or when the next feature needs them.")
    paragraph(doc, "Prices checked on 11 November 2026. These starting prices are in US dollars. Tax, additional usage and currency conversion can change the invoice.", size=9.5, color=GRAY)
    links = {
        "Supabase": "https://supabase.com/pricing",
        "Vercel Pro": "https://vercel.com/pricing",
        "Resend": "https://resend.com/pricing",
        "Expo services": "https://expo.dev/pricing",
        "Apple Developer": "https://developer.apple.com/programs/enroll/",
        "Google Play": "https://support.google.com/googleplay/android-developer/answer/6112435?hl=en",
    }
    table(doc, ["Service", "When to arrange it", "Starting price"], [
        ("Supabase", "Free project for connected testing. Choose Sydney. Upgrade to Pro before production.", "Free test plan\nPro US$25/month"),
        ("Test database", "Keep testing separate from live data. A free project can be used first. This price is for an additional Micro project on a paid plan.", "US$10/month"),
        ("Vercel Pro", "When hosting this commercial website. Additional developer seats and usage cost more.", "US$20/month"),
        ("Resend", "Before testing public confirmation and recovery emails. Free plan has a 100-email daily limit.", "Free 3,000/month\nPro US$20/month"),
        ("Expo services", "For cloud app builds and updates. The paid plan is optional.", "Free limited plan\nStarter US$19/month"),
        ("Apple Developer", "Prepare the organisation account before iPhone distribution. Local pricing may vary.", "US$99/year"),
        ("Google Play", "Before Android testing tracks and distribution.", "US$25 once"),
        ("Domain and email", "Before branded emails and public hosting. The client should own the domain.", "Provider dependent"),
    ], [1.25, 4.0, 1.55], links=links)
    paragraph(doc, "Start connected testing with free Supabase and Resend allowances. Commercial website hosting and a production database start at about US$45 per month. An additional paid test project adds US$10. Paid email adds US$20 when needed, giving a US$75 example. Optional Expo Starter brings it to US$94. These subtotals exclude tax, extra usage, maps, domains, monitoring, backups and staff.")
    paragraph(doc, "React Native, Next.js and the Expo development tools do not need a paid framework licence. Both mobile platforms are designed to use one shared backend once connected. Standard Vercel hosting includes HTTPS.", size=9.5)
    paragraph(doc, "Arrange a map billing account when live maps are implemented. Set usage limits and restrict the keys. Keep permanent venue information owner-supplied or appropriately licensed. Choose Stripe only after agreeing whether Food Go collects dining money or customers pay restaurants directly.")
    p = paragraph(doc, "Important setup notes: ", size=9.5)
    hyperlink(p, "Supabase email delivery", "https://supabase.com/docs/guides/auth/auth-smtp")
    p.add_run(" needs a custom sender for public accounts. ")
    hyperlink(p, "Database backups", "https://supabase.com/docs/guides/platform/backups")
    p.add_run(" do not include the uploaded photo files.")

    page(doc, "What you need to do")
    for text in content_paragraphs(sections, "What you need to do"):
        for line in re.split(r" (?=\d+\. )", text):
            if line.strip():
                p = paragraph(doc, line.strip())
                p.paragraph_format.space_after = Pt(8)
                p.paragraph_format.left_indent = Inches(0.24)
                p.paragraph_format.first_line_indent = Inches(-0.24)
                if line.strip().startswith("10."):
                    p.add_run(" ")
                    hyperlink(p, "Apple requirements", "https://developer.apple.com/programs/enroll/")
                    p.add_run(" and ")
                    hyperlink(p, "Google requirements", "https://support.google.com/googleplay/android-developer/answer/13628312?hl=en")

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    doc.save(output)
    reopened = Document(output)
    text = "\n".join(
        [p.text for p in reopened.paragraphs]
        + [cell.text for tab in reopened.tables for row in tab.rows for cell in row.cells]
    )
    if "\u2014" in text or re.search("[\U0001F300-\U0001FAFF]", text):
        raise ValueError("The report contains an em dash or emoji.")
    if len(reopened.inline_shapes) != 11:
        raise ValueError("The report must include all eleven required screenshots.")
    if "Screenshot planned" in text or "must be checked against" in text:
        raise ValueError("Planning copy remains in the report.")
    print(str(output))
    print(f"Structural check passed: {len(reopened.inline_shapes)} screenshots and {len(reopened.tables)} tables.")


if __name__ == "__main__":
    main()
