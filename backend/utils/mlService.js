const checkText = async (text) => {
  try {
    // 🔥 ONLY call ML in local
    if (process.env.NODE_ENV !== "production") {
      const res = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("ML API failed");

      return await res.json();
    }

    // 🔥 PRODUCTION FALLBACK (IMPORTANT)
    return {
      label: "safe",
      confidence: 0,
    };

  } catch (err) {
    console.error("ML API Error:", err.message);

    // 🔥 NEVER RETURN NULL
    return {
      label: "safe",
      confidence: 0,
    };
  }
};

module.exports = { checkText };