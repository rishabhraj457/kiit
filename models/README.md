\# AI-Based Hate Speech and Crime Detection Model



\## Overview

This module focuses on detecting hate speech and crime-related content from textual data using Natural Language Processing. The goal was to build a model that can understand context and classify text accurately into safe or harmful categories.



\## Model Used

\- RoBERTa (for text classification)



RoBERTa was selected due to its strong performance in understanding contextual meaning in language.



\## What I Did

I worked on the complete machine learning pipeline, which includes:



\- Preparing and organizing the dataset

\- Cleaning and preprocessing textual data

\- Tokenizing text using transformer-based tokenizers

\- Training the RoBERTa model on labeled data

\- Evaluating model performance

\- Fine-tuning the model for better accuracy



Additionally, a Large Language Model (LLM) was used to enhance the system by improving contextual understanding and refining the interpretation of predictions, especially for complex or ambiguous inputs.



\## Labels

The original dataset contained multiple categories (such as hate speech, offensive language, etc.), but for better generalization and clarity, the labels were simplified during training as:



\- 0 → Safe  

\- 1 → Harmful  



This allowed the model to focus on identifying whether content is safe or potentially harmful, rather than overfitting to very specific categories.



\## Model Deployment

The trained model is hosted on Hugging Face instead of GitHub to avoid large file storage issues and to allow easy access.



Hugging Face Model Link:

https://huggingface.co/Shrutigunu/hate-speech-roberta



\## Notebook

The complete training and experimentation process is documented in the notebook provided in this folder.



\## Conclusion

This model serves as the core intelligence of the system and can be integrated into applications for real-time detection of harmful or sensitive content.

