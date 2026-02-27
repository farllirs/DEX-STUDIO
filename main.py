import webview
import os
import sys
from backend.api import API

def _select_linux_gui():
    forced = os.getenv('DEX_WEBVIEW_GUI', '').strip().lower()
    if forced in ('gtk', 'qt'):
        return forced

    try:
        import gi
        gi.require_version('Gtk', '3.0')
        return 'gtk'
    except Exception:
        pass

    try:
        import qtpy  # noqa: F401
        return 'qt'
    except Exception:
        pass

    return None

def main():
    # Path setup
    base_dir = os.path.dirname(os.path.abspath(__file__))
    index_path = os.path.join(base_dir, 'frontend', 'index.html')
    
    # API Initialization
    api = API()
    
    # Create Window
    icon_path = os.path.join(base_dir, 'dex-icon.png')
    window = webview.create_window(
        'DEX STUDIO',
        url=f'file://{index_path}',
        js_api=api,
        width=1280,
        height=800,
        min_size=(1000, 700),
        background_color='#0a0a0c',
        frameless=True,
        easy_drag=False
    )
    
    # Inyectar referencia de ventana en la API
    api.set_window(window)
    
    def on_shown():
        try:
            import gi
            gi.require_version('Gtk', '3.0')
            from gi.repository import Gtk, GdkPixbuf
            for w in Gtk.Window.list_toplevels():
                if w.get_title() and 'DEX' in w.get_title():
                    pixbuf = GdkPixbuf.Pixbuf.new_from_file(icon_path)
                    w.set_icon(pixbuf)
        except Exception:
            pass
    
    window.events.shown += on_shown
    
    # Start
    if sys.platform.startswith('linux'):
        gui = _select_linux_gui()
        if gui:
            webview.start(debug=False, gui=gui)
        else:
            webview.start(debug=False)
    else:
        webview.start(debug=False)

if __name__ == '__main__':
    main()
