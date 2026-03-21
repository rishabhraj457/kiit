const express = require("express");
const router = express.Router();

router.post("/predict", async (req, res) => {
  try {
    const response = await fetch("http://127.0.0.1:8000/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: req.body.text,
      }),
    });

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "ML API error" });
  }
});

module.exports = router;