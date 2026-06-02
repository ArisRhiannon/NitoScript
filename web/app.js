// ==============================================================================
// NITOBLOCKS INTERACTION & INTERPRETER LOGIC
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const workspace = document.getElementById('workspace');
    const generatedCode = document.getElementById('generated-code');
    const consoleOutput = document.getElementById('console-output');
    const btnRun = document.getElementById('btn-run');
    const btnClear = document.getElementById('btn-clear');
    const templates = document.querySelectorAll('.block-template');

    let draggedBlockType = null;
    let draggedInputVal = "";
    let draggedLabel = "";

    // --------------------------------------------------------------------------
    // 1. DRAG AND DROP HANDLERS (LEGO SYSTEM)
    // --------------------------------------------------------------------------

    // Initialize templates in toolbox
    templates.forEach(template => {
        template.addEventListener('dragstart', (e) => {
            draggedBlockType = template.getAttribute('data-type');
            
            // Capture current inputs
            const input = template.querySelector('.block-input');
            draggedInputVal = input ? input.value : "";
            draggedLabel = template.querySelector('.block-label').innerText;
            
            e.dataTransfer.setData('text/plain', draggedBlockType);
            template.classList.add('dragging');
        });

        template.addEventListener('dragend', () => {
            template.classList.remove('dragging');
        });

        // Allow template creation on click as fallback
        template.addEventListener('click', () => {
            createBlockInWorkspace(draggedBlockType || template.getAttribute('data-type'), draggedInputVal || (template.querySelector('.block-input') ? template.querySelector('.block-input').value : ""), template.querySelector('.block-label').innerText);
            updateGeneratedCode();
        });
    });

    workspace.addEventListener('dragover', (e) => {
        e.preventDefault();
        workspace.classList.add('drag-over');
    });

    workspace.addEventListener('dragleave', () => {
        workspace.classList.remove('drag-over');
    });

    workspace.addEventListener('drop', (e) => {
        e.preventDefault();
        workspace.classList.remove('drag-over');
        
        const type = e.dataTransfer.getData('text/plain');
        if (type) {
            createBlockInWorkspace(type, draggedInputVal, draggedLabel);
            updateGeneratedCode();
        }
    });

    // Create and inject a brick into the workspace
    function createBlockInWorkspace(type, defaultVal, labelText) {
        // Remove empty state if present
        const emptyState = workspace.querySelector('.empty-state');
        if (emptyState) {
            emptyState.style.display = 'none';
        }

        const block = document.createElement('div');
        block.className = `lego-block ${getBlockColorClass(type)}`;
        block.setAttribute('data-type', type);
        block.draggable = true;

        // LEGO Studs
        const studs = document.createElement('div');
        studs.className = 'block-studs';
        block.appendChild(studs);

        // Content
        const content = document.createElement('div');
        content.className = 'block-content';

        const label = document.createElement('span');
        label.className = 'block-label';
        label.innerText = labelText;
        content.appendChild(label);

        // Add inputs if applicable
        if (type === 'imprimir' || type === 'discord_responder' || type === 'nito_si') {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'block-input';
            input.value = defaultVal || "";
            input.placeholder = type === 'nito_si' ? "ping" : "Mensaje...";
            input.addEventListener('input', updateGeneratedCode);
            content.appendChild(input);
        }

        // Close/Remove Button
        const removeBtn = document.createElement('span');
        removeBtn.className = 'remove-block-btn';
        removeBtn.innerHTML = ' &times;';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.fontSize = '18px';
        removeBtn.style.marginLeft = 'auto';
        removeBtn.style.color = 'rgba(255,255,255,0.6)';
        removeBtn.addEventListener('click', () => {
            block.remove();
            checkWorkspaceEmpty();
            updateGeneratedCode();
        });
        content.appendChild(removeBtn);

        block.appendChild(content);

        // Drag and drop within workspace for reordering
        block.addEventListener('dragstart', (e) => {
            block.classList.add('dragging-workspace');
            e.dataTransfer.setData('text/plain', ''); // required for Firefox
        });

        block.addEventListener('dragend', () => {
            block.classList.remove('dragging-workspace');
            updateGeneratedCode();
        });

        workspace.appendChild(block);
        setupReordering();
    }

    function getBlockColorClass(type) {
        if (type === 'discord_event') return 'event-block';
        if (type === 'nito_si' || type === 'fin_de_bloque') return 'control-block';
        if (type === 'nito_supreme') return 'supreme-block';
        return 'action-block';
    }

    function checkWorkspaceEmpty() {
        const blocks = workspace.querySelectorAll('.lego-block');
        const emptyState = workspace.querySelector('.empty-state');
        if (blocks.length === 0 && emptyState) {
            emptyState.style.display = 'block';
        }
    }

    // Set up dragging to reorder elements inside workspace
    function setupReordering() {
        const blocks = [...workspace.querySelectorAll('.lego-block:not(.dragging)')];
        
        workspace.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggingBlock = workspace.querySelector('.dragging-workspace');
            if (!draggingBlock) return;
            
            const afterElement = getDragAfterElement(workspace, e.clientY);
            if (afterElement == null) {
                workspace.appendChild(draggingBlock);
            } else {
                workspace.insertBefore(draggingBlock, afterElement);
            }
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.lego-block:not(.dragging-workspace)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    btnClear.addEventListener('click', () => {
        const blocks = workspace.querySelectorAll('.lego-block');
        blocks.forEach(b => b.remove());
        checkWorkspaceEmpty();
        updateGeneratedCode();
        clearConsole();
    });

    // --------------------------------------------------------------------------
    // 2. CODE COMPILER (BLOCKS -> NITOSCRIPT CODE)
    // --------------------------------------------------------------------------

    function updateGeneratedCode() {
        const blocks = workspace.querySelectorAll('.lego-block');
        if (blocks.length === 0) {
            generatedCode.innerText = "# El código aparecerá aquí automáticamente...";
            return;
        }

        let codeLines = [];
        let indentStack = [""];
        let insideEvent = false;
        let insideIf = false;

        blocks.forEach(block => {
            const type = block.getAttribute('data-type');
            const input = block.querySelector('.block-input');
            const value = input ? input.value : "";
            let indent = indentStack.join("");

            if (type === 'discord_event') {
                codeLines.push(`nitosegs al_recibir_mensaje() entonces`);
                indentStack.push("    ");
                insideEvent = true;
            } else if (type === 'nito_si') {
                codeLines.push(`${indent}nito_si mensaje es igual a "${value}" haz`);
                indentStack.push("    ");
                insideIf = true;
            } else if (type === 'fin_de_bloque') {
                if (indentStack.length > 1) {
                    indentStack.pop();
                }
                indent = indentStack.join("");
                codeLines.push(`${indent}# Fin del bloque`);
            } else if (type === 'imprimir') {
                let valToPrint = `"${value}"`;
                const hasNitoSupreme = !!workspace.querySelector('[data-type="nito_supreme"]');
                if (hasNitoSupreme && value.toLowerCase().includes("nito")) {
                    valToPrint = `"${value}" + Nito`;
                }
                codeLines.push(`${indent}nito_imprimir(${valToPrint})`);
            } else if (type === 'discord_responder') {
                codeLines.push(`${indent}responder("${value}")`);
            } else if (type === 'nito_supreme') {
                codeLines.push(`${indent}Nito # Declaración divina`);
            }
        });

        generatedCode.innerText = codeLines.join('\n');
    }

    // --------------------------------------------------------------------------
    // 3. RUNTIME SIMULATOR (BROWSER INTERPRETER)
    // --------------------------------------------------------------------------

    btnRun.addEventListener('click', () => {
        runVisualProgram();
    });

    function clearConsole() {
        consoleOutput.innerHTML = "";
    }

    function logToConsole(text, type = "info") {
        const line = document.createElement('div');
        line.className = `console-line console-${type}`;
        line.innerText = text;
        consoleOutput.appendChild(line);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    // A simple evaluation of the visual Lego structure (interpreted in JS)
    function runVisualProgram() {
        clearConsole();
        const blocks = workspace.querySelectorAll('.lego-block');
        if (blocks.length === 0) {
            logToConsole("[Runtime Error] No hay bloques en el lienzo para ejecutar.", "err");
            return;
        }

        logToConsole("[System] Iniciando simulador de NitoBlocks v0.1.0...");
        
        let activeConditions = []; // stack of booleans representing nested conditional scopes
        let hasEvent = false;
        
        const hasNitoSupreme = !!workspace.querySelector('[data-type="nito_supreme"]');
        if (hasNitoSupreme) {
            logToConsole("[Runtime Info] Divinidad Nito detectada en el lienzo. Operaciones lógicas reajustadas.");
        }

        // Sequential block evaluation
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            const type = block.getAttribute('data-type');
            const input = block.querySelector('.block-input');
            const value = input ? input.value : "";

            if (type === 'fin_de_bloque') {
                if (activeConditions.length > 0) {
                    activeConditions.pop();
                    logToConsole("[System Info] Saliendo del bloque condicional.");
                }
                continue;
            }

            // Skip block execution if any parent condition in stack evaluates to false
            const shouldSkip = activeConditions.some(c => !c);
            if (shouldSkip && type !== 'discord_event' && type !== 'nito_si') {
                continue;
            }

            if (type === 'discord_event') {
                hasEvent = true;
                logToConsole("[System] Evento Discord registrado. Simulando recepción de mensaje 'ping'...");
                activeConditions.push(true);
                continue;
            }

            if (type === 'nito_si') {
                // Autohealing simulation
                const target = "ping";
                let isMet = false;
                if (value.trim() === target) {
                    isMet = true;
                } else if (levenshtein(value.trim(), target) <= 2) {
                    logToConsole(`[Lexer Warning] Auto-healed condition typo '${value}' to '${target}' (Levenshtein distance ${levenshtein(value, target)})`, "warn");
                    isMet = true;
                } else {
                    logToConsole(`[System Info] Condición de filtro '${value}' no coincide con mensaje de Discord 'ping'.`);
                }
                activeConditions.push(isMet);
                continue;
            }

            if (type === 'imprimir') {
                if (hasNitoSupreme) {
                    logToConsole(`[Runtime Warning] La divinidad Nito absorbió la cadena '${value}'. Retornando Supremo.`, "warn");
                    logToConsole("Nito");
                } else {
                    logToConsole(value);
                }
            }

            if (type === 'discord_responder') {
                if (hasNitoSupreme) {
                    logToConsole(`[Bot Response] Nito (Absorbido de: '${value}')`);
                } else {
                    logToConsole(`[Bot Response] ${value}`);
                }
            }

            if (type === 'nito_supreme') {
                logToConsole("👑 Nito es mayor que todo. Límite lógico de red establecido.");
            }
        }

        // Structural Auto-insertion warnings for unclosed blocks
        if (activeConditions.length > 0) {
            logToConsole("[Parser Warning] Auto-inserted missing '}' block closures for unclosed conditionals at EOF.", "warn");
        }

        logToConsole("[System] Ejecución finalizada con éxito.");
    }

    // Levenshtein helper
    function levenshtein(s1, s2) {
        if (s1.length < s2.length) return levenshtein(s2, s1);
        if (s2.length === 0) return s1.length;
        
        let previousRow = Array.from({length: s2.length + 1}, (_, i) => i);
        for (let i = 0; i < s1.length; i++) {
            let currentRow = [i + 1];
            for (let j = 0; j < s2.length; j++) {
                let insertions = previousRow[j + 1] + 1;
                let deletions = currentRow[j] + 1;
                let substitutions = previousRow[j] + (s1[i] !== s2[j] ? 1 : 0);
                currentRow.push(Math.min(insertions, deletions, substitutions));
            }
            previousRow = currentRow;
        }
        return previousRow[previousRow.length - 1];
    }
});
