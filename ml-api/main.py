from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

app = FastAPI()

MODEL_NAME = "Shrutigunu/hate-speech-roberta"

# 🔥 DEVICE (GPU if available)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME).to(device)

model.eval()

class InputText(BaseModel):
    text: str

@app.get("/")
def home():
    return {"message": "RoBERTa Hate Speech API running"}

@app.post("/predict")
def predict(input: InputText):
    try:
        # 🔥 Limit input size (important)
        inputs = tokenizer(
            input.text,
            return_tensors="pt",
            truncation=True,
            padding=True,
            max_length=256
        ).to(device)

        with torch.no_grad():
            outputs = model(**inputs)

        probs = torch.softmax(outputs.logits, dim=1)
        pred = torch.argmax(probs).item()
        confidence = probs.max().item()

        # 🔥 Safer labeling (simple + stable)
        label = "harmful" if confidence > 0.8 and pred != 0 else "safe"

        return {
            "label": label,
            "confidence": float(confidence),
            "class": int(pred)
        }

    except Exception as e:
        print("❌ ML ERROR:", str(e))
        return {
            "label": "safe",
            "confidence": 0,
            "error": "ML failed"
        }