const fetch = require("node-fetch");

const checkText = async (text) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    // 🔥 Use HuggingFace API (WORKS IN PRODUCTION)
    const res = await fetch(
      "https://shrutigunu-hate-speech-api.hf.space/run/predict",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: [text], // 🔥 IMPORTANT FORMAT
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HF API failed: ${res.status}`);
    }

    const data = await res.json();

    // 🔥 Extract safely (HF response format)
    const prediction = data?.data?.[0];

    return {
      label: prediction?.label || "safe",
      confidence: prediction?.score || 0,
    };

  } catch (err) {
    console.error("❌ ML API Error:", err.message);

    return {
      label: "safe",
      confidence: 0,
    };
  }
};

module.exports = { checkText };