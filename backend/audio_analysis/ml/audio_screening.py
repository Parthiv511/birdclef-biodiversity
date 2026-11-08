from functools import lru_cache
from pathlib import Path
import tempfile

import librosa
import numpy as np
import torch
from transformers import pipeline


MODEL_NAME = "MIT/ast-finetuned-audioset-10-10-0.4593"

SAMPLE_RATE = 16000
MAX_SCREENING_SECONDS = 10

# AudioSet labels that may indicate wildlife-related sounds.
WILDLIFE_LABELS = (
    "bird",
    "animal",
    "wild",
    "frog",
    "insect",
    "cricket",
    "chirping",
    "croaking",
    "hoot",
    "owl",
    "duck",
    "goose",
    "rooster",
    "chicken",
    "cuckoo",
    "woodpecker",
    "snake",
    "bat",
    "whale",
    "dolphin",
    "howl",
    "growling",
    "pigeon",
    "crow",
    "gull",
    "sparrow",
    "canary",
    "mynah",
    "parrot",
    "animal sounds",
)


@lru_cache(maxsize=1)
def get_screening_model():
    """Load the screening model once and reuse it."""

    device = 0 if torch.cuda.is_available() else -1

    return pipeline(
        task="audio-classification",
        model=MODEL_NAME,
        device=device,
    )


def screen_audio(audio_path: str | Path) -> dict:
    """
    Screen an audio recording for possible wildlife relevance.

    This model provides preliminary screening, not definitive
    wildlife detection.
    """

    audio, _ = librosa.load(
        str(audio_path),
        sr=SAMPLE_RATE,
        mono=True,
        duration=MAX_SCREENING_SECONDS,
    )

    if audio.size == 0 or not np.isfinite(audio).all():
        raise ValueError("The audio contains no usable samples.")

    model = get_screening_model()

    predictions = model(
        {
            "raw": audio,
            "sampling_rate": SAMPLE_RATE,
        },
        top_k=10,
    )

    formatted_predictions = [
        {
            "label": str(item["label"]),
            "confidence": round(float(item["score"]), 4),
        }
        for item in predictions
    ]

    wildlife_matches = [
        item
        for item in formatted_predictions
        if any(
            keyword in item["label"].lower()
            for keyword in WILDLIFE_LABELS
        )
    ]

    # This is a preliminary decision based on the model's top predictions.
    # A wildlife label is not proof that the recording contains wildlife.
    likely_wildlife = bool(wildlife_matches)

    if likely_wildlife:
        message = (
            "The audio may contain wildlife-related sounds."
        )
    else:
        message = (
            "This audio may not contain wildlife sounds. "
            "Please upload a BirdCLEF-related wildlife recording."
        )

    return {
        "is_wildlife_related": likely_wildlife,
        "message": message,
        "screening_predictions": formatted_predictions,
    }


def screen_uploaded_file(uploaded_file) -> dict:
    """Screen an uploaded file using a temporary file."""

    suffix = Path(uploaded_file.name).suffix
    temporary_path = None

    try:
        with tempfile.NamedTemporaryFile(
            suffix=suffix,
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)

            for chunk in uploaded_file.chunks():
                temporary_file.write(chunk)

        return screen_audio(temporary_path)

    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)