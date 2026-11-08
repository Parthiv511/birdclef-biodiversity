import sys
import torch
import librosa
from transformers import pipeline

MODEL_ID = "MIT/ast-finetuned-audioset-10-10-0.4593"

def main():
    print("=" * 55)
    print("BirdCLEF+ Audio Screening Test")
    print("=" * 55)

    device = 0 if torch.cuda.is_available() else -1

    print("PyTorch:", torch.__version__)
    print("CUDA available:", torch.cuda.is_available())
    print("Device:", torch.cuda.get_device_name(0) if device == 0 else "CPU")
    print("\nLoading pretrained AudioSet screening model...")
    print("First load may take time because model files must download.")

    classifier = pipeline(
        task="audio-classification",
        model=MODEL_ID,
        device=device
    )

    print("Model loaded successfully!")

    audio_path = input(
        "\nEnter the full path to a test audio file: "
    ).strip().strip('"')

    print("\nLoading audio...")
    waveform, sample_rate = librosa.load(
        audio_path,
        sr=16000,
        mono=True
    )

    if len(waveform) == 0:
        raise ValueError("The audio file contains no samples.")

    print("Sample rate:", sample_rate)
    print("Duration:", round(len(waveform) / sample_rate, 2), "seconds")

    # Test a maximum of 10 seconds to keep the initial test manageable.
    test_audio = waveform[:sample_rate * 10]

    print("\nRunning audio classification...")
    results = classifier(
        {
            "array": test_audio,
            "sampling_rate": sample_rate
        },
        top_k=10
    )

    print("\nTop screening predictions:")
    for item in results:
        print(
            f"{item['label']}: "
            f"{item['score'] * 100:.2f}%"
        )

    print("\nScreening test completed.")
    print("These scores are screening-model outputs, not")
    print("confirmed wildlife species predictions.")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("\nSCREENING TEST FAILED")
        print(type(exc).__name__ + ":", exc)
        sys.exit(1)
