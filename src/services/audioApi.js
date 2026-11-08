const API_BASE_URL = "http://127.0.0.1:8000/api";

/**
 * Sends one audio file to the Django backend.
 * Backend performs:
 * 1. Audio validation
 * 2. AST-based audio screening
 * 3. CNN14 species inference (if screening passes)
 */
export async function analyzeAudioFile(file) {
    const formData = new FormData();

    // Must match the file field expected by the Django serializer.
    formData.append("audio", file);

    try {
        const response = await fetch(
            `${API_BASE_URL}/upload/`,
            {
                method: "POST",
                body: formData,
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || `Server error: ${response.status}`
            );
        }

        if (!data.success) {
            throw new Error(
                data.message || "Audio analysis failed."
            );
        }

        return data;

    } catch (error) {
        console.error("Audio API Error:", error);

        throw new Error(
            error.message ||
            "Unable to connect to the Biodiversity Dashboard API.",
            { cause: error }
        );
    }
}

/**
 * Checks whether the Django backend is running.
 */
export async function checkBackendHealth() {
    try {
        const response = await fetch(
            `${API_BASE_URL}/health/`
        );

        if (!response.ok) {
            return false;
        }

        const data = await response.json();

        return data.success === true;

    } catch (error) {
        console.error("Backend health check failed:", error);
        return false;
    }
}

/**
 * Retrieves biodiversity analytics from Django.
 *
 * Returns:
 * 1. Summary statistics
 * 2. Taxonomic distribution
 * 3. Top predicted species
 * 4. Species richness
 * 5. Recent recording history
 */
export async function fetchBiodiversityData() {
    try {
        const response = await fetch(
            `${API_BASE_URL}/biodiversity/`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message ||
                `Unable to retrieve biodiversity data. Server error: ${response.status}`
            );
        }

        return data;

    } catch (error) {
        console.error("Biodiversity API Error:", error);

        throw new Error(
            error.message ||
            "Unable to connect to the Biodiversity Dashboard API.",
             { cause: error }
        );
    }
}