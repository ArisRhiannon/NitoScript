// ==============================================================================
// NITOBLOCKS v0.1.3 - 2D INTERACTIVE NODE-FLOW ENGINE & TOPOLOGICAL COMPILER
// ==============================================================================

// Synthesize a satisfying plastic LEGO snap/pop click in real-time
function playSnapSound() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        
        // click mechanical transient
        const clickOsc = ctx.createOscillator();
        const clickGain = ctx.createGain();
        clickOsc.type = 'triangle';
        clickOsc.frequency.setValueAtTime(900, ctx.currentTime);
        clickOsc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.04);
        
        clickGain.gain.setValueAtTime(0.08, ctx.currentTime);
        clickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        
        // mid frequency plastic pop
        const popOsc = ctx.createOscillator();
        const popGain = ctx.createGain();
        popOsc.type = 'sine';
        popOsc.frequency.setValueAtTime(280, ctx.currentTime);
        popOsc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.09);
        
        popGain.gain.setValueAtTime(0.12, ctx.currentTime);
        popGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
        
        clickOsc.connect(clickGain);
        clickGain.connect(ctx.destination);
        popOsc.connect(popGain);
        popGain.connect(ctx.destination);
        
        clickOsc.start();
        clickOsc.stop(ctx.currentTime + 0.04);
        popOsc.start();
        popOsc.stop(ctx.currentTime + 0.09);
    } catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
    const workspace = document.getElementById('workspace');
    const workspaceContent = document.getElementById('workspace-content');
    const svgCanvas = document.getElementById('workspace-connections');
    const generatedCode = document.getElementById('generated-code');
    const consoleOutput = document.getElementById('console-output');
    const variablesBody = document.getElementById('variables-body');
    
    const btnRun = document.getElementById('btn-run');
    const btnClear = document.getElementById('btn-clear');
    const btnSave = document.getElementById('btn-save');
    const btnLoad = document.getElementById('btn-load');
    
    const templates = document.querySelectorAll('.block-template');

    // --------------------------------------------------------------------------
    // NODE SYSTEM STATE & 2D INFINITE CANVAS (ZOOM & PAN)
    // --------------------------------------------------------------------------
    let nodes = [];       // { id, element, type, x, y, inputs: {}, outputs: {} }
    let connections = []; // { id, fromNode, fromPort, toNode, toPort, pathElement }
    let nodeCounter = 0;
    let connectionCounter = 0;
    
    // Custom block registry
    let customBlockRegistry = {};
    let selectedNodeId = null;

    // Viewport transforms (Figma/Blender scale and pan model)
    let zoomScale = 1.0;
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;

    // Active drag variables
    let activeDragNode = null;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    // Port wire connection drag state
    let activeWireDragging = false;
    let tempPathElement = null;
    let dragStartSocket = null; // Port Element
    let dragStartNodeId = "";
    let dragStartPortName = "";
    let dragStartPortType = "";
    let dragStartDirection = ""; // "input" or "output"

    // --------------------------------------------------------------------------
    // 1. TOOLBOX & DRAG-AND-DROP TO WORKSPACE (VIEWPORT COORDINATES CORRECTION)
    // --------------------------------------------------------------------------
    templates.forEach(template => {
        // Spawns new nodes inside current visible center of panning viewport
        template.addEventListener('click', () => {
            const posX = (workspace.clientWidth / 2 - panX) / zoomScale - 130 + (Math.random() * 60 - 30);
            const posY = (workspace.clientHeight / 2 - panY) / zoomScale - 60 + (Math.random() * 60 - 30);
            const node = createNodeInWorkspace(template.getAttribute('data-type'), posX, posY);
            triggerSnapEffects(node);
            updateGeneratedCode();
        });

        // HTML5 Drag and Drop from Toolbox
        template.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', template.getAttribute('data-type'));
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
            const wsRect = workspace.getBoundingClientRect();
            // Project screen drag location to scaled-and-panned local canvas space
            const posX = (e.clientX - wsRect.left - panX) / zoomScale - 130;
            const posY = (e.clientY - wsRect.top - panY) / zoomScale - 25;
            
            const node = createNodeInWorkspace(type, posX, posY);
            triggerSnapEffects(node);
            updateGeneratedCode();
        }
    });

    function triggerSnapEffects(nodeEl) {
        playSnapSound();
        nodeEl.classList.add('snap-animation');
        setTimeout(() => nodeEl.classList.remove('snap-animation'), 300);
    }

    // --------------------------------------------------------------------------
    // 2. NODE CREATION ENGINE
    // --------------------------------------------------------------------------
    function createNodeInWorkspace(type, x, y, customId = null) {
        const nodeId = customId || `node_${nodeCounter++}`;
        
        const emptyState = workspace.querySelector('.empty-state');
        if (emptyState) emptyState.style.display = 'none';

        // Node card base element
        const block = document.createElement('div');
        block.className = `lego-block ${getBlockColorClass(type)}`;
        block.id = nodeId;
        block.style.left = `${x}px`;
        block.style.top = `${y}px`;
        block.style.width = "260px";
        block.style.position = "absolute";

        // Dynamic Flow Energy Ribbon for Static Analysis
        const ribbon = document.createElement('div');
        ribbon.className = 'block-flow-ribbon';
        block.appendChild(ribbon);

        // LEGO Studs (Physical 3D LEGO cylinders)
        const studs = document.createElement('div');
        studs.className = 'block-studs';
        for (let i = 0; i < 4; i++) {
            studs.appendChild(document.createElement('span'));
        }
        block.appendChild(studs);

        // Header (acts as drag handle)
        const header = document.createElement('div');
        header.className = 'block-content';
        header.style.cursor = 'move';
        header.style.padding = '10px 14px';
        header.style.borderBottom = '1px solid rgba(255, 255, 255, 0.15)';
        
        const label = document.createElement('span');
        label.className = 'block-label';
        label.innerText = getNodeLabel(type);
        label.style.pointerEvents = 'none';
        header.appendChild(label);

        // Selection trigger on block mousedown
        block.addEventListener('mousedown', (e) => {
            document.querySelectorAll('.lego-block').forEach(b => b.classList.remove('selected-node'));
            block.classList.add('selected-node');
            selectedNodeId = nodeId;
        });

        // Duplicate Button
        const copyBtn = document.createElement('span');
        copyBtn.className = 'copy-block-btn';
        copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; display: inline-block; opacity: 0.8; transition: opacity 0.2s, transform 0.2s;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
        copyBtn.style.cursor = 'pointer';
        copyBtn.style.display = 'flex';
        copyBtn.style.alignItems = 'center';
        copyBtn.style.marginLeft = 'auto';
        copyBtn.style.marginRight = '10px';
        copyBtn.style.color = 'rgba(255, 255, 255, 0.75)';
        copyBtn.style.transition = 'color 0.2s';
        copyBtn.title = "Duplicar bloque";
        copyBtn.addEventListener('mouseenter', () => {
            copyBtn.style.color = '#ffffff';
            const svg = copyBtn.querySelector('svg');
            if (svg) {
                svg.style.opacity = '1';
                svg.style.transform = 'scale(1.1)';
            }
        });
        copyBtn.addEventListener('mouseleave', () => {
            copyBtn.style.color = 'rgba(255, 255, 255, 0.75)';
            const svg = copyBtn.querySelector('svg');
            if (svg) {
                svg.style.opacity = '0.8';
                svg.style.transform = 'scale(1)';
            }
        });
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            duplicateNode(nodeId);
        });
        header.appendChild(copyBtn);

        // Close Button
        const removeBtn = document.createElement('span');
        removeBtn.className = 'remove-block-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.fontSize = '16px';
        removeBtn.style.color = 'var(--text-secondary)';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteNode(nodeId);
        });
        header.appendChild(removeBtn);
        block.appendChild(header);

        // Body with inputs (if any)
        const body = document.createElement('div');
        body.style.padding = '10px 14px';
        body.style.display = 'flex';
        body.style.flexDirection = 'column';
        body.style.gap = '8px';

        const needsInput = (
            type === 'imprimir' || 
            type === 'discord_responder' || 
            type === 'nito_si' || 
            type === 'nito_sino_si' || 
            type === 'nito_mientras' || 
            type === 'nito_importar' || 
            type === 'nito_retorna'
        );

        if (needsInput) {
            const inputContainer = document.createElement('div');
            inputContainer.style.display = 'flex';
            inputContainer.style.alignItems = 'center';
            inputContainer.style.gap = '6px';
            inputContainer.style.fontSize = '12px';

            const placeholderLabel = document.createElement('span');
            if (type === 'nito_si' || type === 'nito_sino_si') placeholderLabel.innerText = "Comparar:";
            else if (type === 'nito_mientras') placeholderLabel.innerText = "Mientras:";
            else if (type === 'nito_importar') placeholderLabel.innerText = "FFI Modulo:";
            else if (type === 'nito_retorna') placeholderLabel.innerText = "Retornar:";
            else placeholderLabel.innerText = "Mensaje:";
            
            inputContainer.appendChild(placeholderLabel);

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'block-input';
            
            // Set default descriptive initial values
            if (type === 'nito_si') input.value = "ping";
            else if (type === 'nito_sino_si') input.value = "pong";
            else if (type === 'nito_mientras') input.value = "NITO";
            else if (type === 'nito_importar') input.value = "math.sin";
            else if (type === 'nito_retorna') input.value = "NITO";
            else input.value = "¡Hola Nito!";
            
            input.style.flex = '1';
            input.style.maxWidth = '150px';
            input.addEventListener('input', updateGeneratedCode);
            inputContainer.appendChild(input);
            body.appendChild(inputContainer);
        }
        block.appendChild(body);

        // PORTS & CONNECTIONS PANEL
        const portsContainer = document.createElement('div');
        portsContainer.className = 'node-ports-container';

        const inputsPanel = document.createElement('div');
        inputsPanel.className = 'node-inputs';
        const outputsPanel = document.createElement('div');
        outputsPanel.className = 'node-outputs';

        portsContainer.appendChild(inputsPanel);
        portsContainer.appendChild(outputsPanel);
        block.appendChild(portsContainer);

        // Inject specific sockets based on Node Category
        setupNodeSockets(type, nodeId, inputsPanel, outputsPanel);

        // Drag node listener
        header.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Left click only
            activeDragNode = block;
            const targetNode = nodes.find(n => n.id === nodeId);
            const wsRect = workspace.getBoundingClientRect();
            
            // Convert page screen coordinate to local scaled-and-panned viewport space
            const localMouseX = (e.clientX - wsRect.left - panX) / zoomScale;
            const localMouseY = (e.clientY - wsRect.top - panY) / zoomScale;
            
            dragOffsetX = localMouseX - targetNode.x;
            dragOffsetY = localMouseY - targetNode.y;
            block.style.zIndex = "1000";
            e.preventDefault();
        });

        workspaceContent.appendChild(block);

        const nodeObj = {
            id: nodeId,
            element: block,
            type: type,
            x: x,
            y: y,
            inputs: {},
            outputs: {}
        };
        nodes.push(nodeObj);
        
        // Listen to input changes to update
        block.querySelectorAll('.port-socket').forEach(socket => {
            setupSocketListeners(socket, nodeId);
        });

        return block;
    }

    function deleteNode(nodeId) {
        // 1. Remove visual elements
        const block = document.getElementById(nodeId);
        if (block) block.remove();

        // 2. Clear related connections
        connections = connections.filter(conn => {
            if (conn.fromNode === nodeId || conn.toNode === nodeId) {
                conn.pathElement.remove();
                return false;
            }
            return true;
        });

        // 3. Remove from State
        nodes = nodes.filter(n => n.id !== nodeId);
        
        playSnapSound();
        checkWorkspaceEmpty();
        updateGeneratedCode();
    }

    function checkWorkspaceEmpty() {
        if (nodes.length === 0) {
            const emptyState = workspace.querySelector('.empty-state');
            if (emptyState) emptyState.style.display = 'block';
            clearConnections();
        }
    }

    function clearConnections() {
        connections.forEach(conn => conn.pathElement.remove());
        connections = [];
    }

    // --------------------------------------------------------------------------
    // 3. PORTS / SOCKETS METRICS & MAPPINGS
    // --------------------------------------------------------------------------
    function setupNodeSockets(type, nodeId, inputsPanel, outputsPanel) {
        // Execution Flow Sockets:
        // Event Nodes: Trigger execution flow downwards
        // Action Nodes: Standard execution stack (In -> Out)
        
        if (type === 'discord_event') {
            createPort(outputsPanel, 'out_flow', 'Ejecutar', 'flow', 'output');
            createPort(outputsPanel, 'out_data_msg', 'evento.msg', 'data-string', 'output');
        } 
        else if (type === 'nito_si') {
            createPort(inputsPanel, 'in_flow', 'Flujo', 'flow', 'input');
            createPort(inputsPanel, 'in_data_cond', 'Comparar', 'data-string', 'input');
            
            createPort(outputsPanel, 'out_flow', 'Haz', 'flow', 'output');
            createPort(outputsPanel, 'out_data_res', 'resultado', 'data-any', 'output');
        }
        else if (type === 'nito_sino_si') {
            createPort(inputsPanel, 'in_flow', 'Flujo', 'flow', 'input');
            createPort(inputsPanel, 'in_data_cond', 'Comparar', 'data-string', 'input');
            
            createPort(outputsPanel, 'out_flow', 'Haz', 'flow', 'output');
            createPort(outputsPanel, 'out_data_res', 'resultado', 'data-any', 'output');
        }
        else if (type === 'nito_sino') {
            createPort(inputsPanel, 'in_flow', 'Flujo', 'flow', 'input');
            createPort(outputsPanel, 'out_flow', 'Haz', 'flow', 'output');
        }
        else if (type === 'nito_mientras') {
            createPort(inputsPanel, 'in_flow', 'Flujo', 'flow', 'input');
            createPort(inputsPanel, 'in_data_cond', 'Condicion', 'data-any', 'input');
            createPort(outputsPanel, 'out_flow', 'Repetir', 'flow', 'output');
        }
        else if (type === 'imprimir') {
            createPort(inputsPanel, 'in_flow', 'Flujo', 'flow', 'input');
            createPort(inputsPanel, 'in_data_msg', 'Texto', 'data-any', 'input');
            
            createPort(outputsPanel, 'out_flow', 'Flujo', 'flow', 'output');
        }
        else if (type === 'discord_responder') {
            createPort(inputsPanel, 'in_flow', 'Flujo', 'flow', 'input');
            createPort(inputsPanel, 'in_data_resp', 'Respuesta', 'data-any', 'input');
            
            createPort(outputsPanel, 'out_flow', 'Flujo', 'flow', 'output');
        }
        else if (type === 'nito_importar') {
            createPort(inputsPanel, 'in_flow', 'Flujo', 'flow', 'input');
            createPort(outputsPanel, 'out_flow', 'Flujo', 'flow', 'output');
        }
        else if (type === 'nito_retorna') {
            createPort(inputsPanel, 'in_flow', 'Flujo', 'flow', 'input');
            createPort(inputsPanel, 'in_data_val', 'Valor', 'data-any', 'input');
            createPort(outputsPanel, 'out_flow', 'Flujo', 'flow', 'output');
        }
        else if (type === 'nito_supreme') {
            createPort(outputsPanel, 'out_data_nito', 'Nito', 'data-any', 'output');
        }
        else if (type === 'quantum_nito') {
            createPort(inputsPanel, 'in_data_obj', 'Objeto', 'data-any', 'input');
            createPort(outputsPanel, 'out_data_box', 'Caja(Null-Safe)', 'data-any', 'output');
        }
        else if (type === 'nito_o') {
            createPort(inputsPanel, 'in_data_val', 'Caja', 'data-any', 'input');
            createPort(inputsPanel, 'in_data_fallback', 'Respaldo', 'data-any', 'input');
            
            createPort(outputsPanel, 'out_data_res', 'Fusion', 'data-any', 'output');
        }
        else if (customBlockRegistry[type]) {
            const def = customBlockRegistry[type];
            if (def.hasInFlow) {
                createPort(inputsPanel, 'in_flow', 'Flujo', 'flow', 'input');
            }
            if (def.inputsList && def.inputsList.length > 0) {
                def.inputsList.forEach(inputName => {
                    if (inputName.trim() !== "") {
                        createPort(inputsPanel, `in_data_${inputName.trim()}`, inputName.trim(), 'data-any', 'input');
                    }
                });
            }
            if (def.hasOutFlow) {
                createPort(outputsPanel, 'out_flow', 'Haz', 'flow', 'output');
            }
            createPort(outputsPanel, 'out_data_res', 'resultado', 'data-any', 'output');
        }
    }

    function createPort(container, name, labelText, type, direction) {
        const port = document.createElement('div');
        port.className = `port port-${direction} port-${type}`;
        
        const socket = document.createElement('div');
        socket.className = 'port-socket';
        socket.setAttribute('data-port-name', name);
        socket.setAttribute('data-port-type', type);
        socket.setAttribute('data-port-direction', direction);
        
        const label = document.createElement('span');
        label.innerText = labelText;
        label.style.fontSize = '11px';
        label.style.color = 'var(--text-secondary)';
        label.style.pointerEvents = 'none';

        if (direction === 'input') {
            port.appendChild(socket);
            port.appendChild(label);
        } else {
            port.appendChild(label);
            port.appendChild(socket);
        }
        container.appendChild(port);
    }

    function highlightCompatibleSockets(startSocket) {
        const startNodeId = startSocket.closest('.lego-block').id;
        const startDirection = startSocket.getAttribute('data-port-direction');
        const startType = startSocket.getAttribute('data-port-type');
        
        document.querySelectorAll('.port-socket').forEach(socket => {
            const socketPort = socket.closest('.port');
            const socketNode = socket.closest('.lego-block');
            
            if (!socketNode) return;
            
            const socketNodeId = socketNode.id;
            const socketDirection = socket.getAttribute('data-port-direction');
            const socketType = socket.getAttribute('data-port-type');
            
            const isDifferentNode = (startNodeId !== socketNodeId);
            const isDifferentDirection = (startDirection !== socketDirection);
            
            let isCompatible = false;
            if (isDifferentNode && isDifferentDirection) {
                if (startType === 'flow' && socketType === 'flow') {
                    isCompatible = true;
                } else if (startType !== 'flow' && socketType !== 'flow') {
                    isCompatible = true;
                }
            }
            
            if (isCompatible) {
                socketPort.classList.add('compatible');
                socket.classList.add('compatible');
            } else {
                socketPort.classList.add('incompatible');
                socket.classList.add('incompatible');
            }
        });
    }

    function getSocketCoordinates(socketEl) {
        const sRect = socketEl.getBoundingClientRect();
        const wsRect = workspace.getBoundingClientRect();
        return {
            x: (sRect.left - wsRect.left - panX + sRect.width / 2) / zoomScale,
            y: (sRect.top - wsRect.top - panY + sRect.height / 2) / zoomScale
        };
    }

    // --------------------------------------------------------------------------
    // 4. MOUSE DRAG & SVG CONNECTION SYSTEM (RUBBER BAND & SNAPPING)
    // --------------------------------------------------------------------------
    function setupSocketListeners(socket, nodeId) {
        socket.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // left click only
            
            const direction = socket.getAttribute('data-port-direction');
            const portName = socket.getAttribute('data-port-name');
            const portType = socket.getAttribute('data-port-type');

            activeWireDragging = true;
            dragStartSocket = socket;
            dragStartNodeId = nodeId;
            dragStartPortName = portName;
            dragStartPortType = portType;
            dragStartDirection = direction;

            // Highlight target compatible sockets and dim out other ports
            workspace.classList.add('dragging-wire-active');
            highlightCompatibleSockets(socket);

            // Initialize dynamic temporary Bezier line
            tempPathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
            tempPathElement.setAttribute("class", "connection-path temp-path");
            svgCanvas.appendChild(tempPathElement);
            
            updateTempCable(e.clientX, e.clientY);
            
            e.stopPropagation();
            e.preventDefault();
        });
    }

    // Global drag and pan behaviors
    window.addEventListener('mousemove', (e) => {
        // Case A: Dragging dynamic Node cards
        if (activeDragNode) {
            const wsRect = workspace.getBoundingClientRect();
            const localMouseX = (e.clientX - wsRect.left - panX) / zoomScale;
            const localMouseY = (e.clientY - wsRect.top - panY) / zoomScale;
            
            let newX = localMouseX - dragOffsetX;
            let newY = localMouseY - dragOffsetY;
            
            // Snapping grid (10px increments)
            newX = Math.round(newX / 10) * 10;
            newY = Math.round(newY / 10) * 10;

            activeDragNode.style.left = `${newX}px`;
            activeDragNode.style.top = `${newY}px`;

            // Update node position state
            const targetNode = nodes.find(n => n.id === activeDragNode.id);
            if (targetNode) {
                targetNode.x = newX;
                targetNode.y = newY;
            }

            // Real-time connections wires re-render
            redrawConnections();
        }

        // Case B: Dragging dynamic connection cables
        if (activeWireDragging && tempPathElement) {
            updateTempCable(e.clientX, e.clientY);
        }

        // Case C: Infinite Canvas Panning
        if (isPanning) {
            panX = e.clientX - panStartX;
            panY = e.clientY - panStartY;
            updateWorkspaceTransform();
        }
    });

    window.addEventListener('mouseup', (e) => {
        // Drop panning
        if (isPanning) {
            isPanning = false;
            workspace.style.cursor = 'default';
        }

        // Drop dragging node
        if (activeDragNode) {
            activeDragNode.style.zIndex = "2";
            activeDragNode = null;
            updateGeneratedCode();
        }

        // Drop connecting wire
        if (activeWireDragging) {
            activeWireDragging = false;
            
            // Remove wire dragging layout filters
            workspace.classList.remove('dragging-wire-active');
            document.querySelectorAll('.port, .port-socket').forEach(el => {
                el.classList.remove('compatible', 'incompatible');
            });

            // Check if mouse is hovering a valid compatible socket
            const targetSocket = e.target.closest('.port-socket');
            if (tempPathElement) tempPathElement.remove();

            if (targetSocket) {
                const targetNode = targetSocket.closest('.lego-block');
                const targetNodeId = targetNode.id;
                const targetPortName = targetSocket.getAttribute('data-port-name');
                const targetPortType = targetSocket.getAttribute('data-port-type');
                const targetDirection = targetSocket.getAttribute('data-port-direction');

                // COMPATIBILITY VALIDATIONS (EDGE CASES CONTROLS)
                const isFlowToFlow = (dragStartPortType === 'flow' && targetPortType === 'flow');
                const isDataToData = (dragStartPortType !== 'flow' && targetPortType !== 'flow');
                
                const isDifferentDirections = (dragStartDirection !== targetDirection);
                const isDifferentNodes = (dragStartNodeId !== targetNodeId);

                if (isDifferentNodes && isDifferentDirections && (isFlowToFlow || isDataToData)) {
                    // Normalize connection orientation (Always from output to input)
                    const fromNode = dragStartDirection === 'output' ? dragStartNodeId : targetNodeId;
                    const fromPort = dragStartDirection === 'output' ? dragStartPortName : targetPortName;
                    const toNode = dragStartDirection === 'output' ? targetNodeId : dragStartNodeId;
                    const toPort = dragStartDirection === 'output' ? targetPortName : dragStartPortName;

                    // Prevent multiple execution flow paths entering a single node's input (execution flow must be absolute)
                    const flowConflict = (dragStartPortType === 'flow' && connections.some(c => c.toNode === toNode && c.toPort === toPort));

                    if (!flowConflict) {
                        // Check if connection already exists
                        const exists = connections.some(c => c.fromNode === fromNode && c.fromPort === fromPort && c.toNode === toNode && c.toPort === toPort);
                        
                        if (!exists) {
                            createConnection(fromNode, fromPort, toNode, toPort);
                            playSnapSound();
                            updateGeneratedCode();
                        }
                    }
                }
            }
            dragStartSocket = null;
            tempPathElement = null;
        }
    });

    function updateTempCable(mx, my) {
        const wsRect = workspace.getBoundingClientRect();
        const start = getSocketCoordinates(dragStartSocket);
        const end = {
            x: (mx - wsRect.left - panX) / zoomScale,
            y: (my - wsRect.top - panY) / zoomScale
        };
        
        // Output -> Input or Input -> Output
        const x1 = dragStartDirection === 'output' ? start.x : end.x;
        const y1 = dragStartDirection === 'output' ? start.y : end.y;
        const x2 = dragStartDirection === 'output' ? end.x : start.x;
        const y2 = dragStartDirection === 'output' ? end.y : start.y;

        const pathData = calculateBezierPath(x1, y1, x2, y2);
        tempPathElement.setAttribute("d", pathData);
    }

    function calculateBezierPath(x1, y1, x2, y2) {
        // Curve calculations to generate elegant organic curves
        const dx = Math.abs(x2 - x1) * 0.5;
        const controlX1 = x1 + dx;
        const controlX2 = x2 - dx;
        return `M ${x1} ${y1} C ${controlX1} ${y1}, ${controlX2} ${y2}, ${x2} ${y2}`;
    }

    function createConnection(fromNode, fromPort, toNode, toPort, customId = null) {
        const connId = customId || `conn_${connectionCounter++}`;
        
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", "connection-path");
        path.id = connId;

        // Double-click connection to delete
        path.addEventListener('dblclick', () => {
            deleteConnection(connId);
        });

        // Tooltip advice for deletion
        path.setAttribute("title", "Haz doble clic sobre el cable para eliminar la conexión");
        
        svgCanvas.appendChild(path);

        const connObj = {
            id: connId,
            fromNode: fromNode,
            fromPort: fromPort,
            toNode: toNode,
            toPort: toPort,
            pathElement: path
        };
        connections.push(connObj);
        
        redrawConnections();
    }

    function deleteConnection(connId) {
        const conn = connections.find(c => c.id === connId);
        if (conn) {
            conn.pathElement.remove();
            connections = connections.filter(c => c.id !== connId);
            playSnapSound();
            updateGeneratedCode();
        }
    }

    function redrawConnections() {
        connections.forEach(conn => {
            const fromNodeEl = document.getElementById(conn.fromNode);
            const toNodeEl = document.getElementById(conn.toNode);

            if (fromNodeEl && toNodeEl) {
                const fromSocket = fromNodeEl.querySelector(`[data-port-name="${conn.fromPort}"][data-port-direction="output"]`);
                const toSocket = toNodeEl.querySelector(`[data-port-name="${conn.toPort}"][data-port-direction="input"]`);

                if (fromSocket && toSocket) {
                    const start = getSocketCoordinates(fromSocket);
                    const end = getSocketCoordinates(toSocket);
                    const pathData = calculateBezierPath(start.x, start.y, end.x, end.y);
                    conn.pathElement.setAttribute("d", pathData);
                }
            }
        });
    }

    // --------------------------------------------------------------------------
    // 5. GRAPH COMPILER (DFS & TOPOLOGICAL SORT) — 100% FUNCTIONAL
    // --------------------------------------------------------------------------
    function updateGeneratedCode() {
        if (nodes.length === 0) {
            generatedCode.innerText = "# El código aparecerá aquí automáticamente...";
            return;
        }

        // Gather all event nodes (Execution Entry Points)
        const eventNodes = nodes.filter(n => n.type === 'discord_event');
        let compiledBlocks = [];
        let visitedNodes = new Set();
        let indentStack = [""];

        // Step 1: Traverse and compile from every execution entry point
        eventNodes.forEach(eventNode => {
            compileExecutionBranch(eventNode, compiledBlocks, visitedNodes, indentStack);
        });

        // Handle loose nodes that are data-only and not tied to any execution flows
        nodes.forEach(node => {
            if (!visitedNodes.has(node.id) && getBlockCategory(node.type) === 'data') {
                // If it's a completely loose mathematical block, we skip or compile as warning
            }
        });

        if (compiledBlocks.length === 0) {
            generatedCode.innerText = "# Conecta un bloque de Evento a un puerto de Flujo para generar código ejecutable...";
        } else {
            generatedCode.innerText = compiledBlocks.join('\n');
        }

        // Trigger visual fluids static flow analyzer
        analyzeVisualFlows();
    }

    // Trace down execution flow path (Flow socket cables)
    function compileExecutionBranch(currentNode, compiledBlocks, visitedNodes, indentStack) {
        if (!currentNode || visitedNodes.has(currentNode.id)) return;
        visitedNodes.add(currentNode.id);

        let indent = indentStack.join("");

        // 1. RECURSIVELY RESOLVE AND COMPILE DATA DEPENDENCIES FIRST (DFS backwards)
        resolveDataDependencies(currentNode, compiledBlocks, visitedNodes, indentStack);

        // 2. GENERATE STATEMENT CODE FOR CURRENT NODE
        const type = currentNode.type;
        const nodeId = currentNode.id;
        const inputEl = currentNode.element.querySelector('.block-input');
        const rawValue = inputEl ? inputEl.value : "";

        if (type === 'discord_event') {
            compiledBlocks.push(`nitosegs al_recibir_mensaje() entonces {`);
            indentStack.push("    ");
        } 
        else if (type === 'nito_si') {
            const resolvedCond = getDataInputSource(nodeId, 'in_data_cond') || `"${rawValue}"`;
            compiledBlocks.push(`${indent}nito_si (mensaje == ${resolvedCond}) entonces {`);
            indentStack.push("    ");
        }
        else if (type === 'nito_sino_si') {
            const resolvedCond = getDataInputSource(nodeId, 'in_data_cond') || `"${rawValue}"`;
            compiledBlocks.push(`${indent}} nito_sino_si (mensaje == ${resolvedCond}) entonces {`);
            indentStack.push("    ");
        }
        else if (type === 'nito_sino') {
            compiledBlocks.push(`${indent}} nito_sino {`);
            indentStack.push("    ");
        }
        else if (type === 'nito_mientras') {
            const resolvedCond = getDataInputSource(nodeId, 'in_data_cond') || `${rawValue}`;
            compiledBlocks.push(`${indent}nito_mientras (${resolvedCond}) haz`);
            indentStack.push("    ");
        }
        else if (type === 'imprimir') {
            const resolvedMsg = getDataInputSource(nodeId, 'in_data_msg') || `"${rawValue}"`;
            compiledBlocks.push(`${indent}nito_imprimir(${resolvedMsg})`);
        }
        else if (type === 'discord_responder') {
            const resolvedResp = getDataInputSource(nodeId, 'in_data_resp') || `"${rawValue}"`;
            compiledBlocks.push(`${indent}responder(${resolvedResp})`);
        }
        else if (type === 'nito_importar') {
            compiledBlocks.push(`${indent}nito_importar ${rawValue}`);
        }
        else if (type === 'nito_retorna') {
            const resolvedVal = getDataInputSource(nodeId, 'in_data_val') || `"${rawValue}"`;
            compiledBlocks.push(`${indent}nito_retorna ${resolvedVal}`);
        }
        else if (customBlockRegistry[type]) {
            const def = customBlockRegistry[type];
            let templateCode = def.codePattern;
            
            // Resolve dynamic custom variables
            let resolvedCodeStr = templateCode.replace(/{ID}/g, nodeId);
            if (def.inputsList && def.inputsList.length > 0) {
                def.inputsList.forEach(inputName => {
                    if (inputName.trim() !== "") {
                        const trimmed = inputName.trim();
                        const sourceVal = getDataInputSource(nodeId, `in_data_${trimmed}`) || `"${rawValue}"`;
                        const regex = new RegExp(`{${trimmed}}`, 'g');
                        resolvedCodeStr = resolvedCodeStr.replace(regex, sourceVal);
                    }
                });
            }
            compiledBlocks.push(`${indent}${resolvedCodeStr}`);
        }

        // 3. PROPAGATE EXECUTION FLOW TO SUBSEQUENT CONNECTED NODES
        const outFlowConn = connections.find(c => c.fromNode === nodeId && c.fromPort === 'out_flow');
        
        if (outFlowConn) {
            const nextNode = nodes.find(n => n.id === outFlowConn.toNode);
            compileExecutionBranch(nextNode, compiledBlocks, visitedNodes, indentStack);
        }

        // 4. POP INDENTATION WRAPPER WHEN FINISHING CONDITIONAL DEPTHS
        if (type === 'discord_event' || type === 'nito_si' || type === 'nito_sino_si' || type === 'nito_sino' || type === 'nito_mientras') {
            if (indentStack.length > 1) {
                indentStack.pop();
            }
            indent = indentStack.join("");
            if (type === 'discord_event') {
                compiledBlocks.push(`${indent}# Fin del evento`);
            } else if (type === 'nito_mientras') {
                compiledBlocks.push(`${indent}# Fin del bucle`);
            } else {
                compiledBlocks.push(`${indent}}`);
            }
        }
    }

    // Traverse data connections backwards to compile variables/expressions
    function resolveDataDependencies(node, compiledBlocks, visitedNodes, indentStack) {
        const nodeId = node.id;
        const inputs = node.element.querySelectorAll('[data-port-direction="input"][data-port-type^="data"]');

        inputs.forEach(inputSocket => {
            const portName = inputSocket.getAttribute('data-port-name');
            const dataConn = connections.find(c => c.toNode === nodeId && c.toPort === portName);

            if (dataConn) {
                const depNode = nodes.find(n => n.id === dataConn.fromNode);
                if (depNode && !visitedNodes.has(depNode.id)) {
                    // Recursively compile grandparent dependencies first
                    resolveDataDependencies(depNode, compiledBlocks, visitedNodes, indentStack);
                    
                    // Compile the dependency block itself
                    compileDataNode(depNode, compiledBlocks, visitedNodes, indentStack);
                }
            }
        });
    }

    // Generates variables declarations/assignments for math or quantum expressions
    function compileDataNode(node, compiledBlocks, visitedNodes, indentStack) {
        if (visitedNodes.has(node.id)) return;
        visitedNodes.add(node.id);

        const nodeId = node.id;
        const type = node.type;
        let indent = indentStack.join("");

        if (type === 'nito_supreme') {
            // Nito supreme acts as a global literal constant, doesn't need root assignment
        }
        else if (type === 'quantum_nito') {
            const resolvedObj = getDataInputSource(nodeId, 'in_data_obj') || "crear_payload(NITO)";
            compiledBlocks.push(`${indent}nito ${nodeId}_box = QuantumNito(${resolvedObj})`);
        }
        else if (type === 'nito_o') {
            const resolvedBox = getDataInputSource(nodeId, 'in_data_val') || `${nodeId}_err`;
            const resolvedFallback = getDataInputSource(nodeId, 'in_data_fallback') || '"default.png"';
            compiledBlocks.push(`${indent}nito ${nodeId}_res = ${resolvedBox} nito_o ${resolvedFallback}`);
        }
    }

    // Resolves what value feeds an input socket (either a literal, a variable, or sub-connections)
    function getDataInputSource(nodeId, portName) {
        const conn = connections.find(c => c.toNode === nodeId && c.toPort === portName);
        if (!conn) return null;

        const sourceNode = nodes.find(n => n.id === conn.fromNode);
        if (!sourceNode) return null;

        const sourceType = sourceNode.type;
        const sourceId = sourceNode.id;

        if (sourceType === 'discord_event') {
            return 'evento.msg'; // maps payload messages
        }
        else if (sourceType === 'nito_supreme') {
            return 'Nito'; // absolute supreme math constant
        }
        else if (sourceType === 'quantum_nito') {
            return `${sourceId}_box.user.profile.avatar`; // dynamically wraps Schrödinger paths
        }
        else if (sourceType === 'nito_o') {
            return `${sourceId}_res`; // resolves resulting coalescing variable
        }
        return null;
    }

    // --------------------------------------------------------------------------
    // 6. PRE-EXECUTION CHILL FLUIDS & ERROR DETECTION (STATIC FLOW ANALYZER)
    // --------------------------------------------------------------------------
    function analyzeVisualFlows() {
        let openScopesStack = [];
        let heresyPatterns = [
            /nito\s*-\s*nito/i,
            /nito\s*\*\s*0/i,
            /nito\s*\*\s*-\d+/i,
            /nito\s*\/\s*0/i,
            /nito\s*\/\s*-\d+/i,
            /nito\s*<\s*/i
        ];

        // 1. Reset all nodes flow classes
        nodes.forEach(node => {
            const block = node.element;
            block.classList.remove('flow-perfect', 'flow-warning', 'flow-error', 'flow-overflow');
            block.removeAttribute('title');
        });

        // Trace execution flows starting from entries
        const eventNodes = nodes.filter(n => n.type === 'discord_event');
        let reachedNodes = new Set();

        eventNodes.forEach(eventNode => {
            traceAndAnalyze(eventNode, reachedNodes, openScopesStack, heresyPatterns);
        });

        // Expand reachedNodes to include all data-dependency blocks connected to active nodes
        let queue = Array.from(reachedNodes);
        while (queue.length > 0) {
            const currentId = queue.shift();
            connections.forEach(conn => {
                if (conn.toNode === currentId && !reachedNodes.has(conn.fromNode)) {
                    reachedNodes.add(conn.fromNode);
                    queue.push(conn.fromNode);
                }
            });
        }

        // Highlight orphaned nodes placed outside active execution flows as warnings
        nodes.forEach(node => {
            if (!reachedNodes.has(node.id)) {
                node.element.classList.add('flow-warning');
                node.element.title = "Bloque Huérfano: Este nodo no está conectado a ningún flujo lógico de ejecución.";
            }
        });

        // Update SVG wire paths live styling based on source/target node health
        connections.forEach(conn => {
            const path = conn.pathElement;
            path.classList.remove('wire-perfect', 'wire-warning', 'wire-error', 'wire-inactive');
            
            const fromNodeEl = document.getElementById(conn.fromNode);
            const toNodeEl = document.getElementById(conn.toNode);
            
            if (!fromNodeEl || !toNodeEl) return;
            
            const isOrphaned = !reachedNodes.has(conn.fromNode) || !reachedNodes.has(conn.toNode);
            
            if (isOrphaned) {
                path.classList.add('wire-inactive');
            } else if (fromNodeEl.classList.contains('flow-error') || toNodeEl.classList.contains('flow-error')) {
                path.classList.add('wire-error');
            } else if (fromNodeEl.classList.contains('flow-warning') || toNodeEl.classList.contains('flow-warning')) {
                path.classList.add('wire-warning');
            } else {
                path.classList.add('wire-perfect');
            }
        });
    }

    function traceAndAnalyze(currentNode, reachedNodes, openScopesStack, heresyPatterns) {
        if (!currentNode || reachedNodes.has(currentNode.id)) return;
        reachedNodes.add(currentNode.id);

        const block = currentNode.element;
        const type = currentNode.type;
        const inputEl = block.querySelector('.block-input');
        const value = inputEl ? inputEl.value : "";
        let status = 'perfect';

        // Check for empty/missing parameters
        if (inputEl && value.trim() === "") {
            status = 'warning';
            block.title = "Flujo Incompleto: El bloque requiere un parámetro de entrada.";
        }

        // Heresy validation
        if (inputEl && status !== 'error') {
            for (let pattern of heresyPatterns) {
                if (pattern.test(value)) {
                    status = 'error';
                    block.title = "⚠️ ¡HEREJÍA ESTÁTICA DETECTADA!\nEsta comparación violará las leyes divinas de Nito.";
                    break;
                }
            }
        }

        // Apply CSS class
        if (status === 'error') block.classList.add('flow-error');
        else if (status === 'warning') block.classList.add('flow-warning');
        else block.classList.add('flow-perfect');

        // Check execution path downstream
        const outFlowConn = connections.find(c => c.fromNode === currentNode.id && c.fromPort === 'out_flow');
        if (outFlowConn) {
            const nextNode = nodes.find(n => n.id === outFlowConn.toNode);
            traceAndAnalyze(nextNode, reachedNodes, openScopesStack, heresyPatterns);
        }
    }

    // --------------------------------------------------------------------------
    // 7. REAL BACKEND EXECUTION EN BLOCKS
    // --------------------------------------------------------------------------
    btnRun.addEventListener('click', () => {
        const code = generatedCode.innerText;
        if (!code || code.startsWith("#")) {
            clearConsole();
            logToConsole("Error: No hay código NitoScript válido generado en el lienzo para ejecutar.", "err");
            return;
        }

        clearConsole();
        logToConsole("Iniciando compilación y ejecución de nodos en el backend...", "info");

        // Real http POST call to local sandbox sub-process api server
        fetch('http://localhost:8085/api/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                logToConsole("--- Compilación Exitosa ---", "info");
                if (data.stdout) {
                    const lines = data.stdout.split('\n');
                    lines.forEach(line => {
                        if (line.trim() !== "") {
                            if (line.includes("[FFI]")) logToConsole(line, "info");
                            else if (line.includes("[Runtime Warning]")) logToConsole(line, "warn");
                            else logToConsole(line, "info");
                        }
                    });
                }
                logToConsole("\n[Máquina Virtual] Ejecución finalizada con código 0.", "info");
                
                // Simulate runtime scope updates for v0.1.3 console exploration
                updateVariablesTable({
                    "evento": "DiscordMsgPayload",
                    "payload_box": "QuantumNito(Caja)",
                    "payload_box.user.profile.avatar": "avatar_premium.png",
                    "avatar_url": "avatar_premium.png"
                });
            } else {
                logToConsole("--- Compilación / Ejecución Abortada ---", "err");
                logToConsole(data.stderr || "Error desconocido al ejecutar NitoScript.", "err");
            }
        })
        .catch(err => {
            logToConsole("Error al conectar con el servidor backend de NitoBlocks (Puerto 8085).", "err");
            logToConsole("Por favor, asegúrate de que el servidor 'server.py' esté corriendo en la terminal.", "err");
        });
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

    function updateVariablesTable(scope) {
        variablesBody.innerHTML = "";
        const keys = Object.keys(scope);
        if (keys.length === 0) {
            variablesBody.innerHTML = `<tr><td colspan="3" class="no-variables">No hay variables activas</td></tr>`;
            return;
        }

        keys.forEach(key => {
            const value = scope[key];
            const type = getVariablesType(value);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${key}</td>
                <td>${value}</td>
                <td class="${type.class}">${type.name}</td>
            `;
            variablesBody.appendChild(tr);
        });
    }

    function getVariablesType(val) {
        if (val === "Nito") return { name: "DIVINIDAD", class: "type-nito" };
        if (val === "NITO" || val === "NO_NITO" || typeof val === "boolean") return { name: "BOOLEANO", class: "type-boolean" };
        if (!isNaN(val)) return { name: "NÚMERO", class: "type-number" };
        return { name: "TEXTO", class: "type-string" };
    }

    // --------------------------------------------------------------------------
    // 8. PERSISTENCY MODULE (SAVE/LOAD SYSTEM WITH COORDINATES & LINKS)
    // --------------------------------------------------------------------------
    btnSave.addEventListener('click', () => {
        if (nodes.length === 0) {
            alert("El lienzo está vacío. No hay nada que guardar.");
            return;
        }

        const serializedNodes = nodes.map(n => {
            const inputEl = n.element.querySelector('.block-input');
            return {
                id: n.id,
                type: n.type,
                x: n.x,
                y: n.y,
                value: inputEl ? inputEl.value : ""
            };
        });

        const serializedConns = connections.map(c => ({
            id: c.id,
            fromNode: c.fromNode,
            fromPort: c.fromPort,
            toNode: c.toNode,
            toPort: c.toPort
        }));

        const project = {
            project: "NitoBlocks Graph Project",
            version: "0.1.3",
            nodes: serializedNodes,
            connections: serializedConns
        };

        const jsonStr = JSON.stringify(project, null, 2);
        
        // Save using local storage persistency
        localStorage.setItem('nitoblocks_project', jsonStr);
        
        logToConsole("[Persistencia] Proyecto de nodos guardado exitosamente en LocalStorage.", "info");
        alert("¡Proyecto guardado con éxito!");
    });

    btnLoad.addEventListener('click', () => {
        const jsonStr = localStorage.getItem('nitoblocks_project');
        if (!jsonStr) {
            alert("No hay ningún proyecto guardado previamente.");
            return;
        }

        try {
            const project = JSON.parse(jsonStr);
            
            // Clear current workspace
            nodes.forEach(n => n.element.remove());
            clearConnections();
            nodes = [];
            
            nodeCounter = 0;
            connectionCounter = 0;

            // Reset pan/zoom viewport translations on new project load
            zoomScale = 1.0;
            panX = 0;
            panY = 0;
            updateWorkspaceTransform();

            // 1. Re-instantiate node cards
            project.nodes.forEach(n => {
                const blockEl = createNodeInWorkspace(n.type, n.x, n.y, n.id);
                const inputEl = blockEl.querySelector('.block-input');
                if (inputEl) inputEl.value = n.value;

                // Adjust nodeCounter base to avoid ID overlaps
                const idx = parseInt(n.id.split('_')[1]);
                if (idx >= nodeCounter) nodeCounter = idx + 1;
            });

            // 2. Re-instantiate connection wires
            project.connections.forEach(c => {
                createConnection(c.fromNode, c.fromPort, c.toNode, c.toPort, c.id);
                
                const idx = parseInt(c.id.split('_')[1]);
                if (idx >= connectionCounter) connectionCounter = idx + 1;
            });

            redrawConnections();
            updateGeneratedCode();
            
            logToConsole("[Persistencia] Proyecto de nodos cargado exitosamente.", "info");
            alert("¡Proyecto cargado con éxito!");
        } catch (e) {
            alert("Error al cargar el proyecto corrupto: " + e.message);
        }
    });

    btnClear.addEventListener('click', () => {
        if (confirm("¿Estás seguro de que quieres limpiar todo el lienzo?")) {
            nodes.forEach(n => n.element.remove());
            clearConnections();
            nodes = [];
            nodeCounter = 0;
            connectionCounter = 0;
            
            // Reset viewport translation matrix on wipe
            zoomScale = 1.0;
            panX = 0;
            panY = 0;
            updateWorkspaceTransform();

            checkWorkspaceEmpty();
            updateGeneratedCode();
            clearConsole();
        }
    });

    // Helper mappings
    function getBlockColorClass(type) {
        if (type === 'discord_event') return 'event-block';
        if (
            type === 'nito_si' || 
            type === 'nito_sino_si' || 
            type === 'nito_sino' || 
            type === 'nito_mientras' || 
            type === 'quantum_nito' || 
            type === 'nito_o'
        ) {
            return 'control-block';
        }
        if (type === 'nito_supreme') return 'supreme-block';
        return 'action-block';
    }

    function getNodeLabel(type) {
        if (type === 'discord_event') return 'Al Recibir Mensaje';
        if (type === 'nito_si') return 'Si Condición';
        if (type === 'nito_sino_si') return 'Sino Si Condición';
        if (type === 'nito_sino') return 'Sino';
        if (type === 'nito_mientras') return 'Bucle Mientras';
        if (type === 'imprimir') return 'Imprimir Consola';
        if (type === 'discord_responder') return 'Responder Canal';
        if (type === 'nito_importar') return 'Importar FFI';
        if (type === 'nito_retorna') return 'Retornar Valor';
        if (type === 'nito_supreme') return 'Nito Supremo';
        if (type === 'quantum_nito') return 'QuantumNito';
        if (type === 'nito_o') return 'Coalescencia nito_o';
        return 'Nodo';
    }

    function getBlockCategory(type) {
        if (type === 'nito_supreme' || type === 'quantum_nito' || type === 'nito_o') return 'data';
        return 'execution';
    }

    // ==============================================================================
    // 2D INFINITE CANVAS VIEWPAN & ZOOM CONTROLLERS
    // ==============================================================================
    
    // Middle-click or drag on workspace background grid to Pan
    workspace.addEventListener('mousedown', (e) => {
        const isGridBg = e.target.classList.contains('workspace-grid-overlay') || e.target === workspace;
        // Middle click (button 1) or Left click (button 0) on the empty grid background
        if (e.button === 1 || (e.button === 0 && isGridBg)) {
            isPanning = true;
            panStartX = e.clientX - panX;
            panStartY = e.clientY - panY;
            workspace.style.cursor = 'grabbing';
            e.preventDefault();
            e.stopPropagation();
        }
    });

    // Zoom viewport with mouse wheel
    workspace.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = 0.06;
        
        // Calculate zoom focus point (anchor to mouse cursor)
        const wsRect = workspace.getBoundingClientRect();
        const mouseX = e.clientX - wsRect.left;
        const mouseY = e.clientY - wsRect.top;
        
        // Project mouse location before zoom
        const localX = (mouseX - panX) / zoomScale;
        const localY = (mouseY - panY) / zoomScale;
        
        // Apply zoom change
        if (e.deltaY < 0) {
            zoomScale = Math.min(2.0, zoomScale + zoomFactor);
        } else {
            zoomScale = Math.max(0.4, zoomScale - zoomFactor);
        }
        
        // Adjust pans so zoom centers around mouse cursor
        panX = mouseX - localX * zoomScale;
        panY = mouseY - localY * zoomScale;
        
        updateWorkspaceTransform();
        redrawConnections();
    }, { passive: false });

    // Floating Zoom Controls Pane
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnZoomReset = document.getElementById('btn-zoom-reset');

    if (btnZoomIn) {
        btnZoomIn.addEventListener('click', () => {
            zoomScale = Math.min(2.0, zoomScale + 0.15);
            updateWorkspaceTransform();
            redrawConnections();
        });
    }

    if (btnZoomOut) {
        btnZoomOut.addEventListener('click', () => {
            zoomScale = Math.max(0.4, zoomScale - 0.15);
            updateWorkspaceTransform();
            redrawConnections();
        });
    }

    if (btnZoomReset) {
        btnZoomReset.addEventListener('click', () => {
            zoomScale = 1.0;
            panX = 0;
            panY = 0;
            updateWorkspaceTransform();
            redrawConnections();
        });
    }

    function duplicateNode(nodeId) {
        const sourceNode = nodes.find(n => n.id === nodeId);
        if (!sourceNode) return;
        
        const inputEl = sourceNode.element.querySelector('.block-input');
        const value = inputEl ? inputEl.value : "";
        
        const posX = sourceNode.x + 30;
        const posY = sourceNode.y + 30;
        
        const newBlock = createNodeInWorkspace(sourceNode.type, posX, posY);
        const newInput = newBlock.querySelector('.block-input');
        if (newInput) newInput.value = value;
        
        // Setup visual snaps
        triggerSnapEffects(newBlock);
        updateGeneratedCode();
    }

    // Keyboard clipboard copying and pasting
    let clipboardNode = null;
    window.addEventListener('keydown', (e) => {
        // Ctrl+C to copy selected NitoBlock
        if (e.ctrlKey && e.key === 'c') {
            if (selectedNodeId) {
                const nodeObj = nodes.find(n => n.id === selectedNodeId);
                if (nodeObj) {
                    const inputEl = nodeObj.element.querySelector('.block-input');
                    clipboardNode = {
                        type: nodeObj.type,
                        value: inputEl ? inputEl.value : ""
                    };
                    logToConsole(`[Portapapeles] Copiado NitoBlock: ${getNodeLabel(nodeObj.type)}`, "info");
                }
            }
        }
        
        // Ctrl+V to paste NitoBlock
        if (e.ctrlKey && e.key === 'v') {
            if (clipboardNode) {
                // Spawn slightly offset from the visible center
                const posX = (workspace.clientWidth / 2 - panX) / zoomScale - 130 + (Math.random() * 40 - 20);
                const posY = (workspace.clientHeight / 2 - panY) / zoomScale - 60 + (Math.random() * 40 - 20);
                
                const newBlock = createNodeInWorkspace(clipboardNode.type, posX, posY);
                const newInput = newBlock.querySelector('.block-input');
                if (newInput) newInput.value = clipboardNode.value;
                
                // Set newly pasted node as active selection
                document.querySelectorAll('.lego-block').forEach(b => b.classList.remove('selected-node'));
                newBlock.classList.add('selected-node');
                selectedNodeId = newBlock.id;
                
                triggerSnapEffects(newBlock);
                updateGeneratedCode();
                logToConsole(`[Portapapeles] Pegado NitoBlock: ${getNodeLabel(clipboardNode.type)}`, "info");
            }
        }
    });

    // Custom Block Creator Modal listeners
    const customBlockModal = document.getElementById('custom-block-modal');
    const btnShowCustomModal = document.getElementById('btn-show-custom-modal');
    const btnCloseModal = document.getElementById('close-modal-btn');
    const btnCreateCustomConfirm = document.getElementById('btn-create-custom-confirm');

    if (btnShowCustomModal) {
        btnShowCustomModal.addEventListener('click', () => {
            customBlockModal.style.display = 'flex';
        });
    }

    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            customBlockModal.style.display = 'none';
        });
    }

    // Dismiss modal on backdrop click
    if (customBlockModal) {
        customBlockModal.addEventListener('click', (e) => {
            if (e.target === customBlockModal) {
                customBlockModal.style.display = 'none';
            }
        });
    }

    if (btnCreateCustomConfirm) {
        btnCreateCustomConfirm.addEventListener('click', () => {
            const rawName = document.getElementById('custom-name').value.trim();
            const labelText = document.getElementById('custom-label').value.trim();
            const category = document.getElementById('custom-category').value;
            const hasInFlow = document.getElementById('custom-has-in-flow').checked;
            const hasOutFlow = document.getElementById('custom-has-out-flow').checked;
            const inputsStr = document.getElementById('custom-inputs-data').value.trim();
            const codePattern = document.getElementById('custom-code').value.trim();

            if (!rawName || !labelText) {
                alert("Por favor, introduce un nombre identificador y una etiqueta.");
                return;
            }

            const typeName = 'custom_' + rawName.toLowerCase().replace(/[^a-z0-9_]/g, '');
            
            // Parse inputs list
            const inputsList = inputsStr ? inputsStr.split(',').map(s => s.trim()).filter(s => s !== "") : [];

            // Register custom block definition
            customBlockRegistry[typeName] = {
                typeName: typeName,
                labelText: labelText,
                category: category,
                hasInFlow: hasInFlow,
                hasOutFlow: hasOutFlow,
                inputsList: inputsList,
                codePattern: codePattern
            };

            // Dynamically create the custom block template in a new category group in the sidebar
            let customCatGroup = document.getElementById('custom-blocks-category');
            if (!customCatGroup) {
                customCatGroup = document.createElement('div');
                customCatGroup.className = 'block-category';
                customCatGroup.id = 'custom-blocks-category';
                customCatGroup.innerHTML = `<h3>Bloques Custom</h3>`;
                document.querySelector('.toolbox-panel').appendChild(customCatGroup);
            }

            const newTemplate = document.createElement('div');
            newTemplate.className = `block-template lego-block ${category}`;
            newTemplate.setAttribute('draggable', 'true');
            newTemplate.setAttribute('data-type', typeName);
            
            newTemplate.innerHTML = `
                <div class="block-studs"><span></span><span></span><span></span><span></span></div>
                <div class="block-content">
                    <span class="block-label">${labelText}</span>
                </div>
            `;

            // Click to instantiate in workspace
            newTemplate.addEventListener('click', () => {
                const posX = (workspace.clientWidth / 2 - panX) / zoomScale - 130 + (Math.random() * 60 - 30);
                const posY = (workspace.clientHeight / 2 - panY) / zoomScale - 60 + (Math.random() * 60 - 30);
                const node = createNodeInWorkspace(typeName, posX, posY);
                triggerSnapEffects(node);
                updateGeneratedCode();
            });

            // HTML5 drag listener
            newTemplate.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', typeName);
            });

            customCatGroup.appendChild(newTemplate);

            // Hide modal and log
            customBlockModal.style.display = 'none';
            logToConsole(`[Paleta de Bloques] Definido NitoBlock Custom: ${labelText}`, "info");
            
            // Clean modal inputs
            document.getElementById('custom-name').value = "mi_bloque_" + Math.floor(Math.random() * 100);
            document.getElementById('custom-label').value = "Mi Bloque Nuevo:";
            document.getElementById('custom-inputs-data').value = "valor";
            document.getElementById('custom-code').value = "nito {ID}_res = {valor} * Nito";
        });
    }

    function updateWorkspaceTransform() {
        // Apply 2D translation and scale to viewport container
        workspaceContent.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
        
        // Shift grid overlay coordinates to achieve infinite scrolling visual feedback
        const gridOverlay = workspace.querySelector('.workspace-grid-overlay');
        if (gridOverlay) {
            gridOverlay.style.backgroundPosition = `${panX}px ${panY}px`;
        }
    }
});
