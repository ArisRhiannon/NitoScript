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

        // Dynamic Flow Energy Ribbon for Static Analysis
        const ribbon = document.createElement('div');
        ribbon.className = 'block-flow-ribbon';
        block.appendChild(ribbon);

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
        
        // Ejecutar analizador estático de flujos y fluidos visuales
        analyzeVisualFlow(blocks);
    }

    // ==============================================================================
    // STATIC FLOW ANALYZER (PRE-EXECUTION CHILL FLUIDS & ERROR DETECTION)
    // ==============================================================================
    function analyzeVisualFlow(blocks) {
        let openScopesStack = [];
        let heresyPatterns = [
            /nito\s*-\s*nito/i,
            /nito\s*\*\s*0/i,
            /nito\s*\*\s*-\d+/i,
            /nito\s*\/\s*0/i,
            /nito\s*\/\s*-\d+/i,
            /nito\s*<\s*/i
        ];

        // 1. Limpiar clases previas de flujos y asegurar la existencia del ribbon
        blocks.forEach(block => {
            block.classList.remove('flow-perfect', 'flow-warning', 'flow-error', 'flow-overflow');
            if (!block.querySelector('.block-flow-ribbon')) {
                const ribbon = document.createElement('div');
                ribbon.className = 'block-flow-ribbon';
                block.appendChild(ribbon);
            }
            block.removeAttribute('title'); // Limpiar tooltip previo
        });

        // 2. Análisis secuencial paso a paso (Estilo AST Simplificado)
        blocks.forEach((block, index) => {
            const type = block.getAttribute('data-type');
            const input = block.querySelector('.block-input');
            const value = input ? input.value : "";

            let status = 'perfect'; // perfect, warning, error, overflow

            // A. Detección de Parámetro Vacío (Advertencia de Flujo)
            if (input && value.trim() === "") {
                status = 'warning';
                block.title = "Flujo Incompleto: El bloque requiere un parámetro de entrada.";
            }

            // B. Detección Estática de Herejías (Errores Críticos)
            if (input && status !== 'error') {
                for (let pattern of heresyPatterns) {
                    if (pattern.test(value)) {
                        status = 'error';
                        block.title = "⚠️ ¡HEREJÍA ESTÁTICA DETECTADA!\nEsta operación viola las leyes divinas de Nito y causará un SupremeViolationError fatal al ejecutar.";
                        break;
                    }
                }
            }

            // C. Registro y validación de ámbitos y sangrías
            if (type === 'discord_event' || type === 'nito_si') {
                openScopesStack.push({ type: type, block: block, index: index });
            } else if (type === 'fin_de_bloque') {
                if (openScopesStack.length > 0) {
                    openScopesStack.pop();
                } else {
                    // Cierre de bloque suelto (Dedent sin indentación)
                    if (status !== 'error') {
                        status = 'warning';
                        block.title = "Advertencia de Ámbito: Fin de bloque huérfano (no hay ninguna condición que cerrar aquí).";
                    }
                }
            }

            // D. Aplicar estilo visual correspondiente al nodo actual
            if (status === 'error') {
                block.classList.add('flow-error');
            } else if (status === 'warning') {
                block.classList.add('flow-warning');
            } else {
                block.classList.add('flow-perfect');
            }
        });

        // E. Control de Fugas de Ámbito (Scope Leaks) - CASO EXTREMO
        if (openScopesStack.length > 0) {
            // El último bloque abierto sin cerrar es el culpable de la fuga
            const culprit = openScopesStack[openScopesStack.length - 1];
            
            // Inundar visualmente desde el bloque culpable hasta el final del lienzo
            for (let i = culprit.index; i < blocks.length; i++) {
                const b = blocks[i];
                b.classList.remove('flow-perfect', 'flow-warning');
                b.classList.add('flow-overflow');
                b.title = "🚨 FUGA DE ÁMBITO (Scope Leak):\nFalta un bloque '🛑 Fin de Bloque' para cerrar esta condición. Todos los bloques posteriores se desbordarán involuntariamente dentro de este ámbito.";
            }
        }
    }


    // --------------------------------------------------------------------------
    // 3. RUNTIME SIMULATOR & REAL VM BACKEND (v0.1.1)
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

    const variablesBody = document.getElementById('variables-body');

    function updateVariablesTable(scope) {
        variablesBody.innerHTML = "";
        const keys = Object.keys(scope);
        if (keys.length === 0) {
            variablesBody.innerHTML = `<tr><td colspan="3" class="no-variables">No hay variables activas</td></tr>`;
            return;
        }

        keys.forEach(key => {
            const item = scope[key];
            const tr = document.createElement('tr');
            
            const tdName = document.createElement('td');
            tdName.innerText = key;
            tr.appendChild(tdName);
            
            const tdVal = document.createElement('td');
            tdVal.innerText = item.val;
            tr.appendChild(tdVal);
            
            const tdType = document.createElement('td');
            tdType.innerText = item.type;
            tdType.className = `type-${item.type.toLowerCase()}`;
            tr.appendChild(tdType);
            
            variablesBody.appendChild(tr);
        });
    }

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

        logToConsole("[System] Iniciando simulador de NitoBlocks v0.1.1...");
        await sleep(400);
        
        let activeConditions = []; // stack of booleans representing nested conditional scopes
        let hasEvent = false;
        let virtualScope = {};
        
        updateVariablesTable(virtualScope);

        const hasNitoSupreme = !!workspace.querySelector('[data-type="nito_supreme"]');
        if (hasNitoSupreme) {
            logToConsole("[Runtime Info] Divinidad Nito detectada en el lienzo. Operaciones lógicas reajustadas.");
            virtualScope['Nito'] = { val: "Nito", type: "Nito" };
            updateVariablesTable(virtualScope);
            await sleep(300);
        }

        // Sequential block evaluation (Visual "Nito walk" step-by-step)
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            const type = block.getAttribute('data-type');
            const input = block.querySelector('.block-input');
            const value = input ? input.value : "";

            block.classList.add('active-execution');
            await sleep(500); // Pause for visual effect

            if (type === 'fin_de_bloque') {
                if (activeConditions.length > 0) {
                    activeConditions.pop();
                    logToConsole("[System Info] Saliendo del bloque condicional.");
                }
                block.classList.remove('active-execution');
                continue;
            }

            const shouldSkip = activeConditions.some(c => !c);
            if (shouldSkip && type !== 'discord_event' && type !== 'nito_si') {
                block.classList.remove('active-execution');
                continue;
            }

            if (type === 'discord_event') {
                hasEvent = true;
                logToConsole("[System] Evento Discord registrado. Simulando recepción de mensaje 'ping'...");
                activeConditions.push(true);
                virtualScope['mensaje'] = { val: "ping", type: "String" };
                updateVariablesTable(virtualScope);
                block.classList.remove('active-execution');
                continue;
            }

            if (type === 'nito_si') {
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
                virtualScope['cumple_condicion'] = { val: isMet ? "NITO" : "NO_NITO", type: "Boolean" };
                updateVariablesTable(virtualScope);
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

        if (activeConditions.length > 0) {
            logToConsole("[Parser Warning] Auto-inserted missing '}' block closures for unclosed conditionals at EOF.", "warn");
        }

        // Live Execution on the real Python Bytecode VM via Backend API
        const generatedCodeText = generatedCode.innerText;
        if (blocks.length > 0 && !generatedCodeText.startsWith("#")) {
            try {
                logToConsole("[System] Enviando código al compilador NitoScript real en Python...");
                await sleep(300);
                
                const response = await fetch('/api/run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: generatedCodeText })
                });
                
                const result = await response.json();
                
                if (result.stdout) {
                    const lines = result.stdout.split('\n');
                    lines.forEach(l => {
                        if (l.trim()) {
                            if (l.startsWith("[FFI]") || l.startsWith("[System]")) {
                                logToConsole(l, "info");
                            } else if (l.startsWith("[Lexer Warning]") || l.startsWith("[Parser Warning]")) {
                                logToConsole(l, "warn");
                            } else if (l.startsWith("[Inteligencia Propia]")) {
                                logToConsole(l, "info");
                            } else {
                                logToConsole(l, "info");
                            }
                        }
                    });
                }
                
                if (result.stderr) {
                    logToConsole("[Runtime Error en la Máquina Virtual]\n" + result.stderr, "err");
                }
                
                if (result.success) {
                    logToConsole("[System] Ejecución oficial en NitoSupremeExecutor (Bytecode VM) finalizada con éxito.");
                } else {
                    logToConsole("[System Error] La compilación o el hilo de la máquina virtual terminaron con código de error.", "err");
                }
            } catch (err) {
                logToConsole(`[System Error] No se pudo conectar con el compilador real de Python: ${err.message}`, "err");
                logToConsole("[System] Finalizada simulación local aproximada.");
            }
        } else {
            logToConsole("[System] Finalizada simulación local.");
        }

        btnRun.disabled = false;
        btnRun.innerText = "⚡ Ejecutar Bloques";
    }

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

    // --------------------------------------------------------------------------
    // 4. PERSISTENCIA DE PROYECTO (GUARDAR / CARGAR JSON)
    // --------------------------------------------------------------------------
    const btnSave = document.getElementById('btn-save');
    const btnLoad = document.getElementById('btn-load');

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    btnSave.addEventListener('click', () => {
        const blocks = [...workspace.querySelectorAll('.lego-block')];
        if (blocks.length === 0) {
            alert("No hay bloques en el lienzo para guardar.");
            return;
        }

        const projectData = blocks.map(block => {
            const input = block.querySelector('.block-input');
            return {
                type: block.getAttribute('data-type'),
                value: input ? input.value : "",
                label: block.querySelector('.block-label').innerText
            };
        });

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "nitoblocks_project.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        playSnapSound();
    });

    btnLoad.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const projectData = JSON.parse(event.target.result);
                if (!Array.isArray(projectData)) throw new Error();

                const blocks = workspace.querySelectorAll('.lego-block');
                blocks.forEach(b => b.remove());

                projectData.forEach(blockData => {
                    const block = createBlockInWorkspace(blockData.type, blockData.value, blockData.label);
                    workspace.appendChild(block);
                    triggerSnapEffects(block);
                });
                
                updateGeneratedCode();
                checkWorkspaceEmpty();
                fileInput.value = ""; 
            } catch (err) {
                alert("Error al cargar el proyecto. El archivo no tiene un formato NitoBlocks válido.");
            }
        };
        reader.readAsText(file);
    });
});
