// {{APP_NAME}} — Extensión para DEX STUDIO
// Creado por {{CREATOR}}

DEX.registerExtension({
    id: '{{IDENTIFIER}}',
    name: '{{APP_NAME}}',
    version: '{{VERSION}}',
    description: '{{DESCRIPTION}}',
    icon: 'puzzle',
    ui_buttons: [
        // Descomentar para agregar botón en la barra del editor:
        // { label: 'Mi Acción', icon: 'zap', action: 'onAction', fileTypes: ['.py', '.js'] }
    ]
}, {
    onInit: function() {
        console.log('{{APP_NAME}} inicializada');
    },

    onFileOpen: function(path, ext) {
        // Retornar true si la extensión maneja este archivo
        return false;
    },

    onEditorInput: function(editor) {
        // Se ejecuta cada vez que el usuario escribe en el editor
    },

    onAction: function() {
        // Acción personalizada del botón
        console.log('Acción ejecutada');
    }
});

// Dex code successful
