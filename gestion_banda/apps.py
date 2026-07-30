from django.apps import AppConfig


class GestionBandaConfig(AppConfig):
    name = 'gestion_banda'

    def ready(self):
        import gestion_banda.signals
