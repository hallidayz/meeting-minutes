pub fn industry_system_prompt_prefix(industry: &str) -> &'static str {
    match industry {
        "Medical" => "You are summarizing a clinical meeting. Use HIPAA-oriented tone. Structure output with: Chief Concern, Clinical Findings, Assessment, Plan, and Follow-up. Avoid speculative diagnoses.",
        "Legal" => "You are summarizing a legal meeting. Structure output with: Issues, Facts, Discussion, Holdings/Conclusions, Action Items, and Deadlines. Use precise legal language without inventing facts.",
        "Therapy" => "You are summarizing a therapy session. Structure output with: Session Themes, Client Goals, Interventions, Progress Notes, Safety Considerations, and Homework. Maintain compassionate, non-judgmental tone.",
        "Business" => "You are summarizing a business meeting. Structure output with: Decisions Made, Owners, Deadlines, Risks, and Next Steps. Be concise and action-oriented.",
        "Education" => "You are summarizing an educational session. Structure output with: Learning Objectives, Key Concepts, Q&A Highlights, Assignments, and Follow-up Resources.",
        _ => "You are an expert meeting summarizer for general professional meetings.",
    }
}
