const express = require("express");
const fetch = require("node-fetch");

const router = express.Router();

router.post("/predict", async (req, res) => {
  try {
    const text = req.body?.text;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Invalid text input" });
    }

    const response = await fetch("http://127.0.0.1:8000/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: [text], // ✅ FIXED
      }),
    });

    if (!response.ok) {
      return res.status(500).json({ error: "ML API failed" });
    }

    const data = await response.json();

    // Optional debug
    console.log("ML Response:", data);

    res.json(data);

  } catch (error) {
    console.error("❌ ML API Error:", error.message);
    res.status(500).json({ error: "ML API error" });
  }
});

module.exports = router;