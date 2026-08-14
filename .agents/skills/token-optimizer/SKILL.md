---
name: token-optimizer
description: "Optimiza de forma activa el consumo de tokens y la calidad del resultado en tareas de exploración de repositorios, edición de código y respuestas al usuario."
---

# Habilidad: Token Optimizer — Gestión Eficiente de Contexto

Esta habilidad guía a los agentes de IA para ejecutar tareas en este repositorio consumiendo la menor cantidad de tokens posible, manteniendo la precisión técnica y la máxima calidad de respuesta.

---

## 🛠️ Directrices de Uso de Herramientas (Tool-Use Efficiency)

### 1. 🔍 Búsqueda y Navegación
*   **Prohibición de `tree.txt`:** Bajo ninguna circunstancia se debe leer o cargar el archivo `tree.txt` en la ventana de contexto. Es un archivo de más de 1.7 MB (~400k tokens).
*   **Inspección del Workspace:** Utiliza `list_dir` en directorios específicos para comprender la estructura en lugar de buscar a ciegas en todo el proyecto.
*   **Búsqueda Quirúrgica:** Utiliza `grep_search` con filtros (`Includes` o `SearchPath`) para localizar palabras clave, clases o métodos específicos antes de abrir cualquier archivo.

### 2. 📖 Lectura de Archivos (`view_file`)
*   **Filtro por Rango:** Si necesitas examinar una clase o función, no cargues el archivo completo. Especifica los parámetros `StartLine` y `EndLine` para leer únicamente las líneas relevantes.
*   **Signature-First:** Lee solo la cabecera e interfaz de las clases y funciones para entender cómo interactuar con ellas.

### 3. ✍️ Edición de Código (`replace_file_content` / `multi_replace_file_content`)
*   **Ediciones Parciales:** Evita reescribir archivos completos con `write_to_file`. Utiliza `replace_file_content` definiendo con precisión el rango de líneas (`StartLine`, `EndLine`) y el bloque de código exacto a reemplazar.
*   **Ediciones Contiguas:** Si los cambios están en partes no contiguas del mismo archivo, utiliza `multi_replace_file_content` para realizar múltiples cambios en una sola llamada de herramienta.

---

## 💬 Estructura y Formateo de Respuestas (Output Compression)

*   **Idioma:** Responder siempre en español (a menos que el usuario especifique lo contrario).
*   **Directo al Grano:** Evitar rodeos informales y explicaciones obvias de código.
*   **Diffs en lugar de Código Completo:** Al explicar cambios realizados, muestra solo un bloque `diff` de las líneas modificadas. No pegues bloques de código completos innecesariamente.
*   **Listas y Tablas:** Organiza la información en listas de viñetas cortas y tablas Markdown para mejorar la legibilidad.
