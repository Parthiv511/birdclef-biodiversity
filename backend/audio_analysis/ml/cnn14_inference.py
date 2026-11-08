
import sys
import csv
import os

from pathlib import Path
from functools import lru_cache

import numpy as np
import soundfile as sf
import librosa
import torch

from huggingface_hub import hf_hub_download


# ============================================================
# PROJECT PATHS
# ============================================================

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent

PANN_REPO = PROJECT_DIR / "audioset_tagging_cnn"
PANN_PYTORCH = PANN_REPO / "pytorch"

CLASS_MAPPING_PATH = PROJECT_DIR / "class_mapping_234.csv"


# ============================================================
# HUGGING FACE CONFIGURATION
# ============================================================

HF_REPO_ID = "GantaParthiv/birdclef-cnn14-234"

HF_CHECKPOINT_FILENAME = "cnn14_birdclef234_main_latest.pth"

# Priority:
# 1. HF_TOKEN environment variable
# 2. Locally saved Hugging Face CLI authentication

HF_TOKEN = os.getenv("HF_TOKEN")


# ============================================================
# CNN14 MODEL CONFIGURATION
# ============================================================

if not PANN_PYTORCH.exists():
    raise FileNotFoundError(
        f"PANNs PyTorch repository not found: {PANN_PYTORCH}"
    )

sys.path.insert(0, str(PANN_PYTORCH))

from models import Cnn14


SAMPLE_RATE = 32000
WINDOW_SIZE = 1024
HOP_SIZE = 320
MEL_BINS = 64
FMIN = 50
FMAX = 14000

NUM_CLASSES = 234

AUDIO_DURATION = 5
TARGET_SAMPLES = SAMPLE_RATE * AUDIO_DURATION

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)


# ============================================================
# LOAD CLASS MAPPING
# ============================================================

@lru_cache(maxsize=1)
def load_class_mapping():

    if not CLASS_MAPPING_PATH.exists():
        raise FileNotFoundError(
            f"Class mapping not found: {CLASS_MAPPING_PATH}"
        )

    with CLASS_MAPPING_PATH.open(
        "r",
        encoding="utf-8-sig",
        newline=""
    ) as file:

        rows = list(csv.DictReader(file))

    if len(rows) != NUM_CLASSES:
        raise ValueError(
            f"Expected {NUM_CLASSES} classes, found {len(rows)}"
        )

    mapping = {}

    for row in rows:

        index = int(row["class_index"])

        if index in mapping:
            raise ValueError(
                f"Duplicate class index: {index}"
            )

        mapping[index] = {
            "class_id": row["class_id"],
            "scientific_name": row["scientific_name"],
            "common_name": row["common_name"],
            "class_name": row["class_name"],
        }

    if set(mapping.keys()) != set(range(NUM_CLASSES)):
        raise ValueError(
            "Class indices must range from 0 to 233."
        )

    return mapping


# ============================================================
# DOWNLOAD CNN14 CHECKPOINT FROM HUGGING FACE
# ============================================================

@lru_cache(maxsize=1)
def download_cnn14_checkpoint():

    print(
        "Checking Hugging Face authentication..."
    )

    print(
        f"Repository: {HF_REPO_ID}"
    )

    print(
        "Downloading/checking CNN14 checkpoint..."
    )

    try:

        checkpoint_path = hf_hub_download(
            repo_id=HF_REPO_ID,
            filename=HF_CHECKPOINT_FILENAME,
            repo_type="model",
            token=HF_TOKEN if HF_TOKEN else True,
        )

    except Exception as error:

        raise RuntimeError(
            "Failed to download CNN14 checkpoint from Hugging Face. "
            "Verify your authentication, repository access, "
            "repository ID and checkpoint filename."
        ) from error

    checkpoint_path = Path(checkpoint_path)

    if not checkpoint_path.exists():
        raise FileNotFoundError(
            f"Downloaded checkpoint not found: {checkpoint_path}"
        )

    print(
        f"CNN14 checkpoint available: {checkpoint_path}"
    )

    print(
        f"Checkpoint size: "
        f"{checkpoint_path.stat().st_size / (1024 ** 2):.2f} MB"
    )

    return str(checkpoint_path)


# ============================================================
# LOAD CNN14 MODEL
# ============================================================

@lru_cache(maxsize=1)
def get_cnn14_model():

    print(
        f"Initializing CNN14 on {DEVICE}..."
    )

    checkpoint_path = download_cnn14_checkpoint()

    model = Cnn14(
        sample_rate=SAMPLE_RATE,
        window_size=WINDOW_SIZE,
        hop_size=HOP_SIZE,
        mel_bins=MEL_BINS,
        fmin=FMIN,
        fmax=FMAX,
        classes_num=NUM_CLASSES,
    )

    print(
        "Loading CNN14 checkpoint weights..."
    )

    # The checkpoint is your own trusted training artifact.
    checkpoint = torch.load(
        checkpoint_path,
        map_location="cpu",
        weights_only=False,
    )

    if "model_state_dict" not in checkpoint:
        raise KeyError(
            "The checkpoint does not contain model_state_dict."
        )

    model.load_state_dict(
        checkpoint["model_state_dict"],
        strict=True,
    )

    model.to(DEVICE)

    model.eval()

    print(
        f"CNN14 loaded successfully on {DEVICE}"
    )

    return model


# ============================================================
# AUDIO LOADING AND PREPROCESSING
# ============================================================

def load_audio(audio_path):

    audio, original_sr = sf.read(
        str(audio_path),
        dtype="float32",
        always_2d=True,
    )

    # Convert stereo/multichannel audio into mono.
    audio = np.mean(audio, axis=1)

    if audio.size == 0:
        raise ValueError(
            "Uploaded audio contains no samples."
        )

    if not np.isfinite(audio).all():
        raise ValueError(
            "Audio contains invalid samples."
        )

    if original_sr <= 0:
        raise ValueError(
            "Invalid audio sample rate."
        )

    # Resample audio to 32 kHz.
    if original_sr != SAMPLE_RATE:

        audio = librosa.resample(
            audio,
            orig_sr=original_sr,
            target_sr=SAMPLE_RATE,
        )

    if audio.size == 0:
        raise ValueError(
            "Audio is empty after resampling."
        )

    return audio.astype(np.float32)


# ============================================================
# CREATE 5-SECOND AUDIO WINDOWS
# ============================================================

def create_audio_windows(audio):

    windows = []

    for start in range(0, len(audio), TARGET_SAMPLES):

        window = audio[
            start:start + TARGET_SAMPLES
        ]

        # Pad the final incomplete window.
        if len(window) < TARGET_SAMPLES:

            window = np.pad(
                window,
                (0, TARGET_SAMPLES - len(window)),
            )

        windows.append(window)

    return windows


# ============================================================
# FORMAT SPECIES PREDICTIONS
# ============================================================

def format_predictions(
    scores,
    indices,
    class_mapping
):

    results = []

    for index, score in zip(indices, scores):

        class_index = int(index.item())

        species = class_mapping[class_index]

        results.append({

            "class_index": class_index,

            "species_id": species["class_id"],

            "scientific_name": species["scientific_name"],

            "common_name": species["common_name"],

            "taxonomic_class": species["class_name"],

            "confidence": round(
                float(score.item()),
                6
            ),

        })

    return results


# ============================================================
# MAIN CNN14 SPECIES PREDICTION
# ============================================================

def predict_species(audio_path, top_k=10):

    if not isinstance(top_k, int) or isinstance(top_k, bool):
        raise ValueError(
            "top_k must be an integer."
        )

    if not 1 <= top_k <= NUM_CLASSES:
        raise ValueError(
            f"top_k must be between 1 and {NUM_CLASSES}."
        )

    # Load cached CNN14 model.
    model = get_cnn14_model()

    # Load cached 234-class mapping.
    class_mapping = load_class_mapping()

    # Load and preprocess uploaded audio.
    audio = load_audio(audio_path)

    # Divide audio into 5-second windows.
    windows = create_audio_windows(audio)

    if not windows:
        raise ValueError(
            "No valid audio windows were generated."
        )

    audio_duration = len(audio) / SAMPLE_RATE

    predictions = []

    window_predictions = []

    # ========================================================
    # CNN14 INFERENCE
    # ========================================================

    with torch.inference_mode():

        for window_index, window in enumerate(windows):

            waveform = torch.from_numpy(
                window
            ).unsqueeze(0).to(DEVICE)

            output = model(waveform)

            probabilities = output["clipwise_output"]

            window_scores = probabilities.squeeze(
                0
            ).cpu()

            predictions.append(window_scores)

            # Top-k predictions for this window.
            scores, indices = torch.topk(
                window_scores,
                k=top_k,
            )

            start_time = window_index * AUDIO_DURATION

            end_time = min(
                start_time + AUDIO_DURATION,
                audio_duration,
            )

            window_predictions.append({

                "window_index": window_index + 1,

                "start_time": round(start_time, 3),

                "end_time": round(end_time, 3),

                "predictions": format_predictions(
                    scores,
                    indices,
                    class_mapping,
                ),

            })

    # ========================================================
    # OVERALL PREDICTION AGGREGATION
    # ========================================================

    # Preserve the existing mean aggregation logic.
    final_predictions = torch.stack(
        predictions
    ).mean(dim=0)

    scores, indices = torch.topk(
        final_predictions,
        k=top_k,
    )

    results = format_predictions(
        scores,
        indices,
        class_mapping,
    )

    # ========================================================
    # FINAL RESPONSE
    # ========================================================

    return {

        "success": True,

        "model": "PANNs CNN14",

        "total_classes": NUM_CLASSES,

        "audio_duration": round(
            audio_duration,
            3
        ),

        "windows_analyzed": len(windows),

        "predictions": results,

        "window_predictions": window_predictions,

    }
