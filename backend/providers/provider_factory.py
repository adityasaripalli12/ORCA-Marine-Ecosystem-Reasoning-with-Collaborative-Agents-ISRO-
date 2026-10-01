from typing import Optional
from backend.providers.ocean_provider import OceanProvider
from backend.providers.argo_provider import ArgoProvider

class ProviderFactory:
    """
    Factory for instantiating verified oceanographic data providers.
    """
    _providers = {}

    @classmethod
    def get_provider(cls, provider_name: str = "argo") -> OceanProvider:
        key = provider_name.lower().strip()
        if key not in cls._providers:
            if key in ["argo", "gdac", "ifremer"]:
                cls._providers[key] = ArgoProvider()
            else:
                # Default to official ARGO provider
                cls._providers[key] = ArgoProvider()
        return cls._providers[key]
