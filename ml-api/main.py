from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 🔥 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_NAME = "Shrutigunu/hate-speech-roberta"

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

        # 🔥 Correct label mapping
        id2label = model.config.id2label
        pred_label = id2label[pred].lower()

        label = "harmful" if "hate" in pred_label or "offensive" in pred_label else "safe"

        return {
            "label": label,
            "confidence": float(confidence),
            "class": int(pred),
            "raw_label": pred_label
        }

    except Exception as e:
        print("❌ ML ERROR:", str(e))
        return {
            "label": "safe",
            "confidence": 0,
            "error": "ML failed"
        }