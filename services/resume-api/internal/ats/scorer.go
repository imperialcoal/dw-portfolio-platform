// Package ats provides ATS (Applicant Tracking System) scoring for resumes.
package ats

import (
	"strings"

	"github.com/imperialcoal/dw-resume-api/internal/contracts"
)

// Score calculates an ATS compatibility score for the given resume content.
func Score(
	summary string,
	skills []contracts.SkillGroup,
	experience []contracts.ExperienceEntry,
	roleKeywords []string,
	jobDescription string,
) contracts.ATSAnalysis {
	var corpus strings.Builder
	corpus.WriteString(strings.ToLower(summary))
	corpus.WriteString(" ")
	for _, sg := range skills {
		for _, s := range sg.Skills {
			corpus.WriteString(strings.ToLower(s))
			corpus.WriteString(" ")
		}
	}
	for _, e := range experience {
		for _, b := range e.Bullets {
			corpus.WriteString(strings.ToLower(b))
			corpus.WriteString(" ")
		}
	}
	text := corpus.String()

	keywords := dedupe(append(roleKeywords, extractJDKeywords(jobDescription)...))

	var matched, missing []string
	for _, kw := range keywords {
		if strings.Contains(text, strings.ToLower(kw)) {
			matched = append(matched, kw)
		} else {
			missing = append(missing, kw)
		}
	}

	coverage := 0.0
	if len(keywords) > 0 {
		coverage = float64(len(matched)) / float64(len(keywords))
	}
	keywordScore := int(coverage * 60)

	structural := scoreStructural(summary, skills, experience)

	total := keywordScore + structural
	if total > 100 {
		total = 100
	}

	suggestions := buildSuggestions(total, missing, summary, experience)

	if len(missing) > 10 {
		missing = missing[:10]
	}

	return contracts.ATSAnalysis{
		Score:           total,
		MatchedKeywords: matched,
		MissingKeywords: missing,
		Suggestions:     suggestions,
	}
}

func scoreStructural(
	summary string,
	skills []contracts.SkillGroup,
	experience []contracts.ExperienceEntry,
) int {
	score := 0

	if len(summary) > 50 {
		score += 10
	}
	if len(skills) > 0 {
		score += 10
	}
	if len(skills) >= 3 {
		score += 5
	}
	if len(experience) > 0 {
		score += 10
	}

	actionVerbs := []string{
		"built", "developed", "designed", "implemented", "led", "managed",
		"created", "delivered", "shipped", "optimized", "improved", "automated",
		"reduced", "increased", "architected", "deployed", "collaborated",
		"co-developed", "programmed", "maintained",
	}
	for _, e := range experience {
		for _, b := range e.Bullets {
			lower := strings.ToLower(b)
			for _, v := range actionVerbs {
				if strings.HasPrefix(lower, v) {
					score += 5
					goto done
				}
			}
		}
	}
done:

	if score > 40 {
		score = 40
	}
	return score
}

func buildSuggestions(score int, missing []string, summary string, experience []contracts.ExperienceEntry) []string {
	var s []string

	if score < 70 {
		s = append(s, "Consider adding more role-specific keywords naturally throughout your experience bullets.")
	}
	if len(missing) > 5 {
		s = append(s, "Several expected keywords are missing — try incorporating them into your summary or experience descriptions.")
	}
	if len(summary) < 100 {
		s = append(s, "Your summary is brief — a longer, keyword-rich summary improves ATS matching significantly.")
	}
	if len(experience) > 0 && len(experience[0].Bullets) < 3 {
		s = append(s, "Add more detail to your most recent role — ATS systems reward depth in recent experience.")
	}
	if score >= 85 {
		s = append(s, "Strong ATS compatibility. Focus on tailoring to the specific job description for best results.")
	}

	return s
}

func extractJDKeywords(jd string) []string {
	if jd == "" {
		return nil
	}
	stopwords := map[string]bool{
		"the": true, "and": true, "for": true, "with": true, "this": true,
		"that": true, "you": true, "will": true, "are": true, "have": true,
		"from": true, "our": true, "your": true, "their": true, "they": true,
		"who": true, "what": true, "how": true, "when": true, "where": true,
		"can": true, "not": true, "but": true, "all": true, "more": true,
	}

	words := strings.Fields(strings.ToLower(jd))
	seen := map[string]bool{}
	var result []string
	for _, w := range words {
		w = strings.Trim(w, ".,;:()'\"!?-")
		if len(w) < 3 || stopwords[w] || seen[w] {
			continue
		}
		seen[w] = true
		result = append(result, w)
	}
	return result
}

func dedupe(in []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, s := range in {
		lower := strings.ToLower(s)
		if !seen[lower] {
			seen[lower] = true
			out = append(out, s)
		}
	}
	return out
}
