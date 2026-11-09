from typing import Any, cast

import requests

from django.conf import settings
from django.http import JsonResponse
from django.core.files.uploadedfile import UploadedFile
from django.db import transaction
from django.db.models import Count

from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status

from .serializers import AudioUploadSerializer

from .models import (
    AudioRecording,
    SpeciesPrediction,
    WindowPrediction,
)


# ============================================================
# INFERENCE SERVICE CONFIGURATION
# ============================================================

INFERENCE_SERVICE_URL = settings.INFERENCE_SERVICE_URL.rstrip("/")

SCREENING_TIMEOUT = (10, 300)
CNN14_TIMEOUT = (10, 900)


# ============================================================
# BACKEND HEALTH CHECK
# ============================================================

def health_check(request):
    """Verify that the BirdCLEF+ backend is running."""

    return JsonResponse({
        "success": True,
        "message": "BirdCLEF+ backend is running!",
        "project": "BirdCLEF+ 2026 Biodiversity Analysis",
        "status": "healthy",
    })


# ============================================================
# AUDIO UPLOAD AND INFERENCE
# ============================================================

@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def upload_audio(request):
    """
    Validate uploaded audio, perform AST wildlife screening
    through FastAPI, run CNN14 inference through FastAPI,
    and save analysis results in the Django database.
    """

    # --------------------------------------------------------
    # STEP 1: Validate uploaded audio.
    # --------------------------------------------------------

    serializer = AudioUploadSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {
                "success": False,
                "message": "Audio validation failed.",
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    validated_data = cast(
        dict[str, Any],
        serializer.validated_data,
    )

    audio_file = validated_data.get("audio")

    if not isinstance(audio_file, UploadedFile):
        return Response(
            {
                "success": False,
                "message": "A valid uploaded audio file is required.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # --------------------------------------------------------
    # STEP 2: Run AST wildlife screening through FastAPI.
    # --------------------------------------------------------

    try:
        audio_file.seek(0)

        screening_response = requests.post(
            f"{INFERENCE_SERVICE_URL}/screen/",
            files={
                "audio": (
                    audio_file.name,
                    audio_file,
                    audio_file.content_type or "application/octet-stream",
                )
            },
            timeout=SCREENING_TIMEOUT,
        )

        screening_response.raise_for_status()

        screening_result = screening_response.json()

        # Reset the uploaded file for the CNN14 request.
        audio_file.seek(0)

    except requests.RequestException:
        return Response(
            {
                "success": False,
                "message": (
                    "Could not connect to the wildlife screening service."
                ),
                "filename": audio_file.name,
                "analysis_status": "screening_failed",
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    except (ValueError, KeyError, TypeError):
        return Response(
            {
                "success": False,
                "message": (
                    "The wildlife screening service returned "
                    "an invalid response."
                ),
                "filename": audio_file.name,
                "analysis_status": "screening_failed",
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )

    except Exception:
        return Response(
            {
                "success": False,
                "message": "Wildlife screening failed. Please try again.",
                "filename": audio_file.name,
                "analysis_status": "screening_failed",
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # --------------------------------------------------------
    # STEP 3: Warn when wildlife screening does not pass.
    # --------------------------------------------------------

    if not screening_result.get("is_wildlife_related", False):
        return Response(
            {
                "success": True,
                "status": "warning",
                "is_wildlife_related": False,
                "message": screening_result.get(
                    "message",
                    "The audio may not contain wildlife-related sounds.",
                ),
                "filename": audio_file.name,
                "size_bytes": audio_file.size,
                "analysis_status": "warning",
                "screening_predictions": screening_result.get(
                    "screening_predictions",
                    [],
                ),
                "note": (
                    "This preliminary screening does not prove "
                    "that wildlife is absent."
                ),
            },
            status=status.HTTP_200_OK,
        )

    # --------------------------------------------------------
    # STEP 4: Run CNN14 species inference through FastAPI.
    # --------------------------------------------------------

    try:
        audio_file.seek(0)

        cnn14_response = requests.post(
            f"{INFERENCE_SERVICE_URL}/predict/",
            files={
                "audio": (
                    audio_file.name,
                    audio_file,
                    audio_file.content_type or "application/octet-stream",
                )
            },
            timeout=CNN14_TIMEOUT,
        )

        cnn14_response.raise_for_status()

        cnn14_result = cnn14_response.json()

        # Validate essential inference response fields.
        required_fields = [
            "audio_duration",
            "total_classes",
            "windows_analyzed",
            "model",
            "predictions",
            "window_predictions",
        ]

        for field in required_fields:
            if field not in cnn14_result:
                raise ValueError(
                    f"CNN14 response is missing the '{field}' field."
                )

    except requests.Timeout:
        return Response(
            {
                "success": False,
                "status": "inference_timeout",
                "message": (
                    "CNN14 inference took too long. Please try again."
                ),
                "filename": audio_file.name,
                "analysis_status": "inference_failed",
            },
            status=status.HTTP_504_GATEWAY_TIMEOUT,
        )

    except requests.RequestException:
        return Response(
            {
                "success": False,
                "status": "inference_service_unavailable",
                "message": (
                    "Could not connect to the CNN14 inference service."
                ),
                "filename": audio_file.name,
                "analysis_status": "inference_failed",
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    except (ValueError, KeyError, TypeError):
        return Response(
            {
                "success": False,
                "status": "invalid_inference_response",
                "message": (
                    "The CNN14 service returned an invalid response."
                ),
                "filename": audio_file.name,
                "analysis_status": "inference_failed",
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )

    except Exception:
        return Response(
            {
                "success": False,
                "status": "inference_failed",
                "message": (
                    "Wildlife screening passed, but CNN14 "
                    "species inference failed."
                ),
                "filename": audio_file.name,
                "analysis_status": "inference_failed",
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # --------------------------------------------------------
    # STEP 5: Save analysis results in the database.
    # --------------------------------------------------------

    try:
        with transaction.atomic():

            # Save recording information.
            recording = AudioRecording.objects.create(
                filename=audio_file.name,
                audio_duration=cnn14_result["audio_duration"],
                sample_rate=32000,
                total_classes=cnn14_result["total_classes"],
                windows_analyzed=cnn14_result["windows_analyzed"],
                model_name=cnn14_result["model"],
            )

            # Save overall species predictions.
            overall_predictions = []

            for prediction in cnn14_result["predictions"]:

                overall_predictions.append(
                    SpeciesPrediction(
                        recording=recording,
                        class_index=prediction["class_index"],
                        species_id=prediction["species_id"],
                        scientific_name=prediction["scientific_name"],
                        common_name=prediction["common_name"],
                        taxonomic_class=prediction["taxonomic_class"],
                        model_score=prediction["confidence"],
                    )
                )

            SpeciesPrediction.objects.bulk_create(
                overall_predictions
            )

            # Save individual five-second window predictions.
            window_prediction_objects = []

            for window in cnn14_result["window_predictions"]:

                for prediction in window["predictions"]:

                    window_prediction_objects.append(
                        WindowPrediction(
                            recording=recording,
                            window_index=window["window_index"],
                            start_time=window["start_time"],
                            end_time=window["end_time"],
                            class_index=prediction["class_index"],
                            species_id=prediction["species_id"],
                            scientific_name=prediction["scientific_name"],
                            common_name=prediction["common_name"],
                            taxonomic_class=prediction["taxonomic_class"],
                            model_score=prediction["confidence"],
                        )
                    )

            WindowPrediction.objects.bulk_create(
                window_prediction_objects
            )

    except Exception:
        return Response(
            {
                "success": False,
                "status": "database_save_failed",
                "message": (
                    "CNN14 inference completed, but saving "
                    "the analysis results failed."
                ),
                "filename": audio_file.name,
                "analysis_status": "database_save_failed",
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # --------------------------------------------------------
    # STEP 6: Return successful analysis response.
    # --------------------------------------------------------

    return Response(
        {
            "success": True,
            "status": "analysis_completed",
            "is_wildlife_related": True,
            "message": (
                "Wildlife screening and CNN14 inference completed."
            ),
            "filename": audio_file.name,
            "size_bytes": audio_file.size,
            "analysis_status": "completed",
            "recording_id": recording.pk,
            "screening_predictions": (
                screening_result.get("screening_predictions", [])
            ),
            "species_analysis": cnn14_result,
        },
        status=status.HTTP_200_OK,
    )


# ============================================================
# BIODIVERSITY DASHBOARD
# ============================================================

@api_view(["GET"])
def biodiversity_dashboard(request):
    """
    Retrieve biodiversity analytics from analyzed audio recordings.
    """

    TAXONOMIC_GROUPS = {
        "Aves": "Birds",
        "Mammalia": "Mammals",
        "Amphibia": "Amphibians",
        "Reptilia": "Reptiles",
        "Insecta": "Insects",
    }

    # STEP 1: Retrieve analyzed recordings.
    recordings = AudioRecording.objects.all()

    total_recordings = recordings.count()

    # STEP 2: Calculate overall prediction statistics.
    total_predictions = SpeciesPrediction.objects.count()

    unique_species = (
        SpeciesPrediction.objects
        .values("species_id")
        .distinct()
        .count()
    )

    # STEP 3: Calculate taxonomic distribution.
    taxonomic_data = (
        SpeciesPrediction.objects
        .values("taxonomic_class")
        .annotate(
            species_count=Count(
                "species_id",
                distinct=True,
            )
        )
        .order_by("-species_count")
    )

    taxonomic_distribution = [
        {
            "taxonomic_class": item["taxonomic_class"],
            "group_name": TAXONOMIC_GROUPS.get(
                item["taxonomic_class"],
                item["taxonomic_class"],
            ),
            "species_count": item["species_count"],
        }
        for item in taxonomic_data
    ]

    # STEP 4: Calculate top 10 frequently predicted species.
    top_species_data = (
        SpeciesPrediction.objects
        .values(
            "species_id",
            "scientific_name",
            "common_name",
            "taxonomic_class",
        )
        .annotate(
            recording_count=Count(
                "recording_id",
                distinct=True,
            )
        )
        .order_by("-recording_count", "scientific_name")[:10]
    )

    top_species = [
        {
            "species_id": item["species_id"],
            "scientific_name": item["scientific_name"],
            "common_name": item["common_name"],
            "taxonomic_class": item["taxonomic_class"],
            "group_name": TAXONOMIC_GROUPS.get(
                item["taxonomic_class"],
                item["taxonomic_class"],
            ),
            "recording_count": item["recording_count"],
        }
        for item in top_species_data
    ]

    # STEP 5: Calculate species richness per recording.
    richness_data = (
        SpeciesPrediction.objects
        .values("recording_id")
        .annotate(
            species_richness=Count(
                "species_id",
                distinct=True,
            )
        )
    )

    richness_map = {
        item["recording_id"]: item["species_richness"]
        for item in richness_data
    }

    species_richness = [
        {
            "recording_id": recording.pk,
            "species_richness": richness_map.get(
                recording.pk,
                0,
            ),
        }
        for recording in recordings
    ]

    # STEP 6: Calculate average species richness.
    richness_values = list(richness_map.values())

    average_species_richness = (
        round(
            sum(richness_values) / len(richness_values),
            2,
        )
        if richness_values
        else 0
    )

    # STEP 7: Retrieve the 20 most recent recordings.
    recent_recordings = recordings[:20]

    recording_history = [
        {
            "recording_id": recording.pk,
            "filename": recording.filename,
            "audio_duration": recording.audio_duration,
            "windows_analyzed": recording.windows_analyzed,
            "model_name": recording.model_name,
            "species_richness": richness_map.get(
                recording.pk,
                0,
            ),
            "analyzed_at": recording.analyzed_at.isoformat(),
        }
        for recording in recent_recordings
    ]

    # STEP 8: Return biodiversity analytics.
    return Response(
        {
            "success": True,

            "summary": {
                "total_recordings": total_recordings,
                "unique_species": unique_species,
                "total_predictions": total_predictions,
                "average_species_richness": average_species_richness,
            },

            "taxonomic_distribution": taxonomic_distribution,

            "top_species": top_species,

            "species_richness": species_richness,

            "recording_history": recording_history,

            "note": (
                "These statistics represent model-predicted "
                "species detections, not scientifically confirmed "
                "ecological observations."
            ),
        },
        status=status.HTTP_200_OK,
    )