// ==============================================================================
// NITOBLOCKS INTERACTION & INTERPRETER LOGIC (WITH SATISFYING SNAP FX)
// ==============================================================================

// Synthesize a satisfying plastic LEGO snap/pop click in real-time
function playSnapSound() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        
        // 1. High frequency mechanical transient (the impact click)
        const clickOsc = ctx.createOscillator();
        const clickGain = ctx.createGain();
        clickOsc.type = 'triangle';
        clickOsc.frequency.setValueAtTime(900, ctx.currentTime);
        clickOsc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.04);
        
        clickGain.gain.setValueAtTime(0.08, ctx.currentTime);
        clickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        
        // 2. Mid frequency plastic resonance (the hollow cavity pop)
        const popOsc = ctx.createOscillator();
        const popGain = ctx.createGain();
        popOsc.type = 'sine';
        popOsc.frequency.setValueAtTime(280, ctx.currentTime);
        popOsc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.09);
        
        popGain.gain.setValueAtTime(0.12, ctx.currentTime);
        popGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
        
        // Connect both synth parts
        clickOsc.connect(clickGain);
        clickGain.connect(ctx.destination);
        popOsc.connect(popGain);
        popGain.connect(ctx.destination);
        
        clickOsc.start();
        clickOsc.stop(ctx.currentTime + 0.04);
        popOsc.start();
        popOsc.stop(ctx.currentTime + 0.09);
    } catch (e) {
        // Ignored if browser security blocks audio contexts prior to interaction
    }
}

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
    // 1. DRAG AND DROP HANDLERS (MAGNETIC LEGO SYSTEM WITH AUDIOPHYSICAL FEEDBACK)
    // --------------------------------------------------------------------------

    function getOrCreatePlaceholder() {
        let placeholder = workspace.querySelector('.block-placeholder');
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.className = 'block-placeholder';
        }
        return placeholder;
    }

    function removePlaceholder() {
        const placeholder = workspace.querySelector('.block-placeholder');
        if (placeholder) {
            placeholder.remove();
        }
    }

    // Initialize templates in toolbox
    templates.forEach(template => {
        template.addEventListener('dragstart', (e) => {
            draggedBlockType = template.getAttribute('data-type');
            
            const input = template.querySelector('.block-input');
            draggedInputVal = input ? input.value : "";
            draggedLabel = template.querySelector('.block-label').innerText;
            
            e.dataTransfer.setData('text/plain', draggedBlockType);
            template.classList.add('dragging');
        });

        template.addEventListener('dragend', () => {
            template.classList.remove('dragging');
            removePlaceholder();
        });

        template.addEventListener('click', () => {
            const block = createBlockInWorkspace(
                draggedBlockType || template.getAttribute('data-type'), 
                draggedInputVal || (template.querySelector('.block-input') ? template.querySelector('.block-input').value : ""), 
                template.querySelector('.block-label').innerText
            );
            workspace.appendChild(block);
            triggerSnapEffects(block);
            updateGeneratedCode();
        });
    });

    workspace.addEventListener('dragover', (e) => {
        e.preventDefault();
        workspace.classList.add('drag-over');
        
        // Interactive visual alignment target (Magnetic placeholder slot)
        const placeholder = getOrCreatePlaceholder();
        const afterElement = getDragAfterElement(workspace, e.clientY);
        
        // Hide empty state while drag is active
        const emptyState = workspace.querySelector('.empty-state');
        if (emptyState) emptyState.style.display = 'none';
        
        if (afterElement == null) {
            workspace.appendChild(placeholder);
        } else {
            workspace.insertBefore(placeholder, afterElement);
        }
    });

    workspace.addEventListener('dragleave', () => {
        workspace.classList.remove('drag-over');
        // If workspace is physically empty, restore empty state
        const blocks = workspace.querySelectorAll('.lego-block');
        if (blocks.length === 0) {
            const emptyState = workspace.querySelector('.empty-state');
            if (emptyState) emptyState.style.display = 'block';
            removePlaceholder();
        }
    });

    workspace.addEventListener('drop', (e) => {
        e.preventDefault();
        workspace.classList.remove('drag-over');
        
        const type = e.dataTransfer.getData('text/plain');
        const placeholder = workspace.querySelector('.block-placeholder');
        
        if (type) {
            // Drop a new brick from the toolbox
            const block = createBlockInWorkspace(type, draggedInputVal, draggedLabel);
            if (placeholder) {
                workspace.insertBefore(block, placeholder);
            } else {
                workspace.appendChild(block);
            }
            triggerSnapEffects(block);
            updateGeneratedCode();
        } else {
            // Drop an existing brick being reordered in workspace
            const draggingBlock = workspace.querySelector('.dragging-workspace');
            if (draggingBlock) {
                if (placeholder) {
                    workspace.insertBefore(draggingBlock, placeholder);
                } else {
                    workspace.appendChild(draggingBlock);
                }
                triggerSnapEffects(draggingBlock);
                updateGeneratedCode();
            }
        }
        removePlaceholder();
        checkWorkspaceEmpty();
    });

    function triggerSnapEffects(block) {
        // Audio snap
        playSnapSound();
        // Visual snap bounce animation
        block.classList.add('snap-animation');
        setTimeout(() => block.classList.remove('snap-animation'), 450);
    }

    // Create and return a modular LEGO block structure
    function createBlockInWorkspace(type, defaultVal, labelText) {
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
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            block.remove();
            checkWorkspaceEmpty();
            updateGeneratedCode();
            playSnapSound(); // sound feedback on deletion
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
            removePlaceholder();
            updateGeneratedCode();
        });

        return block;
    }

    function getBlockColorClass(type) {
        if (type === 'discord_event') return 'event-block';
        if (type === 'nito_si') return 'control-block';
        if (type === 'fin_de_bloque') return 'control-block fin-block-style';
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
        // Handled directly inside dragover and drop events on the workspace
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
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    async function runVisualProgram() {
        if (btnRun.disabled) return;
        btnRun.disabled = true;
        btnRun.innerText = "⏳ Ejecutando...";
        
        clearConsole();
        const blocks = workspace.querySelectorAll('.lego-block');
        if (blocks.length === 0) {
            logToConsole("[Runtime Error] No hay bloques en el lienzo para ejecutar.", "err");
            btnRun.disabled = false;
            btnRun.innerText = "⚡ Ejecutar Bloques";
            return;
        }

        logToConsole("[System] Iniciando simulador de NitoBlocks v0.1.0...");
        await sleep(400);
        
        let activeConditions = []; // stack of booleans representing nested conditional scopes
        let hasEvent = false;
        
        const hasNitoSupreme = !!workspace.querySelector('[data-type="nito_supreme"]');
        if (hasNitoSupreme) {
            logToConsole("[Runtime Info] Divinidad Nito detectada en el lienzo. Operaciones lógicas reajustadas.");
            await sleep(300);
        }

        // Sequential block evaluation
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            const type = block.getAttribute('data-type');
            const input = block.querySelector('.block-input');
            const value = input ? input.value : "";

            // Highlight active block
            block.classList.add('active-execution');
            await sleep(550); // Pause for visual effect

            if (type === 'fin_de_bloque') {
                if (activeConditions.length > 0) {
                    activeConditions.pop();
                    logToConsole("[System Info] Saliendo del bloque condicional.");
                }
                block.classList.remove('active-execution');
                continue;
            }

            // Skip block execution if any parent condition in stack evaluates to false
            const shouldSkip = activeConditions.some(c => !c);
            if (shouldSkip && type !== 'discord_event' && type !== 'nito_si') {
                block.classList.remove('active-execution');
                continue;
            }

            if (type === 'discord_event') {
                hasEvent = true;
                logToConsole("[System] Evento Discord registrado. Simulando recepción de mensaje 'ping'...");
                activeConditions.push(true);
                block.classList.remove('active-execution');
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
                block.classList.remove('active-execution');
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

            block.classList.remove('active-execution');
        }

        // Structural Auto-insertion warnings for unclosed blocks
        if (activeConditions.length > 0) {
            logToConsole("[Parser Warning] Auto-inserted missing '}' block closures for unclosed conditionals at EOF.", "warn");
        }

        logToConsole("[System] Ejecución finalizada con éxito.");
        btnRun.disabled = false;
        btnRun.innerText = "⚡ Ejecutar Bloques";
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
