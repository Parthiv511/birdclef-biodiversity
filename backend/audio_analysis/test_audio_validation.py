from io import BytesIO

import numpy as np
import soundfile as sf

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory

from audio_analysis.views import upload_audio


def create_test_wav():
    """Create a short, valid WAV recording in memory."""
    sample_rate = 32000
    duration = 2

    # Generate a simple test tone.
    t = np.arange(sample_rate * duration) / sample_rate
    audio = 0.2 * np.sin(2 * np.pi * 1000 * t)

    buffer = BytesIO()
    sf.write(buffer, audio, sample_rate, format="WAV")
    buffer.seek(0)

    return buffer.getvalue()


def test_valid_wav():
    """Verify that valid WAV audio passes validation."""
    wav_bytes = create_test_wav()

    uploaded_file = SimpleUploadedFile(
        "test_recording.wav",
        wav_bytes,
        content_type="audio/wav",
    )

    request = APIRequestFactory().post(
        "/api/upload/",
        {"audio": uploaded_file},
        format="multipart",
    )

    response = upload_audio(request)

    assert isinstance(response, Response)

    print("\nValid WAV test")
    print("HTTP status:", response.status_code)
    print("Response:", response.data)

    assert response.status_code == 200
    assert response.data is not None
    assert response.data["success"] is True


def test_corrupted_audio():
    """Verify that corrupted audio data is rejected."""
    uploaded_file = SimpleUploadedFile(
        "corrupted.wav",
        b"This is not valid audio data",
        content_type="audio/wav",
    )

    request = APIRequestFactory().post(
        "/api/upload/",
        {"audio": uploaded_file},
        format="multipart",
    )

    response = upload_audio(request)

    assert isinstance(response, Response)

    print("\nCorrupted audio test")
    print("HTTP status:", response.status_code)
    print("Response:", response.data)

    assert response.status_code == 400
    assert response.data is not None
    assert response.data["success"] is False


if __name__ == "__main__":
    test_valid_wav()
    test_corrupted_audio()

    print("\nAll audio validation tests passed!")
