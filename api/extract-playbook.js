import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXTRACTION_SYSTEM = `You are an expert at extracting structured sales playbook intelligence from documents. Extract the following from the playbook text provided. Use the Playbook Intelligence Model v2 extraction framework. For any section not found in the document, use "[NOT DEFINED IN PLAYBOOK]" for that section or field.

Output valid JSON only (no markdown, no backticks) with this exact structure:
{
  "products": [
    {
      "product_name": "string",
      "category": "string",
      "ideal_customer_profile": "string",
      "buying_signals_explicit": "string",
      "buying_signals_implicit": "string",
      "buying_signals_negative": "string",
      "cross_sell_relationships": "string",
      "competitive_positioning": "string",
      "objection_handling": "string",
      "value_props_by_persona": "string",
      "pricing_packaging": "string",
      "proof_points": "string",
      "description": "string"
    }
  ],
  "buyers": [
    {
      "persona": "string",
      "typical_titles": "string",
      "what_they_care_about": "string",
      "engagement_expectations": "string",
      "influence_on_deal": "string",
      "messaging_approach": "string",
      "red_flags": "string",
      "access_strategy": "string"
    }
  ],
  "stages": [
    {
      "stage_number": number,
      "stage_name": "string",
      "entry_criteria": "string",
      "exit_criteria": "string",
      "required_activities": "string",
      "forecast_category": "string",
      "typical_duration": "string"
    }
  ],
  "plays": [
    {
      "play_name": "string",
      "play_type": "string",
      "trigger_conditions": "string",
      "target_ICP": "string",
      "know": "string",
      "say": "string",
      "show": "string",
      "do": "string",
      "expected_outcome": "string",
      "success_metrics": "string",
      "common_failure_modes": "string"
    }
  ],
  "qualification_methodology": "string or object describing MEDDIC/BANT/other",
  "process_documentation": "string",
  "competitive_intelligence": [
    {
      "competitor_name": "string",
      "where_we_win": "string",
      "where_we_lose": "string",
      "counter_strategies": "string"
    }
  ]
}

Omit or use empty string for missing fields. Keep text concise but complete.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { playbookText } = req.body || {};
  const text = typeof playbookText === "string" ? playbookText.trim() : "";
  if (!text || text.length < 100) {
    return res.status(400).json({
      error: "Missing or too short playbook text. Send { playbookText: \"...\" } with at least 100 characters.",
    });
  }

  if (text.length > 120000) {
    return res.status(400).json({
      error: "Playbook text is too long. Maximum ~120,000 characters.",
    });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: EXTRACTION_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Extract the playbook intelligence from this document:\n\n${text.slice(0, 120000)}`,
        },
      ],
    });

    const rawText = (response.content || []).map((b) => (b.type === "text" ? b.text : "")).join("");
    const raw = rawText.replace(/```json|```/g, "").trim();
    const extraction = JSON.parse(raw);

    res.status(200).json({
      extraction: {
        products: extraction.products || [],
        buyers: extraction.buyers || [],
        stages: extraction.stages || [],
        plays: extraction.plays || [],
        qualification_methodology: extraction.qualification_methodology ?? "",
        process_documentation: extraction.process_documentation ?? "",
        competitive_intelligence: extraction.competitive_intelligence || [],
      },
      extractedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Playbook extraction failed:", err);
    res.status(500).json({
      error: err.message || "Playbook extraction failed",
    });
  }
}
