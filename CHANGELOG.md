# CHANGELOG

## v1.0.3 (Final)

### Editor
- Correcciones de estabilidad y persistencia de configuraciones.
- Nueva API `DEX.ui` para override de botones core.
- Nueva sección `Developer` en Configuración con catálogo de IDs UI.
- Corrección del botón principal Ejecutar/Probar al aplicar overrides.

### Marketplace y extensiones
- Detección de extensiones no disponibles por repositorio caído.
- Marcado de estado `Extensión no disponible`.
- Ocultado automático tras periodo de gracia.
- Mejoras de publicación/instalación para extensiones `theme`/`ui-theme`.

### Apps Linux (DEX)
- Nuevo panel `Apps Linux (DEX)` en barra lateral.
- Listado de apps instaladas firmadas con `X-DEX-Identifier`.
- Listado de paquetes `.deb` encontrados en proyectos.
- Acciones: instalar `.deb`, copiar a `Downloads`, desinstalar app.

### UX
- Buscador superior con acciones rápidas (navegación/comandos).
- Búsqueda real en proyecto por contenido y por nombre de archivo.
- Apertura automática del primer resultado y salto a línea.
- Botones `Ejecutar / Compilar / Terminal` visibles solo en vista de editor con proyecto abierto.
