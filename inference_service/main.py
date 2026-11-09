import sys
import tempfile

from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException

# ============================================================
# PROJECT PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent

ML_MODULE_PATH = (
    PROJECT_ROOT / "backend" / "audio_analysis" / "ml"
)

# Add existing ML implementation directory to Python path
sys.path.insert(0, str(ML_MODULE_PATH))

# ============================================================
# IMPORT EXISTING AI MODELS
# ============================================================

from audio_screening import screen_audio
from cnn14_inference import predict_species

# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="BirdCLEF AI Inference Service",
    description="AST audio screening and CNN14 wildlife species inference",
    version="1.0.0"
)


# ============================================================
# ROOT ENDPOINT
# ============================================================

@app.get("/")
def root():
    return {
        "success": True,
        "service": "BirdCLEF AI Inference Service",
        "status": "running"
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health/")
def health_check():
    return {
        "success": True,
        "status": "healthy",
        "models": {
            "AST": "available",
            "CNN14": "available"
        }
    }


# ============================================================
# TEMPORARY AUDIO FILE HANDLER
# ============================================================

async def save_uploaded_audio(audio: UploadFile):

    suffix = Path(audio.filename or "audio.wav").suffix

    temporary_path = None

    try:
        with tempfile.NamedTemporaryFile(
            suffix=suffix,
            delete=False
        ) as temp_file:

            temporary_path = Path(temp_file.name)

            while chunk := await audio.read(1024 * 1024):
                temp_file.write(chunk)

        return temporary_path

    except Exception:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)

        raise


# ============================================================
# AST AUDIO SCREENING ENDPOINT
# ============================================================

@app.post("/screen/")
async def screen_uploaded_audio(
    audio: UploadFile = File(...)
):

    temporary_path = None

    try:

        temporary_path = await save_uploaded_audio(audio)

        result = screen_audio(temporary_path)

        return result

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=f"AST screening failed: {str(exc)}"
        )

    finally:

        await audio.close()

        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


# ============================================================
# CNN14 WILDLIFE SPECIES PREDICTION ENDPOINT
# ============================================================

@app.post("/predict/")
async def predict_uploaded_audio(
    audio: UploadFile = File(...)
):

    temporary_path = None

    try:

        temporary_path = await save_uploaded_audio(audio)

        result = predict_species(
            temporary_path,
            top_k=10
        )

        return result

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=f"CNN14 inference failed: {str(exc)}"
        )

    finally:

        await audio.close()

        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)