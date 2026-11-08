# BirdCLEF+ Biodiversity Analysis System

An AI-powered multi-species bioacoustic detection and biodiversity analysis platform using AST and PANNs CNN14.

## Project Overview

The system analyzes uploaded audio recordings to identify wildlife species and generate biodiversity insights.

It supports multi-label wildlife species detection across 234 target classes.

## Technology Stack

**Frontend**
- React.js
- Vite
- JavaScript

**Backend**
- Python
- Django
- Django REST Framework

**Machine Learning**
- AST AudioSet classifier
- PANNs CNN14
- PyTorch
- Librosa
- SoundFile

**Database**
- SQLite (local development)
- PostgreSQL (production target)

**Model Hosting**
- Hugging Face Hub

## Key Features

- Multiple audio file uploads.
- Audio validation.
- Unrelated audio screening.
- Wildlife species identification.
- 234 target species classes.
- Five-second audio window analysis.
- Confidence scores.
- Biodiversity analytics dashboard.
- Persistent analysis results.

## Model Pipeline

1. Audio upload.
2. Audio validation.
3. AST-based unrelated audio screening.
4. Five-second audio segmentation.
5. CNN14 wildlife species inference.
6. Multi-label species prediction.
7. Prediction aggregation.
8. Database storage.
9. Biodiversity dashboard visualization.

## Model Checkpoint

The CNN14 checkpoint is hosted in a private Hugging Face repository.

The checkpoint is excluded from GitHub because of its large size.

The backend requires an `HF_TOKEN` environment variable to access the private checkpoint during deployment.

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

## Deployment Plan

- Backend: Render Web Service
- Frontend: Render Static Site
- Model checkpoint: Hugging Face Hub

## Project Status

Local development, model integration, frontend integration, database integration, and functional testing have been completed.

Production deployment is in progress.
