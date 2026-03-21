const fetch = require("node-fetch");

const checkText = async (text) => {
  try {
    // 🔥 Call ML only in development
    if (process.env.NODE_ENV !== "production") {

      // ⏱️ Add timeout (prevents server hang)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000); // 3 sec

      const res = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // ❌ If ML API fails
      if (!res.ok) {
        throw new Error(`ML API failed with status ${res.status}`);
      }

      const data = await res.json();

      // ✅ Ensure safe return structure
      return {
        label: data?.label || "safe",
        confidence: data?.confidence || 0,
      };
    }

    // 🔥 Production fallback (no ML dependency)
    return {
      label: "safe",
      confidence: 0,
    };

  } catch (err) {
    console.error("❌ ML API Error:", err.message);

    // 🔥 ALWAYS return safe fallback (never crash server)
    return {
      label: "safe",
      confidence: 0,
    };
  }
};

module.exports = { checkText };