#!/usr/bin/env python3
"""
{{APP_NAME}} — Aplicación GUI
Creado por {{CREATOR}} con DEX STUDIO
"""

import webview
import os
import json

class App:
    def __init__(self):
        self.window = None

    def set_window(self, window):
        self.window = window

    def greet(self, name):
        return {"message": f"¡Hola, {name}! Bienvenido a {{APP_NAME}}"}

    def get_app_info(self):
        return {
            "name": "{{APP_NAME}}",
            "version": "{{VERSION}}",
            "creator": "{{CREATOR}}"
        }

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    app = App()

    window = webview.create_window(
        '{{APP_NAME}}',
        url=os.path.join(base_dir, 'src', 'index.html'),
        js_api=app,
        width=900,
        height=600,
        min_size=(600, 400)
    )

    app.set_window(window)
    webview.start(debug=True)

if __name__ == '__main__':
    main()
