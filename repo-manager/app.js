// Variables de Estado
let currentData = null;
let allSubmodules = [];

// ─── Sistema de Feedback Visual ───

/**
 * Activa/desactiva el indicador de carga global.
 * @param {boolean} busy - true para activar, false para desactivar
 * @param {string} message - Mensaje a mostrar en el banner inferior
 */
function setBusy(busy, message = 'Ejecutando comando...') {
    const bar    = document.getElementById('top-progress-bar');
    const banner = document.getElementById('busy-banner');
    const text   = document.getElementById('busy-banner-text');

    if (busy) {
        bar.classList.add('active');
        banner.classList.add('visible');
        text.textContent = message;
    } else {
        bar.classList.remove('active');
        banner.classList.remove('visible');
        text.textContent = 'Ejecutando comando...';
    }
}

/**
 * Muestra un toast de notificación.
 * @param {string} title - Título del toast
 * @param {string} desc - Descripción breve (opcional)
 * @param {'success'|'error'|'info'|'warning'} type - Tipo visual
 * @param {number} duration - Duración en ms antes de desaparecer (default 4000)
 */
function showToast(title, desc = '', type = 'info', duration = 4500) {
    const container = document.getElementById('toast-container');
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
        <div class="toast-body">
            <span class="toast-title">${title}</span>
            ${desc ? `<span class="toast-desc">${desc}</span>` : ''}
        </div>
    `;
    container.appendChild(toast);

    // Auto-eliminar con animación
    const remove = () => {
        toast.classList.add('out');
        setTimeout(() => toast.remove(), 320);
    };
    const timer = setTimeout(remove, duration);
    toast.addEventListener('click', () => { clearTimeout(timer); remove(); });
}

/**
 * Establece un botón en modo carga (spinner + texto) y lo deshabilita.
 * @param {HTMLElement} btn
 * @param {string} loadingText
 * @returns {string} El HTML original del botón para restaurarlo después
 */
function setButtonLoading(btn, loadingText = 'Ejecutando...') {
    if (!btn) return '';
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="btn-spinner"></span> ${loadingText}`;
    return original;
}

function restoreButton(btn, originalHtml) {
    if (!btn) return;
    btn.disabled = false;
    btn.innerHTML = originalHtml;
}

// Ejecución al cargar
document.addEventListener("DOMContentLoaded", () => {
    loadStatus();
    setupUrlAutoparse();
});

// Cambiar de Pestaña (Tabs)
function switchTab(tabId) {
    // Actualizar botones del Sidebar
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.classList.remove("active");
    });
    const activeBtn = document.getElementById(`nav-btn-${tabId}`);
    if (activeBtn) activeBtn.classList.add("active");

    // Actualizar contenedores de contenido
    document.querySelectorAll(".tab-content").forEach(tab => {
        tab.classList.remove("active");
    });
    document.getElementById(`tab-${tabId}`).classList.add("active");

    // Actualizar títulos e información en la cabecera
    const headerTitle = document.getElementById("current-tab-title");
    const headerDesc = document.getElementById("current-tab-desc");

    switch(tabId) {
        case 'dashboard':
            headerTitle.textContent = "Panel General";
            headerDesc.textContent = "Estado general de tu repositorio centralizado y proyectos.";
            break;
        case 'submodules':
            headerTitle.textContent = "Gestión de Submódulos";
            headerDesc.textContent = "Controla, actualiza y añade submódulos individuales a tu Bóveda.";
            break;
        case 'deploy':
            headerTitle.textContent = "Despliegue Vault";
            headerDesc.textContent = "Realiza commit y push del repositorio padre para publicar cambios.";
            break;
        case 'troubleshoot':
            headerTitle.textContent = "Solución de Problemas";
            headerDesc.textContent = "Corrige inconsistencias del índice de Git y cabezas desprendidas (Detached HEADs).";
            break;
    }
}

// Cargar estado desde el backend
async function loadStatus() {
    const refreshBtn = document.getElementById("btn-refresh-status");
    const originalHtml = setButtonLoading(refreshBtn, 'Escaneando...');
    setBusy(true, 'Escaneando estado del repositorio...');
    
    try {
        const response = await fetch('/api/status');
        if (!response.ok) throw new Error("Error de red al escanear estado.");
        
        const data = await response.json();
        currentData = data;
        allSubmodules = data.submodules || [];
        
        // Actualizar vistas
        updateParentStatus(data.parent);
        updateMetrics(data.parent, allSubmodules);
        renderSubmodules(allSubmodules);
        renderTroubleshoot(allSubmodules);
        renderDeploySummary(data.parent);
        
        appendConsoleLog("INFO", "Escaneo completado con éxito.", "");
        showToast('Repositorio escaneado', `${allSubmodules.length} submódulos encontrados`, 'success', 3000);
    } catch (err) {
        console.error(err);
        appendConsoleLog("ERROR", "No se pudo conectar con el servidor backend de Python.", err.message);
        showToast('Error de conexión', err.message, 'error');
    } finally {
        restoreButton(refreshBtn, originalHtml);
        setBusy(false);
    }
}

// Actualizar barra de estado del repositorio padre
function updateParentStatus(parent) {
    const dot = document.getElementById("parent-status-dot");
    const text = document.getElementById("parent-status-text");
    const branch = document.getElementById("parent-branch-badge");
    const commit = document.getElementById("parent-commit-badge");

    branch.textContent = `Rama: ${parent.branch}`;
    commit.textContent = `Commit: ${parent.commit}`;

    if (parent.has_changes) {
        dot.className = "status-dot orange";
        text.textContent = "Bóveda: Cambios sin guardar";
    } else if (parent.has_unpushed) {
        dot.className = "status-dot orange";
        text.textContent = "Bóveda: Commits sin subir";
    } else {
        dot.className = "status-dot green";
        text.textContent = "Bóveda: Sincronizada";
    }
}

// Actualizar tarjetas de métricas en Dashboard
function updateMetrics(parent, submodules) {
    document.getElementById("metric-total-submodules").textContent = submodules.length;
    
    const modifiedCount = submodules.filter(s => s.has_changes).length;
    document.getElementById("metric-modified-submodules").textContent = modifiedCount;
    
    const unpushedCount = submodules.filter(s => s.has_unpushed).length;
    document.getElementById("metric-unpushed-submodules").textContent = unpushedCount;

    const errorCount = submodules.filter(s => s.status !== 'active' || s.sync_status === 'detached').length;
    document.getElementById("metric-error-submodules").textContent = errorCount;

    const errCard = document.getElementById("metric-card-errors");
    if (errorCount > 0) {
        errCard.style.borderColor = "var(--color-error)";
    } else {
        errCard.style.borderColor = "var(--card-border)";
    }
}

// Renderizar grilla de submódulos
function renderSubmodules(submodules) {
    const container = document.getElementById("submodules-list-container");
    container.innerHTML = "";

    if (submodules.length === 0) {
        container.innerHTML = '<div class="empty-state">No se encontraron submódulos registrados en este repositorio.</div>';
        return;
    }

    submodules.forEach(sub => {
        const card = document.createElement("div");
        card.className = "submodule-card";
        
        // Determinar Badge de Estado y Estilo
        let badgeHtml = '';
        let errorAlertHtml = '';
        let actionButtonsHtml = '';

        if (sub.status === 'active') {
            if (sub.has_changes) {
                badgeHtml = '<span class="badge badge-warning">Modificado ✏️</span>';
            } else if (sub.sync_status === 'detached') {
                badgeHtml = '<span class="badge badge-warning">Detached ⚠️</span>';
            } else if (sub.sync_status === 'behind') {
                badgeHtml = '<span class="badge badge-info">Nueva Versión 📥</span>';
            } else {
                badgeHtml = '<span class="badge badge-success">Sincronizado ✅</span>';
            }
            
            // Botones de acción normales
            actionButtonsHtml = `
                <button class="btn btn-sm btn-outline" id="btn-pull-${sub.name.replace(/\//g, '_')}" onclick="runSubmoduleAction('${sub.path}', 'pull')">
                    📥 Pull
                </button>
                ${sub.has_changes ? `
                    <button class="btn btn-sm btn-warning" id="btn-commit-${sub.name.replace(/\//g, '_')}" onclick="promptCommitSubmodule('${sub.path}')">
                        💾 Commit
                    </button>
                ` : ''}
                ${sub.has_unpushed ? `
                    <button class="btn btn-sm btn-primary" id="btn-push-${sub.name.replace(/\//g, '_')}" onclick="runSubmoduleAction('${sub.path}', 'push')">
                        📤 Push
                    </button>
                ` : ''}
                ${sub.sync_status === 'detached' ? `
                    <button class="btn btn-sm btn-outline" id="btn-fix-det-${sub.name.replace(/\//g, '_')}" onclick="runSubmoduleAction('${sub.path}', 'checkout_main')">
                        🔗 Conectar
                    </button>
                ` : ''}
            `;
        } else if (sub.status === 'missing_mapping') {
            badgeHtml = '<span class="badge badge-error">Sin Mapeo ❌</span>';
            errorAlertHtml = `<div class="sub-error-alert">${sub.error}</div>`;
            actionButtonsHtml = `
                <button class="btn btn-sm btn-success" id="btn-convert-${sub.name.replace(/\//g, '_')}" onclick="toggleConvertModal(true, '${sub.path}')">
                    ✅ Registrar como Submódulo
                </button>
                <button class="btn btn-sm btn-danger" id="btn-fix-cached-${sub.name.replace(/\//g, '_')}" onclick="fixOrphanedSubmodule('${sub.path}')">
                    🗑️ Solo Limpiar Caché
                </button>
            `;
        } else if (sub.status === 'uninitialized') {
            badgeHtml = '<span class="badge badge-warning">Sin Inicializar ⚙️</span>';
            errorAlertHtml = `<div class="sub-error-alert">${sub.error}</div>`;
            actionButtonsHtml = `
                <button class="btn btn-sm btn-primary" id="btn-init-${sub.name.replace(/\//g, '_')}" onclick="runSubmoduleAction('${sub.path}', 'pull')">
                    ⚙️ Clonar / Descargar
                </button>
            `;
        } else if (sub.status === 'missing_folder') {
            badgeHtml = '<span class="badge badge-error">Carpeta Faltante 📂</span>';
            errorAlertHtml = `<div class="sub-error-alert">${sub.error}</div>`;
            actionButtonsHtml = `
                <button class="btn btn-sm btn-primary" id="btn-clone-${sub.name.replace(/\//g, '_')}" onclick="runSubmoduleAction('${sub.path}', 'pull')">
                    📥 Descargar
                </button>
            `;
        } else {
            badgeHtml = '<span class="badge badge-outline">Desconocido ❓</span>';
            errorAlertHtml = sub.error ? `<div class="sub-error-alert">${sub.error}</div>` : '';
        }

        // Cortar la URL para visualización
        const displayUrl = sub.url.length > 40 ? sub.url.substring(0, 37) + '...' : sub.url;

        card.innerHTML = `
            <div class="submodule-card-header">
                <div class="sub-title">
                    <h4>${sub.name}</h4>
                    <span class="sub-path">${sub.path}</span>
                </div>
                ${badgeHtml}
            </div>
            
            ${errorAlertHtml}

            <div class="submodule-details">
                <div class="detail-item">
                    <span class="detail-label">Rama</span>
                    <span class="detail-val" title="${sub.branch}">${sub.branch}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Commit</span>
                    <span class="detail-val" title="${sub.commit}">${sub.commit}</span>
                </div>
                <div class="detail-item" style="grid-column: 1 / span 2;">
                    <span class="detail-label">URL Remota</span>
                    <a href="${sub.url.startsWith('http') ? sub.url.replace('.git', '') : '#'}" target="_blank" class="detail-val" style="color: var(--primary-blue); text-decoration: none;">
                        ${displayUrl} 🔗
                    </a>
                </div>
            </div>

            <div class="submodule-actions">
                ${actionButtonsHtml}
            </div>
        `;
        
        container.appendChild(card);
    });
}

// Filtrar submódulos en la barra de búsqueda
function filterSubmodules() {
    const query = document.getElementById("submodule-search").value.toLowerCase();
    const cards = document.querySelectorAll(".submodule-card");
    
    cards.forEach(card => {
        const title = card.querySelector("h4").textContent.toLowerCase();
        const path = card.querySelector(".sub-path").textContent.toLowerCase();
        if (title.includes(query) || path.includes(query)) {
            card.style.display = "flex";
        } else {
            card.style.display = "none";
        }
    });
}

// Renderizar panel de solución de problemas
function renderTroubleshoot(submodules) {
    const listContainer = document.getElementById("orphan-troubleshoot-list");
    const orphans = submodules.filter(s => s.status === 'missing_mapping');

    if (orphans.length === 0) {
        listContainer.innerHTML = '<p class="text-secondary" style="margin-bottom: 0;">✅ No se detectaron discrepancias ni submódulos huérfanos en la caché.</p>';
        return;
    }

    listContainer.innerHTML = '';
    orphans.forEach(sub => {
        const item = document.createElement("div");
        item.className = "conflict-item";
        item.style.flexWrap = "wrap";
        item.style.gap = "10px";
        item.innerHTML = `
            <div class="conflict-info" style="flex: 1; min-width: 200px;">
                <span class="conflict-path">${sub.path}</span>
                <span class="conflict-desc">Registrado en index como gitlink, pero sin entrada en .gitmodules.</span>
            </div>
            <div style="display:flex; gap:8px; flex-shrink:0;">
                <button class="btn btn-sm btn-success" id="btn-convert-ts-${sub.name.replace(/\//g, '_')}" onclick="toggleConvertModal(true, '${sub.path}')">
                    ✅ Registrar como Submódulo
                </button>
                <button class="btn btn-sm btn-danger" id="btn-fix-ts-${sub.name.replace(/\//g, '_')}" onclick="fixOrphanedSubmodule('${sub.path}')">
                    🗑️ Solo Limpiar
                </button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

// Renderizar resumen de archivos modificados en la sección Deploy
function renderDeploySummary(parent) {
    const summaryBox = document.getElementById("vault-changes-summary");
    if (parent.has_changes) {
        summaryBox.innerHTML = `<strong>Cambios locales en la Bóveda listos para commit:</strong>\n\n${parent.status_raw}`;
        summaryBox.style.color = "#a7f3d0"; // verde
    } else if (parent.has_unpushed) {
        summaryBox.innerHTML = `<strong>Tienes commits en local que no has subido a GitHub.</strong>\nListo para hacer Push de la rama principal.`;
        summaryBox.style.color = "#fbcfe8"; // rosa claro
    } else {
        summaryBox.innerHTML = `Bóveda limpia. No hay cambios locales ni pendientes de subir a origin.`;
        summaryBox.style.color = "var(--text-secondary)";
    }
}

// Ejecutar acción individual en submódulo (Pull, Push, Checkout Main)
async function runSubmoduleAction(path, action) {
    const actionLabels = { pull: 'Descargando (Pull)', push: 'Subiendo (Push)', checkout_main: 'Conectando rama', commit: 'Guardando commit' };
    const label = actionLabels[action] || action;

    // Ir al dashboard para ver la consola
    switchTab('dashboard');
    setBusy(true, `${label} en [${path}]...`);
    appendConsoleLog("EJECUTANDO", `${label} en submódulo [${path}]`, "");
    
    // Deshabilitar botones de esa tarjeta
    const cardElement = Array.from(document.querySelectorAll(".submodule-card")).find(c => {
        const p = c.querySelector(".sub-path");
        return p && p.textContent === path;
    });
    if (cardElement) cardElement.querySelectorAll(".btn").forEach(b => b.disabled = true);

    try {
        const response = await fetch('/api/submodule/action', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ path, action })
        });
        const data = await response.json();
        
        if (data.code === 0) {
            appendConsoleLog("ÉXITO", `${label} en [${path}] completado.`, data.stdout);
            showToast(`${label} completado`, path, 'success');
        } else if (data.code === -2) {
            // Timeout
            appendConsoleLog("ERROR", `Timeout: el comando tardó demasiado en [${path}].`, data.stderr);
            showToast('Timeout de comando', `El ${label} superó el límite de tiempo. ¿Problemas con SSH?`, 'warning', 7000);
        } else {
            appendConsoleLog("ERROR", `Fallo en ${label} [${path}]. Código: ${data.code}`, data.stderr || data.stdout);
            showToast(`Error en ${label}`, data.stderr?.split('\n')[0] || 'Revisa la consola', 'error');
        }
        loadStatus();
    } catch (err) {
        appendConsoleLog("EXCEPCIÓN", `Error al ejecutar '${action}'`, err.message);
        showToast('Error de conexión', err.message, 'error');
    } finally {
        setBusy(false);
    }
}

// Prompt para hacer commit en un submódulo modificado
function promptCommitSubmodule(path) {
    const msg = prompt("Ingresa el mensaje de commit para el submódulo:", "Avances rápidos en submódulo");
    if (msg === null) return; // cancelado
    
    executeSubmoduleCommit(path, msg);
}

async function executeSubmoduleCommit(path, message) {
    switchTab('dashboard');
    setBusy(true, `Guardando commit en [${path}]...`);
    appendConsoleLog("EJECUTANDO", `git add . && git commit -m "${message}" en [${path}]`, "");
    try {
        const response = await fetch('/api/submodule/action', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ path, action: 'commit', message })
        });
        const data = await response.json();
        if (data.code === 0) {
            appendConsoleLog("ÉXITO", `Commit guardado en [${path}].`, data.stdout);
            showToast('Commit guardado', path, 'success');
        } else {
            appendConsoleLog("ERROR", `No se pudo hacer commit en [${path}].`, data.stderr || data.stdout);
            showToast('Error al hacer commit', data.stderr?.split('\n')[0] || '', 'error');
        }
        loadStatus();
    } catch (err) {
        appendConsoleLog("EXCEPCIÓN", `Error de red al guardar commit.`, err.message);
        showToast('Error de conexión', err.message, 'error');
    } finally {
        setBusy(false);
    }
}

// Ejecutar acción global (actualizar todo, inicializar todo)
async function runGlobalAction(actionEndpoint) {
    const isUpdateAll = actionEndpoint === 'update-all';
    const actionLabel = isUpdateAll ? 'Sincronizando remotos (Pull remote)' : 'Inicializando submódulos locales';
    
    switchTab('dashboard');
    setBusy(true, `${actionLabel}... esto puede tardar.`);
    appendConsoleLog("EJECUTANDO", `${actionLabel}`, "Espera, este proceso puede tardar varios segundos.");
    
    const btn = document.getElementById(isUpdateAll ? 'btn-global-update' : 'btn-global-init');
    const originalHtml = setButtonLoading(btn, actionLabel);

    try {
        const response = await fetch(`/api/troubleshoot/${actionEndpoint}`, { method: 'POST' });
        const data = await response.json();
        
        if (data.code === 0) {
            appendConsoleLog("ÉXITO", `${actionLabel} completado correctamente.`, data.stdout);
            showToast('Operación completada', actionLabel, 'success');
        } else if (data.code === -2) {
            appendConsoleLog("ERROR", `Timeout: ${actionLabel} tardó demasiado.`, data.stderr);
            showToast('Timeout', 'El proceso tardó demasiado. Revisa tu conexión SSH.', 'warning', 7000);
        } else {
            appendConsoleLog("ERROR", `${actionLabel} devolvió un error (Código ${data.code}).`, data.stderr || data.stdout);
            showToast('Error en la operación', data.stderr?.split('\n')[0] || '', 'error');
        }
        loadStatus();
    } catch (err) {
        appendConsoleLog("EXCEPCIÓN", `Fallo en la comunicación global.`, err.message);
        showToast('Error de conexión', err.message, 'error');
    } finally {
        setBusy(false);
        restoreButton(btn, originalHtml);
    }
}

// Reparar discrepancia de índice/caché
async function fixOrphanedSubmodule(path) {
    if (!confirm(`¿Estás seguro de que deseas eliminar la referencia en caché de '${path}'?\nEsto no borrará tus archivos físicos.`)) return;
    
    switchTab('dashboard');
    setBusy(true, `Limpiando caché de Git para [${path}]...`);
    appendConsoleLog("EJECUTANDO", `git rm --cached "${path}"`, "");
    try {
        const response = await fetch('/api/troubleshoot/fix-cached', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ path })
        });
        const data = await response.json();
        if (data.code === 0) {
            appendConsoleLog("ÉXITO", `Referencia en caché removida para [${path}].`, data.stdout);
            showToast('Caché limpiada', path, 'success');
        } else {
            appendConsoleLog("ERROR", `No se pudo limpiar la caché para [${path}].`, data.stderr || data.stdout);
            showToast('Error al limpiar', data.stderr?.split('\n')[0] || '', 'error');
        }
        loadStatus();
    } catch (err) {
        appendConsoleLog("EXCEPCIÓN", `Error de comunicación.`, err.message);
        showToast('Error de conexión', err.message, 'error');
    } finally {
        setBusy(false);
    }
}

// Reconectar todos los detached heads
async function fixDetachedHeadsAll() {
    const detachedSubs = allSubmodules.filter(s => s.sync_status === 'detached');
    if (detachedSubs.length === 0) {
        showToast("Sin Detached HEADs", "No se encontraron submódulos en estado Detached HEAD.", "info");
        return;
    }
    
    appendConsoleLog("INFO", `Corrigiendo ${detachedSubs.length} submódulos en estado Detached HEAD...`, "");
    
    for (const sub of detachedSubs) {
        await runSubmoduleAction(sub.path, 'checkout_main');
    }
    
    showToast("Proceso finalizado", "Conexión de ramas finalizada. Revisa la consola para detalles.", "info");
}

// Ejecutar despliegue de la Bóveda Principal (Vault Deploy)
async function executeVaultDeploy() {
    const commitInput = document.getElementById("deploy-commit-msg");
    const message = commitInput.value.trim() || "deploy: quick update via repo-manager";
    
    const deployBtn = document.getElementById("btn-execute-deploy");
    const originalHtml = setButtonLoading(deployBtn, 'Desplegando en GitHub...');
    setBusy(true, `Subiendo Bóveda a GitHub: "${message}"`);
    appendConsoleLog("EJECUTANDO", `git add . && git commit -m "${message}" && git push origin main`, "Esto puede tardar si hay archivos grandes o la conexión SSH es lenta.");

    try {
        const response = await fetch('/api/vault/deploy', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ message })
        });
        const data = await response.json();
        
        if (data.code === 0) {
            appendConsoleLog("ÉXITO", "¡Bóveda principal desplegada con éxito en GitHub!", data.stdout);
            commitInput.value = "";
            showToast('¡Deploy completado!', 'Cambios subidos a GitHub correctamente', 'success', 6000);
        } else if (data.code === -2) {
            appendConsoleLog("ERROR", "Timeout: el push tardó demasiado.", data.stderr);
            showToast('Timeout en el push', 'El comando superó 60s. ¿Archivos muy grandes o SSH bloqueado?', 'warning', 8000);
        } else {
            appendConsoleLog("ERROR", `Fallo en el despliegue. Código: ${data.code}`, data.stderr || data.stdout);
            showToast('Error en el push', data.stderr?.split('\n').find(l => l.includes('error:')) || 'Revisa la consola', 'error', 7000);
        }
        loadStatus();
    } catch (err) {
        appendConsoleLog("EXCEPCIÓN", "Error de conexión durante el despliegue.", err.message);
        showToast('Error de conexión', err.message, 'error');
    } finally {
        restoreButton(deployBtn, originalHtml);
        setBusy(false);
    }
}

// Control del modal para agregar submódulos
function toggleAddModal(show) {
    const modal = document.getElementById("add-submodule-modal");
    modal.style.display = show ? "flex" : "none";
    if (show) {
        document.getElementById("new-submodule-url").value = "";
        document.getElementById("new-submodule-path").value = "";
        document.getElementById("new-submodule-branch").value = "";
    }
}

// Enviar formulario de nuevo submódulo
async function submitAddSubmodule() {
    const url = document.getElementById("new-submodule-url").value.trim();
    const path = document.getElementById("new-submodule-path").value.trim();
    const branch = document.getElementById("new-submodule-branch").value.trim();
    
    if (!url || !path) {
        showToast("Campos incompletos", "Por favor, rellena los campos de URL y Ruta.", "warning");
        return;
    }
    
    toggleAddModal(false);
    
    const displayBranch = branch ? ` (rama: ${branch})` : '';
    setBusy(true, `Agregando submódulo [${path}]${displayBranch}...`);
    appendConsoleLog("EJECUTANDO", `git submodule add ${url} "${path}"${displayBranch}`, "Esto clonará el submódulo, espera un momento...");
    
    const submitBtn = document.getElementById("btn-add-submodule-submit");
    const originalBtnHtml = setButtonLoading(submitBtn, 'Agregando...');

    try {
        const response = await fetch('/api/submodule/add', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ url, path, branch })
        });
        const data = await response.json();
        
        if (data.code === 0) {
            appendConsoleLog("ÉXITO", `Submódulo agregado correctamente en la ruta: ${path}`, data.stdout);
            showToast("Submódulo agregado", `Agregado con éxito en: ${path}`, "success", 6000);
            setTimeout(() => {
                showToast("Cambios pendientes", "Haz Commit/Push en 'Despliegue Vault' para guardar la referencia.", "info", 8000);
            }, 1000);
        } else {
            appendConsoleLog("ERROR", `Error al añadir submódulo. Código: ${data.code}`, data.stderr || data.stdout);
            showToast("Error al añadir submódulo", data.stderr?.split('\n')[0] || 'Revisa la consola', "error", 6000);
        }
        loadStatus();
    } catch (err) {
        appendConsoleLog("EXCEPCIÓN", "Error de red al intentar agregar el submódulo.", err.message);
        showToast("Error de red", err.message, "error");
    } finally {
        setBusy(false);
        restoreButton(submitBtn, originalBtnHtml);
    }
}

// Utilidades de Consola
function appendConsoleLog(type, title, details) {
    const consoleOutput = document.getElementById("console-output");
    const timestamp = new Date().toLocaleTimeString();
    
    let colorStyle = "";
    switch(type) {
        case 'EJECUTANDO': colorStyle = "color: #3b82f6;"; break; // azul
        case 'ÉXITO': colorStyle = "color: #34d399;"; break; // verde
        case 'ERROR': colorStyle = "color: #f87171; font-weight: bold;"; break; // rojo
        case 'EXCEPCIÓN': colorStyle = "color: #f87171; background: rgba(220,38,38,0.1);"; break;
        default: colorStyle = "color: #94a3b8;"; // gris
    }
    
    const logHeader = `[${timestamp}] <span style="${colorStyle}">${type}</span>: <strong>${title}</strong>\n`;
    const logDetails = details ? `<span style="color: #cbd5e1; font-size: 0.8rem;">${details}</span>\n` : '';
    
    consoleOutput.innerHTML += logHeader + logDetails + "----------------------------------------\n";
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function clearConsole() {
    document.getElementById("console-output").innerHTML = "Consola vaciada. Listo para nuevos comandos.\n----------------------------------------\n";
}

// Control del modal de conversión a submódulo real
let _convertTargetPath = null;

function toggleConvertModal(show, path) {
    const modal = document.getElementById("convert-submodule-modal");
    modal.style.display = show ? "flex" : "none";
    if (show && path) {
        _convertTargetPath = path;
        document.getElementById("convert-submodule-path-label").textContent = path;
        document.getElementById("convert-submodule-url").value = "";
        // Intentar pre-rellenar la URL si ya hay una sugerida en los datos
        const sub = allSubmodules.find(s => s.path === path);
        if (sub && sub.url && sub.url !== 'Sin configurar en .gitmodules') {
            document.getElementById("convert-submodule-url").value = sub.url;
        }
        setTimeout(() => document.getElementById("convert-submodule-url").focus(), 100);
    } else {
        _convertTargetPath = null;
    }
}

async function submitConvertToSubmodule() {
    const url = document.getElementById("convert-submodule-url").value.trim();
    const path = _convertTargetPath;

    if (!url) {
        showToast("Falta URL", "Por favor, introduce la URL del repositorio de GitHub.", "warning");
        return;
    }
    if (!path) {
        showToast("Error interno", "No se encontró la ruta del submódulo.", "error");
        return;
    }

    toggleConvertModal(false, null);
    appendConsoleLog("EJECUTANDO",
        `Convirtiendo huérfano '${path}' en submódulo real...`,
        `1. git rm --cached "${path}"\n2. git submodule add ${url} "${path}"`
    );

    const submitBtn = document.getElementById("btn-convert-submodule-submit");
    if (submitBtn) submitBtn.disabled = true;

    try {
        const response = await fetch('/api/troubleshoot/convert-to-submodule', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ path, url })
        });
        const data = await response.json();

        if (data.code === 0) {
            appendConsoleLog("ÉXITO",
                `'${path}' ahora es un submódulo registrado correctamente.`,
                data.stdout
            );
            showToast("Submódulo registrado", `¡Listo! '${path}' registrado correctamente. Recuerda hacer Push.`, "success", 7000);
        } else {
            appendConsoleLog("ERROR",
                `Fallo al convertir '${path}' (paso: ${data.step || 'desconocido'}).`,
                data.stderr || data.stdout
            );
            showToast("Error en conversión", `Fallo al registrar '${path}'. Revisa la consola.`, "error");
        }
        loadStatus();
    } catch (err) {
        appendConsoleLog("EXCEPCIÓN", "Error de conexión con el servidor.", err.message);
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

// Configurar el autocompletado y análisis de URLs de GitHub
function setupUrlAutoparse() {
    const urlInput = document.getElementById("new-submodule-url");
    const branchInput = document.getElementById("new-submodule-branch");

    if (!urlInput || !branchInput) return;

    function parseAndCleanUrl() {
        const value = urlInput.value.trim();
        // Detectar formatos comunes de GitHub/GitLab:
        // https://github.com/usuario/proyecto/tree/rama-ejemplo
        // https://github.com/usuario/proyecto/blob/rama-ejemplo
        const githubTreeRegex = /https?:\/\/(www\.)?(github|gitlab)\.com\/([^\/]+)\/([^\/]+)\/(tree|blob)\/([^\/]+)/i;
        const match = value.match(githubTreeRegex);

        if (match) {
            const domain = match[2];
            const owner = match[3];
            const repo = match[4];
            const branch = match[6];

            // Construir URL limpia del repositorio .git
            const cleanUrl = `https://${domain}.com/${owner}/${repo}.git`;
            
            // Actualizar campos
            urlInput.value = cleanUrl;
            branchInput.value = branch;

            // Feedback visual agradable
            showToast(
                'URL de GitHub detectada',
                `Rama auto-detectada: "${branch}". URL limpiada.`,
                'success'
            );
        }
    }

    urlInput.addEventListener("blur", parseAndCleanUrl);
    urlInput.addEventListener("paste", () => {
        setTimeout(parseAndCleanUrl, 50);
    });
}
