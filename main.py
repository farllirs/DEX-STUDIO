import webview
import os
import sys
from backend.api import API

def main():
    # Path setup
    base_dir = os.path.dirname(os.path.abspath(__file__))
    index_path = os.path.join(base_dir, 'frontend', 'index.html')
    
    # API Initialization
    api = API()
    
    # Create Window
    window = webview.create_window(
        'DEX STUDIO - Creador de Apps para Linux',
        url=f'file://{index_path}',
        js_api=api,
        width=1280,
        height=800,
        min_size=(1000, 700),
        background_color='#0a0a0c'
    )
    
    # Inject window reference into API to allow DevTools toggle
    api.set_window(window)
    
    # Start
    webview.start(debug=True, gui='qt' if sys.platform == 'linux' else None)

if __name__ == '__main__':
    main()
