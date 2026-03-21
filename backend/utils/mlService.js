const fetch = require("node-fetch");

const ML_API_URL = "https://shrutigunu-hate-speech-api.hf.space/run/predict";
const ML_TIMEOUT_MS = 5000;

// 🔥 Keywords to detect harmful content
const HARMFUL_LABELS = [
    "hate",
    "offensive",
    "hate_speech",
    "abusive",
    "toxic"
];

// ✅ Main function to call ML API
const checkText = async (text) => {
    // Guard: don't call API with empty text
    if (!text || typeof text !== "string" || !text.trim()) {
        return { label: "safe", confidence: 0, isHarmful: false };
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

        const res = await fetch(ML_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                data: [text.trim()],
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
            console.error(`❌ ML API returned status ${res.status}`);
            return { label: "safe", confidence: 0, isHarmful: false };
        }

        const data = await res.json();

        // Expected: { data: [ { label, score } ] }
        const prediction = data?.data?.[0];

        if (!prediction || typeof prediction !== "object") {
            console.warn("⚠️ ML API returned unexpected format:", data);
            return { label: "safe", confidence: 0, isHarmful: false };
        }

        const label = String(prediction.label || "safe").toLowerCase();
        const confidence = Number(prediction.score || 0);

        // 🔥 FINAL harmful check
        const isHarmful =
            HARMFUL_LABELS.some(word => label.includes(word)) &&
            confidence > 0.6;

        // 🧪 Debug log (remove in production)
        console.log("ML RESULT:", { label, confidence, isHarmful });

        return { label, confidence, isHarmful };

    } catch (err) {
        if (err.name === "AbortError") {
            console.error("❌ ML API timed out after", ML_TIMEOUT_MS, "ms");
        } else {
            console.error("❌ ML API Error:", err.message);
        }

        // Fail-safe response
        return { label: "safe", confidence: 0, isHarmful: false };
    }
};

module.exports = { checkText };