from enum import Enum
from typing import Set, Dict

class Permission(str, Enum):
    # Dataset permissions
    DATASET_READ = "dataset.read"
    DATASET_UPLOAD = "dataset.upload"
    DATASET_DELETE = "dataset.delete"
    DATASET_MANAGE = "dataset.manage"

    # Query & Analysis permissions
    QUERY_BASIC = "query.basic"
    QUERY_ADVANCED = "query.advanced"

    # Visualization permissions
    VISUALIZATION_BASIC = "visualization.basic"
    VISUALIZATION_ADVANCED = "visualization.advanced"

    # Alerts permissions
    ALERTS_READ = "alerts.read"
    ALERTS_MANAGE = "alerts.manage"

    # Reports permissions
    REPORTS_READ = "reports.read"
    REPORTS_GENERATE = "reports.generate"

    # Administration permissions
    USERS_READ = "users.read"
    USERS_MANAGE = "users.manage"
    AUDIT_READ = "audit.read"
    SECURITY_READ = "security.read"
    SECURITY_MANAGE = "security.manage"
    SYSTEM_CONFIGURE = "system.configure"

    # Domain specific permissions
    MARITIME_READ = "maritime.read"
    MARITIME_ANALYSIS = "maritime.analysis"
    COASTAL_ALERTS_READ = "coastal.alerts.read"
    VOICE_USE = "voice.use"
    MULTILINGUAL_USE = "multilingual.use"


# Master Role to Granular Permission Mapping
ROLE_PERMISSIONS: Dict[str, Set[Permission]] = {
    "Admin": {
        # Full Platform Access
        Permission.DATASET_READ,
        Permission.DATASET_UPLOAD,
        Permission.DATASET_DELETE,
        Permission.DATASET_MANAGE,
        Permission.QUERY_BASIC,
        Permission.QUERY_ADVANCED,
        Permission.VISUALIZATION_BASIC,
        Permission.VISUALIZATION_ADVANCED,
        Permission.ALERTS_READ,
        Permission.ALERTS_MANAGE,
        Permission.REPORTS_READ,
        Permission.REPORTS_GENERATE,
        Permission.USERS_READ,
        Permission.USERS_MANAGE,
        Permission.AUDIT_READ,
        Permission.SECURITY_READ,
        Permission.SECURITY_MANAGE,
        Permission.SYSTEM_CONFIGURE,
        Permission.MARITIME_READ,
        Permission.MARITIME_ANALYSIS,
        Permission.COASTAL_ALERTS_READ,
        Permission.VOICE_USE,
        Permission.MULTILINGUAL_USE,
    },
    "Government": {
        # Regional ocean intelligence, dataset read, ocean condition analysis, visualization, alerts, reports
        Permission.DATASET_READ,
        Permission.QUERY_BASIC,
        Permission.QUERY_ADVANCED,
        Permission.VISUALIZATION_BASIC,
        Permission.VISUALIZATION_ADVANCED,
        Permission.ALERTS_READ,
        Permission.REPORTS_READ,
        Permission.REPORTS_GENERATE,
        Permission.MARITIME_READ,
        Permission.MARITIME_ANALYSIS,
        Permission.VOICE_USE,
        Permission.MULTILINGUAL_USE,
    },
    "Researcher": {
        # Full scientific dataset access, upload, manage, advanced AI queries, advanced visualization, reports
        Permission.DATASET_READ,
        Permission.DATASET_UPLOAD,
        Permission.DATASET_MANAGE,
        Permission.QUERY_BASIC,
        Permission.QUERY_ADVANCED,
        Permission.VISUALIZATION_BASIC,
        Permission.VISUALIZATION_ADVANCED,
        Permission.REPORTS_READ,
        Permission.REPORTS_GENERATE,
        Permission.VOICE_USE,
        Permission.MULTILINGUAL_USE,
    },
    "Student": {
        # Basic dataset access, educational AI chat, basic visualization, voice input
        Permission.DATASET_READ,
        Permission.QUERY_BASIC,
        Permission.VISUALIZATION_BASIC,
        Permission.VOICE_USE,
        Permission.MULTILINGUAL_USE,
    },
    "Shipping": {
        # Maritime ocean condition info, operational map, temp/salinity/pressure, alerts, reports
        Permission.DATASET_READ,
        Permission.QUERY_BASIC,
        Permission.QUERY_ADVANCED,
        Permission.VISUALIZATION_BASIC,
        Permission.VISUALIZATION_ADVANCED,
        Permission.ALERTS_READ,
        Permission.REPORTS_READ,
        Permission.REPORTS_GENERATE,
        Permission.MARITIME_READ,
        Permission.MARITIME_ANALYSIS,
        Permission.VOICE_USE,
        Permission.MULTILINGUAL_USE,
    },
    "Coastal Guard": {
        # Maritime safety info, ocean anomaly alerts, coastal alerts, operational map, reports
        Permission.DATASET_READ,
        Permission.QUERY_BASIC,
        Permission.QUERY_ADVANCED,
        Permission.VISUALIZATION_BASIC,
        Permission.VISUALIZATION_ADVANCED,
        Permission.ALERTS_READ,
        Permission.ALERTS_MANAGE,
        Permission.REPORTS_READ,
        Permission.REPORTS_GENERATE,
        Permission.MARITIME_READ,
        Permission.MARITIME_ANALYSIS,
        Permission.COASTAL_ALERTS_READ,
        Permission.VOICE_USE,
        Permission.MULTILINGUAL_USE,
    },
}
