const fetch = require("node-fetch");

const ML_API_URL = "https://shrutigunu-hate-speech-api.hf.space/run/predict";
const ML_TIMEOUT_MS = 5000;

const checkText = async (text) => {
    // Guard: don't call API with empty text
    if (!text || typeof text !== "string" || !text.trim()) {
        return { label: "safe", confidence: 0 };
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
            return { label: "safe", confidence: 0 };
        }

        const data = await res.json();

        // HuggingFace Gradio response format: { data: [ { label, score } ] }
        const prediction = data?.data?.[0];

        if (!prediction || typeof prediction !== "object") {
            console.warn("⚠️ ML API returned unexpected format:", data);
            return { label: "safe", confidence: 0 };
        }

        return {
            label: String(prediction.label || "safe").toLowerCase(),
            confidence: Number(prediction.score || 0),
        };

    } catch (err) {
        if (err.name === "AbortError") {
            console.error("❌ ML API timed out after", ML_TIMEOUT_MS, "ms");
        } else {
            console.error("❌ ML API Error:", err.message);
        }

        // Always fail safe — never crash the main request
        return { label: "safe", confidence: 0 };
    }
};

module.exports = { checkText };