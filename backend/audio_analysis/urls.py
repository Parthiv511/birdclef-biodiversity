from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health_check, name="health_check"),
    path("upload/", views.upload_audio, name="upload_audio"),
    path(
        "biodiversity/",
        views.biodiversity_dashboard,
        name="biodiversity_dashboard",
    ),
]