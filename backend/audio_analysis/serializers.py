from pathlib import Path

import soundfile as sf
from rest_framework import serializers


ALLOWED_AUDIO_EXTENSIONS = {
    ".wav",
    ".mp3",
    ".ogg",
    ".flac",
}

MAX_AUDIO_SIZE = 50 * 1024 * 1024  # 50 MB


class AudioUploadSerializer(serializers.Serializer):
    audio = serializers.FileField()

    def validate_audio(self, value):
        """Validate file extension, size, and audio decoding."""

        filename = value.name.lower()
        extension = Path(filename).suffix

        # 1. Check the file extension.
        if extension not in ALLOWED_AUDIO_EXTENSIONS:
            raise serializers.ValidationError(
                "Unsupported audio format. Upload WAV, MP3, OGG, or FLAC."
            )

        # 2. Reject empty files.
        if value.size == 0:
            raise serializers.ValidationError(
                "The uploaded audio file is empty."
            )

        # 3. Enforce the maximum upload size.
        if value.size > MAX_AUDIO_SIZE:
            raise serializers.ValidationError(
                "The audio file exceeds the 50 MB limit."
            )

        # 4. Verify that the file contains decodable audio.
        try:
            value.seek(0)

            audio_data, sample_rate = sf.read(
                value,
                dtype="float32",
                always_2d=True,
            )

            if audio_data.size == 0:
                raise serializers.ValidationError(
                    "The uploaded audio contains no audio samples."
                )

            if sample_rate <= 0:
                raise serializers.ValidationError(
                    "The audio sample rate is invalid."
                )

        except serializers.ValidationError:
            raise

        except Exception as exc:
            raise serializers.ValidationError(
                "The file is not valid or decodable audio."
            ) from exc

        finally:
            value.seek(0)

        return value