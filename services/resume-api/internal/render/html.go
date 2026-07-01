// Package render produces HTML and PDF representations of a Resume.
package render

import (
	"bytes"
	"html/template"
	"strings"

	"github.com/imperialcoal/dw-resume-api/internal/contracts"
)

const htmlTmpl = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{.Contact.Name}} — Resume</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.5;
    color: #1a1a1a;
    background: #fff;
    max-width: 820px;
    margin: 0 auto;
    padding: 2.5rem 2rem;
  }
  .header { margin-bottom: 1.4rem; }
  .name {
    font-size: 22pt;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #09090b;
    margin-bottom: 0.3rem;
  }
  .contact-line {
    font-size: 8.5pt;
    color: #52525b;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .contact-line span::before { content: "·"; margin-right: 0.5rem; }
  .contact-line span:first-child::before { content: ""; margin-right: 0; }
  .section { margin-bottom: 1.4rem; }
  .section-title {
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #09090b;
    border-bottom: 1.5px solid #09090b;
    padding-bottom: 2px;
    margin-bottom: 0.7rem;
  }
  .summary { color: #3f3f46; line-height: 1.65; font-size: 9.5pt; }
  .skills-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem 1.5rem; }
  .skill-row { font-size: 9pt; }
  .skill-category { font-weight: 700; color: #09090b; }
  .skill-values { color: #3f3f46; }
  .exp-entry { margin-bottom: 1rem; }
  .exp-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 1px;
  }
  .exp-title { font-weight: 700; font-size: 10pt; color: #09090b; }
  .exp-dates { font-size: 8.5pt; color: #71717a; white-space: nowrap; }
  .exp-meta { font-size: 8.5pt; color: #52525b; margin-bottom: 0.4rem; }
  .exp-bullets { list-style: none; padding: 0; }
  .exp-bullets li {
    font-size: 9pt;
    color: #3f3f46;
    padding-left: 1rem;
    position: relative;
    margin-bottom: 2px;
    line-height: 1.55;
  }
  .exp-bullets li::before {
    content: "–";
    position: absolute;
    left: 0;
    color: #a1a1aa;
  }
  .project-entry { margin-bottom: 0.8rem; }
  .project-name { font-weight: 700; font-size: 9.5pt; color: #09090b; }
  .project-link { font-size: 8pt; color: #52525b; margin-left: 0.5rem; }
  .project-desc { font-size: 9pt; color: #3f3f46; margin-top: 2px; line-height: 1.5; }
  .project-stack {
    font-size: 8pt;
    color: #71717a;
    margin-top: 3px;
    font-style: italic;
  }
  .edu-entry { margin-bottom: 0.5rem; }
  .edu-degree { font-weight: 700; font-size: 9.5pt; color: #09090b; }
  .edu-school { font-size: 9pt; color: #52525b; }
  .edu-gpa { font-size: 8.5pt; color: #71717a; margin-left: 0.5rem; }
  @media print {
    body { padding: 1.5rem 1.5rem; }
    @page { margin: 0; }
  }
</style>
</head>
<body>
<div class="header">
  <div class="name">{{.Contact.Name}}</div>
  <div class="contact-line">
    <span>{{.Contact.Location}}</span>
    <span>{{.Contact.Email}}</span>
    <span>{{.Contact.LinkedIn}}</span>
    <span>{{.Contact.GitHub}}</span>
  </div>
</div>

{{if .Summary}}
<div class="section">
  <div class="section-title">Professional Summary</div>
  <p class="summary">{{.Summary}}</p>
</div>
{{end}}

{{if .Skills}}
<div class="section">
  <div class="section-title">Technical Skills</div>
  <div class="skills-grid">
    {{range .Skills}}
    <div class="skill-row">
      <span class="skill-category">{{.Category}}:</span>
      <span class="skill-values">{{join .Skills ", "}}</span>
    </div>
    {{end}}
  </div>
</div>
{{end}}

{{if .Experience}}
<div class="section">
  <div class="section-title">Professional Experience</div>
  {{range .Experience}}
  <div class="exp-entry">
    <div class="exp-header">
      <span class="exp-title">{{.Title}}</span>
      <span class="exp-dates">{{.Start}} – {{.End}}</span>
    </div>
    <div class="exp-meta">{{.Company}} · {{.Location}}</div>
    <ul class="exp-bullets">
      {{range .Bullets}}<li>{{.}}</li>{{end}}
    </ul>
  </div>
  {{end}}
</div>
{{end}}

{{if .Projects}}
<div class="section">
  <div class="section-title">Projects</div>
  {{range .Projects}}
  <div class="project-entry">
    <span class="project-name">{{.Name}}</span>
    {{if .Link}}<span class="project-link">{{.Link}}</span>{{end}}
    <div class="project-desc">{{.Description}}</div>
    <div class="project-stack">{{join .Stack " · "}}</div>
  </div>
  {{end}}
</div>
{{end}}

{{if .Education}}
<div class="section">
  <div class="section-title">Education</div>
  {{range .Education}}
  <div class="edu-entry">
    <div class="edu-degree">{{.Degree}}, {{.Field}}</div>
    <div class="edu-school">
      {{.School}} — {{.Location}}
      {{if .GPA}}<span class="edu-gpa">GPA: {{.GPA}}</span>{{end}}
    </div>
  </div>
  {{end}}
</div>
{{end}}
</body>
</html>`

var tmpl = template.Must(
	template.New("resume").
		Funcs(template.FuncMap{
			"join": strings.Join,
		}).
		Parse(htmlTmpl),
)

// ToHTML renders a Resume to an HTML string.
func ToHTML(r *contracts.Resume) (string, error) {
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, r); err != nil {
		return "", err
	}
	return buf.String(), nil
}
