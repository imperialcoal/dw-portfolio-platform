package render

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/phpdave11/gofpdf"

	"github.com/imperialcoal/dw-resume-api/internal/contracts"
)

const (
	pageW      = 210.0 // A4 width mm
	marginL    = 18.0
	marginR    = 18.0
	marginT    = 18.0
	contentW   = pageW - marginL - marginR
	lineH      = 4.8
	sectionGap = 4.0
	entryGap   = 3.0
)

// ToPDF renders a Resume to a PDF byte slice.
//
// IMPORTANT: gofpdf's core fonts (Arial, Helvetica, etc.) are single-byte
// cp1252 fonts, not UTF-8. Any UTF-8 text (middle dots, en/em dashes,
// accented characters — all common in both our own literals and in
// Claude-generated bullets) must be passed through UnicodeTranslatorFromDescriptor
// before being written, or it renders as mojibake (e.g. "Â·" instead of "·").
// The `t` helper below wraps every string for exactly this reason — every
// call site uses it, including section headers, even though those are
// currently ASCII-only, to guard against future content changes.
func ToPDF(r *contracts.Resume) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginL, marginT, marginR)
	pdf.SetAutoPageBreak(true, 14)
	pdf.AddPage()

	tr := pdf.UnicodeTranslatorFromDescriptor("")
	t := func(s string) string { return tr(s) }

	// ── Header ─────────────────────────────────────────────────────────────
	pdf.SetFont("Arial", "B", 20)
	pdf.SetTextColor(9, 9, 11)
	pdf.CellFormat(contentW, 9, t(r.Contact.Name), "", 1, "L", false, 0, "")

	contact := strings.Join([]string{
		r.Contact.Location,
		r.Contact.Email,
		r.Contact.LinkedIn,
		r.Contact.GitHub,
	}, "  ·  ")
	pdf.SetFont("Arial", "", 7.5)
	pdf.SetTextColor(82, 82, 91)
	pdf.MultiCell(contentW, 4, t(contact), "", "L", false)
	pdf.Ln(3)

	// ── Summary ────────────────────────────────────────────────────────────
	if r.Summary != "" {
		sectionHeader(pdf, t, "PROFESSIONAL SUMMARY")
		pdf.SetFont("Arial", "", 9)
		pdf.SetTextColor(63, 63, 70)
		pdf.MultiCell(contentW, lineH, t(r.Summary), "", "L", false)
		pdf.Ln(sectionGap)
	}

	// ── Skills ─────────────────────────────────────────────────────────────
	if len(r.Skills) > 0 {
		sectionHeader(pdf, t, "TECHNICAL SKILLS")
		pdf.SetFont("Arial", "", 8.5)
		for _, sg := range r.Skills {
			pdf.SetTextColor(9, 9, 11)
			pdf.SetFont("Arial", "B", 8.5)
			pdf.CellFormat(42, lineH, t(sg.Category+":"), "", 0, "L", false, 0, "")
			pdf.SetFont("Arial", "", 8.5)
			pdf.SetTextColor(63, 63, 70)
			skillText := strings.Join(sg.Skills, ", ")
			pdf.MultiCell(contentW-42, lineH, t(skillText), "", "L", false)
		}
		pdf.Ln(sectionGap)
	}

	// ── Experience ─────────────────────────────────────────────────────────
	if len(r.Experience) > 0 {
		sectionHeader(pdf, t, "PROFESSIONAL EXPERIENCE")
		for i, e := range r.Experience {
			if i > 0 {
				pdf.Ln(entryGap)
			}
			pdf.SetFont("Arial", "B", 9.5)
			pdf.SetTextColor(9, 9, 11)
			titleW := contentW - 45
			pdf.CellFormat(titleW, lineH, t(e.Title), "", 0, "L", false, 0, "")
			pdf.SetFont("Arial", "I", 8)
			pdf.SetTextColor(113, 113, 122)
			dates := fmt.Sprintf("%s - %s", e.Start, e.End)
			pdf.CellFormat(45, lineH, t(dates), "", 1, "R", false, 0, "")
			pdf.SetFont("Arial", "", 8.5)
			pdf.SetTextColor(82, 82, 91)
			pdf.CellFormat(contentW, lineH-0.5,
				t(fmt.Sprintf("%s · %s", e.Company, e.Location)), "", 1, "L", false, 0, "")
			pdf.SetFont("Arial", "", 8.5)
			pdf.SetTextColor(63, 63, 70)
			pdf.Ln(1)
			for _, b := range e.Bullets {
				pdf.SetX(marginL + 3)
				pdf.CellFormat(4, lineH, "-", "", 0, "L", false, 0, "")
				pdf.MultiCell(contentW-7, lineH, t(b), "", "L", false)
			}
		}
		pdf.Ln(sectionGap)
	}

	// ── Projects ───────────────────────────────────────────────────────────
	if len(r.Projects) > 0 {
		sectionHeader(pdf, t, "PROJECTS")
		for _, p := range r.Projects {
			pdf.SetFont("Arial", "B", 9.5)
			pdf.SetTextColor(9, 9, 11)
			nameW := contentW
			if p.Link != "" {
				nameW = contentW / 2
			}
			pdf.CellFormat(nameW, lineH, t(p.Name), "", 0, "L", false, 0, "")
			if p.Link != "" {
				pdf.SetFont("Arial", "", 7.5)
				pdf.SetTextColor(82, 82, 91)
				pdf.CellFormat(contentW/2, lineH, t(p.Link), "", 1, "R", false, 0, "")
			} else {
				pdf.Ln(lineH)
			}
			pdf.SetFont("Arial", "", 8.5)
			pdf.SetTextColor(63, 63, 70)
			pdf.MultiCell(contentW, lineH, t(p.Description), "", "L", false)
			pdf.SetFont("Arial", "I", 7.5)
			pdf.SetTextColor(113, 113, 122)
			pdf.MultiCell(contentW, lineH-0.5, t(strings.Join(p.Stack, " · ")), "", "L", false)
			pdf.Ln(2)
		}
		pdf.Ln(sectionGap - 2)
	}

	// ── Education ──────────────────────────────────────────────────────────
	if len(r.Education) > 0 {
		sectionHeader(pdf, t, "EDUCATION")
		for _, e := range r.Education {
			pdf.SetFont("Arial", "B", 9.5)
			pdf.SetTextColor(9, 9, 11)
			pdf.CellFormat(contentW, lineH,
				t(fmt.Sprintf("%s, %s", e.Degree, e.Field)), "", 1, "L", false, 0, "")
			pdf.SetFont("Arial", "", 8.5)
			pdf.SetTextColor(82, 82, 91)
			school := fmt.Sprintf("%s - %s", e.School, e.Location)
			if e.GPA != "" {
				school += fmt.Sprintf("   GPA: %s", e.GPA)
			}
			pdf.CellFormat(contentW, lineH, t(school), "", 1, "L", false, 0, "")
			pdf.Ln(1)
		}
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("pdf generation failed: %w", err)
	}
	return buf.Bytes(), nil
}

// sectionHeader writes a bold all-caps section heading with an underline.
// Takes the translator func `t` so headings stay consistent with the rest
// of the document even though they're currently ASCII-only literals.
func sectionHeader(pdf *gofpdf.Fpdf, t func(string) string, title string) {
	pdf.SetFont("Arial", "B", 8)
	pdf.SetTextColor(9, 9, 11)
	pdf.SetDrawColor(9, 9, 11)
	pdf.SetLineWidth(0.4)
	pdf.CellFormat(contentW, 5.5, t(title), "B", 1, "L", false, 0, "")
	pdf.Ln(1.5)
}
