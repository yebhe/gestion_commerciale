import pyclamd
from django.conf import settings
from rest_framework import serializers


def scan_file_for_viruses(uploaded_file):
    """Scanne un fichier via ClamAV avant stockage.

    Respecte la RÈGLE 8 (_docs/04_REGLES_CRITIQUES.txt) : tout fichier
    doit passer par Validation -> ClamAV -> MinIO. On refuse le fichier
    (fail-safe) si ClamAV est inaccessible ou si une menace est détectée,
    plutôt que de le stocker sans analyse.
    """
    try:
        cd = pyclamd.ClamdNetworkSocket(host=settings.CLAMAV_HOST, port=settings.CLAMAV_PORT)
        cd.ping()
    except Exception:
        raise serializers.ValidationError(
            "Le service d'analyse antivirus est momentanément indisponible. "
            "Veuillez réessayer dans quelques instants."
        )

    uploaded_file.seek(0)
    try:
        result = cd.scan_stream(uploaded_file.read())
    except Exception:
        raise serializers.ValidationError(
            "Erreur lors de l'analyse antivirus du fichier. Veuillez réessayer."
        )
    finally:
        uploaded_file.seek(0)

    if result:
        details = result.get('stream')
        virus_name = details[1] if details and len(details) > 1 else 'menace inconnue'
        raise serializers.ValidationError(
            f"Fichier rejeté : une menace a été détectée ({virus_name})."
        )
