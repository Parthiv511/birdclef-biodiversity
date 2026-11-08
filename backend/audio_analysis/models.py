from django.db import models


class AudioRecording(models.Model):
    """
    Stores information about an uploaded and analyzed audio recording.
    """

    filename = models.CharField(max_length=255)

    audio_duration = models.FloatField(default=0.0)

    sample_rate = models.IntegerField(default=32000)

    total_classes = models.IntegerField(default=234)

    windows_analyzed = models.IntegerField(default=0)

    model_name = models.CharField(
        max_length=100,
        default="PANNs CNN14",
    )

    analyzed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-analyzed_at"]

    def __str__(self):
        return self.filename


class SpeciesPrediction(models.Model):
    """
    Stores overall species predictions for an audio recording.
    """

    recording = models.ForeignKey(
        AudioRecording,
        on_delete=models.CASCADE,
        related_name="species_predictions",
    )

    class_index = models.IntegerField()

    species_id = models.CharField(max_length=100)

    scientific_name = models.CharField(max_length=255)

    common_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    taxonomic_class = models.CharField(max_length=100)

    model_score = models.FloatField()

    class Meta:
        ordering = ["-model_score"]

    def __str__(self):
        return self.scientific_name


class WindowPrediction(models.Model):
    """
    Stores species predictions for individual 5-second audio windows.
    """

    recording = models.ForeignKey(
        AudioRecording,
        on_delete=models.CASCADE,
        related_name="window_predictions",
    )

    window_index = models.IntegerField()

    start_time = models.FloatField()

    end_time = models.FloatField()

    class_index = models.IntegerField()

    species_id = models.CharField(max_length=100)

    scientific_name = models.CharField(max_length=255)

    common_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    taxonomic_class = models.CharField(max_length=100)

    model_score = models.FloatField()

    class Meta:
        ordering = ["window_index", "-model_score"]

    def __str__(self):
        return (
            f"{self.scientific_name} - "
            f"Window {self.window_index}"
        )