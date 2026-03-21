from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

app = FastAPI()

MODEL_NAME = "Shrutigunu/hate-speech-roberta"

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)

model.eval()

class InputText(BaseModel):
    text: str

@app.get("/")
def home():
    return {"message": "RoBERTa Hate Speech API running"}

@app.post("/predict")
def predict(input: InputText):
    inputs = tokenizer(
        input.text,
        return_tensors="pt",
        truncation=True,
        padding=True
    )

    with torch.no_grad():
        outputs = model(**inputs)

    probs = torch.softmax(outputs.logits, dim=1)
    pred = torch.argmax(probs).item()
    confidence = probs.max().item()

    # ✅ FIXED LOGIC
    if pred == 0 and confidence > 0.9:
        label = "harmful"
    elif pred == 1 and confidence > 0.8:
        label = "harmful"
    else:
        label = "safe"

    return {
        "label": label,
        "confidence": confidence,
        "class": pred
    }