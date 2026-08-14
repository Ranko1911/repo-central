# 🗄️ Vault Template: Repositorio Centralizado

Plantilla para organizar y centralizar múltiples proyectos de desarrollo en una única estructura limpia utilizando **Git Submodules**.

> **ℹ️ Nota Importante:** Este repositorio actúa como un **Meta-Repositorio**. No almacena directamente el código fuente de los proyectos, sino que mantiene punteros ordenados a los repositorios independientes de cada proyecto.

---

## 📂 Estructura del Vault

La organización recomendada se divide en las siguientes categorías:

* **📂 Proyectos/**: Desarrollos activos y aplicaciones en curso.
* **📂 Clase/**: Ejercicios, prácticas o notas académicas.
* **📂 Break/**: Experimentos, utilidades de ocio o scripts secundarios.
* **📂 Docs/**: Documentación o recursos específicos.
* **📂 .agents/**: Reglas y guías configuradas para asistentes de inteligencia artificial.

---

## 🚀 Inicio Rápido

### ✅ Clonar el repositorio
Al clonar la bóveda en un nuevo equipo, usa la opción `--recursive` para descargar el índice y todos los submódulos enlazados:

```bash
git clone --recursive <URL_DE_TU_REPOSITORIO_VAULT>
```

### 🆘 Si clonaste sin `--recursive` o las carpetas están vacías:
```bash
git submodule update --init --recursive
```

---

## 🖥️ Repo-Vault Manager (Panel de Administración Web)

Incluye una aplicación web local de administración para gestionar submódulos sin memorizar comandos Git de consola.

### 🚀 Iniciar el Administrador
Ejecuta en consola o con doble clic:
* **Windows**: `run-manager.bat`

Abre tu navegador en `http://localhost:8080` para ver el estado de cada submódulo y añadir nuevos repositorios.

---

## 📘 Guía de Gestión de Submódulos

### 🏆 La Regla de Oro
> **NUNCA copies y pegues una carpeta que contenga un `.git` dentro de este repositorio.**
> Si deseas añadir un proyecto existente o nuevo, **siempre** regístralo como submódulo.

### 1. Añadir un NUEVO proyecto
```bash
git submodule add <URL_GITHUB> "Proyectos/NombreProyecto"
git commit -m "Añadido submódulo NombreProyecto"
git push origin main
```

### 2. Guardar cambios (Flujo de adentro hacia afuera)
1. Entra a la carpeta del proyecto hijo y guarda tus cambios:
   ```bash
   cd Proyectos/NombreProyecto
   git add .
   git commit -m "Mis cambios"
   git push origin main
   ```
2. Vuelve a la raíz del Vault y actualiza la referencia del padre:
   ```bash
   cd ../..
   git add .
   git commit -m "Actualizar puntero de NombreProyecto"
   git push origin main
   ```

### 3. Actualizar todos los submódulos a la vez
```bash
git submodule update --remote --merge
```

---

*Plantilla limpia para Repositorio Centralizado basada en Git Submodules.*
