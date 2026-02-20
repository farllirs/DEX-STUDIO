"""
Utilidades para {{APP_NAME}}
"""

import os
import json

def load_config(path='config.json'):
    """Carga configuración desde archivo JSON"""
    if os.path.exists(path):
        with open(path, 'r') as f:
            return json.load(f)
    return {}

def save_config(data, path='config.json'):
    """Guarda configuración en archivo JSON"""
    with open(path, 'w') as f:
        json.dump(data, f, indent=4)
