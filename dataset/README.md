\# Dataset Description



This dataset is used for training the hate speech and crime detection model.



\## Content

The dataset contains textual data labeled for identifying different types of harmful content, including hate speech and offensive language.



\## Original Labels

The dataset consists of multiple categories:



\- 0 → Hate Speech  

\- 1 → Offensive Language  

\- 2 → Neither (Safe)  



\## Label Processing

For the purpose of model training, these labels were simplified into a binary classification problem:



\- 0 → Safe (original label 2)  

\- 1 → Harmful (original labels 0 and 1 combined)  



This transformation was performed during preprocessing in the training notebook to improve model generalization and simplify the classification task.



\## Purpose

The dataset was used to train and evaluate a RoBERTa-based model for detecting harmful or sensitive content in text.

