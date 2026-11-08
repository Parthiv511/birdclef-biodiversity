# BirdCLEF+ Biodiversity Analysis System

An AI-powered multi-species bioacoustic detection and biodiversity analysis platform using Audio Spectrogram Transformer (AST) and PANNs CNN14.

## Project Overview

This application analyzes uploaded audio recordings to identify wildlife species and generate biodiversity insights.

It supports multi-label species detection across 234 target classes.

## Technology Stack

### Frontend
- React.js
- Vite
- JavaScript
- CSS

### Backend
- Python
- Django
- Django REST Framework

### Machine Learning
- AST AudioSet classifier for unrelated-audio screening
- PANNs CNN14 for wildlife species inference
- PyTorch
- Librosa
- SoundFile

### Database
- SQLite (local development)
- PostgreSQL (production deployment target)

### Model Hosting
- Hugging Face Hub

## Key Features

- Multiple audio file uploads.
- Audio validation and unrelated-audio screening.
- Wildlife species identification.
- Multi-label predictions across 234 target classes.
- Five-second audio window analysis.
- Confidence scores for predicted species.
- Biodiversity analytics dashboard.
- Database persistence of analysis results.

## Model Architecture

1. Upload audio recording.
2. Validate audio input.
3. Use AST to screen unrelated audio.
4. Process wildlife recordings using CNN14.
5. Generate five-second audio windows.
6. Predict species across 234 classes.
7. Aggregate predictions and confidence scores.
8. Store analysis results.
9. Display results on the dashboard.

## Model Checkpoint

The CNN14 checkpoint is hosted in a private Hugging Face repository.

The checkpoint is intentionally excluded from GitHub because of its large size.

Configure the `HF_TOKEN` environment variable in the backend deployment environment to access the private checkpoint.

## Local Development

### Backend

```bash
cd backend
pip install -r requirements.txt
python manage.py runserver
```

### Frontend

```bash
npm install
npm run dev
```

## Deployment

Planned deployment:
- Backend: Render Web Service
- Frontend: Render Static Site
- Model checkpoint: Hugging Face Hub

## Project Status

Local development, model integration, API testing, frontend integration, and database integration have been completed.

Production deployment is in progress.
