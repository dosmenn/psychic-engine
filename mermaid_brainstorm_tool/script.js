document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const nodeInput = document.getElementById('node-input');
    const addNodesBtn = document.getElementById('add-nodes-btn');
    const clearInputBtn = document.getElementById('clear-input-btn');
    const linkLabelInput = document.getElementById('link-label-input');
    const searchTargetInput = document.getElementById('search-target-input');
    const targetList = document.getElementById('target-list');
    const clearSelectionBtn = document.getElementById('clear-selection-btn');
    const selectionCount = document.getElementById('selection-count');
    const nodeListToggle = document.getElementById('node-list-toggle');
    const nodeUl = document.getElementById('nodes');
    const mermaidDiagram = document.getElementById('mermaid-diagram');
    const statusMessage = document.getElementById('status-message');
    const undoBtn = document.getElementById('undo-btn');
    const exportBtn = document.getElementById('export-btn');
    const copyCodeBtn = document.getElementById('copy-code-btn');
    const newWindowBtn = document.getElementById('new-window-btn');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');
    const importMdBtn = document.getElementById('import-md-btn');
    const mdFileInput = document.getElementById('md-file-input');
    const resetBtn = document.getElementById('reset-btn');
    const reverseArrowToggle = document.getElementById('reverse-arrow-toggle');
    
    // Link Operation Elements
    const existingLinksSelect = document.getElementById('existing-links-select');
    const linkFromSelect = document.getElementById('link-from-select');
    const linkToSelect = document.getElementById('link-to-select');
    const linkLabelInputOp = document.getElementById('link-label-input-op');
    const addUpdateLinkBtn = document.getElementById('add-update-link-btn');
    const deleteSelectedLinksBtn = document.getElementById('delete-selected-links-btn');
    const reverseSelectedLinksBtn = document.getElementById('reverse-selected-links-btn');
    const linkSelectionModeToggle = document.getElementById('link-selection-mode-toggle');
    const selectedLinksContainer = document.getElementById('selected-links-container');

    // --- Data State ---
    let state = {
        nodes: [],
        links: [],
        nodeCounter: 1,
        linkCounter: 1,
    };
    let selectedTargets = [];
    let selectedLinks = [];
    let history = [];
    let currentZoom = 1;
    
    // ノードクリック機能用の状態
    let nodeClickState = {
        fromNode: null,
        toNode: null,
        isActive: false
    };

    // --- Mermaid Initialization ---
    mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
        },
        securityLevel: 'loose',
    });

    // --- Functions ---

    function loadFromStorage() {
        const savedData = localStorage.getItem('mermaidBrainstormData');
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                if (parsedData.nodes && parsedData.links && parsedData.nodeCounter) {
                    state = { ...{ linkCounter: 1 }, ...parsedData };
                } else {
                    saveToStorage();
                }
            } catch (e) {
                saveToStorage();
            }
        }
        updateDisplay();
    }

    function saveToStorage() {
        try {
            localStorage.setItem('mermaidBrainstormData', JSON.stringify(state));
        } catch (e) {
            showStatusMessage('データの保存に失敗しました。', 'error');
        }
    }

    function updateDisplay() {
        updateTargetDisplay();
        updateNodeList();
        updateMermaidDiagram();
        updateSelectionCount();
        updateLinkOperationPanel();
        updateSelectedLinksDisplay();
    }

    function updateTargetDisplay(searchTerm = '') {
        targetList.innerHTML = '';
        const filteredNodes = state.nodes.filter(node => 
            node.text.toLowerCase().includes(searchTerm.toLowerCase()) || 
            node.id.toLowerCase().includes(searchTerm.toLowerCase())
        );

        filteredNodes.forEach(node => {
            const tag = document.createElement('div');
            tag.className = 'tag';
            tag.dataset.nodeId = node.id;
            tag.textContent = `${node.id}: ${node.text}`;
            if (selectedTargets.includes(node.id)) {
                tag.classList.add('selected');
            }
            tag.addEventListener('click', () => toggleTargetSelection(node.id));
            targetList.appendChild(tag);
        });
    }

    function updateNodeList() {
        nodeUl.innerHTML = '';
        if (state.nodes.length === 0) {
            nodeUl.innerHTML = '<li>ノードがありません。</li>';
            return;
        }
        state.nodes.forEach(node => {
            const li = document.createElement('li');
            const span = document.createElement('span');
            span.textContent = `${node.id}: ${node.text}`;
            span.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'text';
                input.value = node.text;
                li.replaceChild(input, span);
                input.focus();
                
                const saveEdit = () => {
                    editNodeText(node.id, input.value);
                };

                input.addEventListener('blur', saveEdit);
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        input.blur();
                    }
                });
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '削除';
            deleteBtn.className = 'delete-node-btn';
            deleteBtn.dataset.nodeId = node.id;
            deleteBtn.addEventListener('click', () => deleteNode(node.id));

            li.appendChild(span);
            li.appendChild(deleteBtn);
            nodeUl.appendChild(li);
        });
    }

    async function updateMermaidDiagram() {
        if (state.nodes.length === 0) {
            mermaidDiagram.innerHTML = '<p>ノードを追加して図の作成を始めましょう。</p>';
            return;
        }

        let mermaidString = 'flowchart TD\n';
        state.nodes.forEach(node => {
            mermaidString += `    ${node.id}["${escapeMermaidString(node.text)}"]\n`;
        });
        
        state.links.forEach(link => {
            if (link.label) {
                mermaidString += `    ${link.from} -->|${link.id}: ${escapeMermaidString(link.label)}| ${link.to}\n`;
            } else {
                mermaidString += `    ${link.from} -->|${link.id}| ${link.to}\n`;
            }
        });

        try {
            const { svg } = await mermaid.render('mermaid-graph', mermaidString);
            mermaidDiagram.innerHTML = svg;
            applyZoom();
            // 少し遅延させてDOMが確実に更新されてからイベントハンドラーを設定
            setTimeout(() => {
                setupLinkClickHandlers();
                setupNodeClickHandlers();
            }, 100);
        } catch (e) {
            showStatusMessage(`図の描画に失敗しました: ${e.message}`, 'error');
            mermaidDiagram.innerHTML = `<pre class="error">${escapeHTML(mermaidString)}</pre>`;
        }
    }

    function updateSelectionCount() {
        selectionCount.textContent = `選択中: ${selectedTargets.length}件`;
    }

    function addNodes() {
        saveHistory();
        const lines = nodeInput.value.split('\n').map(line => line.trim()).filter(line => line);
        if (lines.length === 0) return;

        const newNodes = [];
        const linkLabel = linkLabelInput.value.trim();

        lines.forEach(text => {
            let existingNode = findNodeByText(text);
            if (!existingNode) {
                const newNodeId = `N${state.nodeCounter++}`;
                const newNode = { id: newNodeId, text: text };
                state.nodes.push(newNode);
                newNodes.push(newNode);
            } else {
                if (!newNodes.find(n => n.id === existingNode.id)) {
                   newNodes.push(existingNode);
                }
            }
        });
        
        if (selectedTargets.length > 0) {
            const isReversed = reverseArrowToggle.checked;
            newNodes.forEach(node => {
                selectedTargets.forEach(targetId => {
                    if (node.id !== targetId) {
                        const fromId = isReversed ? targetId : node.id;
                        const toId = isReversed ? node.id : targetId;
                        createLink(fromId, toId, linkLabel);
                    }
                });
            });
        }
        
        mergeNodes();
        resetNodeClickState(); // ノード処理後にリセット
        updateDisplay();
        saveToStorage();
        
        nodeInput.value = '';
        linkLabelInput.value = '';
        showStatusMessage(`${lines.length}件のノードを処理しました。`, 'success');
    }

    function deleteNode(nodeId) {
        saveHistory();
        state.nodes = state.nodes.filter(node => node.id !== nodeId);
        state.links = state.links.filter(link => link.from !== nodeId && link.to !== nodeId);
        
        const index = selectedTargets.indexOf(nodeId);
        if (index > -1) {
            selectedTargets.splice(index, 1);
        }

        resetNodeClickState(); // ノード削除後にリセット
        updateDisplay();
        saveToStorage();
        showStatusMessage(`ノード ${nodeId} を削除しました。`, 'success');
    }

    function deleteLink(linkId) {
        saveHistory();
        const linkIndex = state.links.findIndex(l => l.id === linkId);
        if (linkIndex > -1) {
            state.links.splice(linkIndex, 1);
            // This function is now called from other operations,
            // so updateDisplay and saveToStorage will be called there.
        }
    }

    function editNodeText(nodeId, newText) {
        const trimmedText = newText.trim();
        if (!trimmedText) {
            showStatusMessage('ノードのテキストは空にできません。', 'error');
            updateDisplay();
            return;
        }
        
        saveHistory();
        const node = state.nodes.find(n => n.id === nodeId);
        if (node) {
            node.text = trimmedText;
        }
        
        mergeNodes();
        resetNodeClickState(); // ノード編集後にリセット
        updateDisplay();
        saveToStorage();
        showStatusMessage(`ノード ${nodeId} を更新しました。`, 'success');
    }

    function findNodeByText(text) {
        return state.nodes.find(node => node.text === text);
    }

    function createLink(fromId, toId, label = '') {
        const linkExists = state.links.some(
            link => link.from === fromId && link.to === toId && link.label === label
        );
        if (!linkExists) {
            const newLink = { 
                id: `L${state.linkCounter++}`,
                from: fromId, 
                to: toId, 
                label: label 
            };
            state.links.push(newLink);
        }
    }

    function toggleTargetSelection(nodeId) {
        const index = selectedTargets.indexOf(nodeId);
        if (index > -1) {
            selectedTargets.splice(index, 1);
        } else {
            selectedTargets.push(nodeId);
        }
        updateTargetDisplay(searchTargetInput.value);
        updateSelectionCount();
    }
    
    function escapeMermaidString(str) {
        return str.replace(/"/g, '#quot;');
    }

    function escapeHTML(str) {
        return str.replace(/[&<>"']/g, function(match) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[match];
        });
    }

    function setupLinkClickHandlers() {
        // 既存のイベントリスナーをクリア
        const existingHandlers = mermaidDiagram.querySelectorAll('[data-link-handler]');
        existingHandlers.forEach(el => {
            el.removeAttribute('data-link-handler');
        });

        // 複数のセレクターでリンク要素を取得
        const linkElements = mermaidDiagram.querySelectorAll('.edgeLabel, .edge-label, .edge .label, .edgeLabel tspan, .flowchart-link');
        console.log('Found link elements:', linkElements.length);

        linkElements.forEach((el, index) => {
            console.log(`Link element ${index}:`, el, el.textContent);
            
            // 親のedge要素を探す
            let parentGroup = el.closest('.edge, .edgePath, g[class*="edge"]');
            if (!parentGroup) {
                // より広範囲で親要素を探す
                parentGroup = el.parentElement;
                while (parentGroup && !parentGroup.classList.contains('edge') && parentGroup.tagName !== 'g') {
                    parentGroup = parentGroup.parentElement;
                }
            }
            
            if (!parentGroup) {
                console.log('Parent group not found for element:', el);
                return;
            }

            // 重複防止
            if (parentGroup.hasAttribute('data-link-handler')) {
                return;
            }
            parentGroup.setAttribute('data-link-handler', 'true');

            const labelText = el.textContent || el.innerText || '';
            console.log('Label text:', labelText);
            
            const linkIdMatch = labelText.match(/^(L\d+)/);
            console.log('Link ID match:', linkIdMatch);

            if (linkIdMatch && linkIdMatch[0]) {
                const linkId = linkIdMatch[0];
                console.log('Setting up click handler for link:', linkId);
                
                parentGroup.style.cursor = 'pointer';
                parentGroup.style.pointerEvents = 'all';

                // 選択状態の反映
                if (selectedLinks.includes(linkId)) {
                    parentGroup.style.stroke = '#ff6b6b';
                    parentGroup.style.strokeWidth = '3px';
                    parentGroup.classList.add('selected-link');
                } else {
                    parentGroup.style.stroke = '';
                    parentGroup.style.strokeWidth = '';
                    parentGroup.classList.remove('selected-link');
                }

                // クリックイベントの設定
                const clickHandler = (e) => {
                    console.log('Link clicked:', linkId, 'Selection mode:', linkSelectionModeToggle.checked);
                    if (!linkSelectionModeToggle.checked) {
                        console.log('Selection mode is off, ignoring click');
                        return;
                    }
                    e.stopPropagation();
                    e.preventDefault();
                    toggleLinkSelection(linkId);
                };

                parentGroup.addEventListener('click', clickHandler);
            }
        });

        // 追加のセレクターでpath要素（矢印の線）も対象にする
        const pathElements = mermaidDiagram.querySelectorAll('path.edge-line, path[class*="edge"], .edge path, .edgePath path');
        console.log('Found path elements:', pathElements.length);
        
        pathElements.forEach((path, index) => {
            const parentGroup = path.closest('.edge, .edgePath, g[class*="edge"]');
            if (!parentGroup || parentGroup.hasAttribute('data-link-handler')) {
                return;
            }

            // 関連するラベル要素を探す
            const labelElement = parentGroup.querySelector('.edgeLabel, .edge-label, .label');
            if (!labelElement) return;

            const labelText = labelElement.textContent || labelElement.innerText || '';
            const linkIdMatch = labelText.match(/^(L\d+)/);

            if (linkIdMatch && linkIdMatch[0]) {
                const linkId = linkIdMatch[0];
                console.log('Setting up click handler for path:', linkId);
                
                parentGroup.setAttribute('data-link-handler', 'true');
                parentGroup.style.cursor = 'pointer';
                parentGroup.style.pointerEvents = 'all';

                // 選択状態の反映
                if (selectedLinks.includes(linkId)) {
                    parentGroup.style.stroke = '#ff6b6b';
                    parentGroup.style.strokeWidth = '3px';
                    parentGroup.classList.add('selected-link');
                } else {
                    parentGroup.style.stroke = '';
                    parentGroup.style.strokeWidth = '';
                    parentGroup.classList.remove('selected-link');
                }

                const clickHandler = (e) => {
                    console.log('Path clicked:', linkId, 'Selection mode:', linkSelectionModeToggle.checked);
                    if (!linkSelectionModeToggle.checked) return;
                    e.stopPropagation();
                    e.preventDefault();
                    toggleLinkSelection(linkId);
                };

                parentGroup.addEventListener('click', clickHandler);
            }
        });

        // デバッグ用：全体的なクリックハンドラー
        mermaidDiagram.addEventListener('click', (e) => {
            if (linkSelectionModeToggle.checked) {
                console.log('Diagram clicked:', e.target, e.target.textContent);
            }
        });
    }

    function setupNodeClickHandlers() {
        // リンク選択モードがオンの場合はノードクリック機能を無効化
        if (linkSelectionModeToggle.checked) {
            console.log('Link selection mode is ON, skipping node click setup');
            return;
        }

        console.log('Setting up node click handlers...');

        // 既存のノードクリックハンドラーをクリア
        const existingHandlers = mermaidDiagram.querySelectorAll('[data-node-handler]');
        existingHandlers.forEach(el => {
            const oldHandler = el._nodeClickHandler;
            if (oldHandler) {
                el.removeEventListener('click', oldHandler);
            }
            el.removeAttribute('data-node-handler');
            delete el._nodeClickHandler;
        });

        // 複数のセレクターでノード要素を取得
        const nodeSelectors = [
            '.node',
            '.flowchart-node', 
            '.nodeLabel',
            'g[class*="node"]',
            'rect[class*="node"]',
            '.label-container',
            'foreignObject'
        ];

        let nodeElements = [];
        nodeSelectors.forEach(selector => {
            const elements = mermaidDiagram.querySelectorAll(selector);
            nodeElements = nodeElements.concat(Array.from(elements));
        });

        console.log('Found node elements:', nodeElements.length);

        nodeElements.forEach((el, index) => {
            // 重複防止
            if (el.hasAttribute('data-node-handler')) return;
            
            // ノードIDを取得（複数の方法を試行）
            let nodeId = null;
            
            // 1. data-id属性から取得
            if (el.getAttribute && el.getAttribute('data-id')) {
                nodeId = el.getAttribute('data-id');
            }
            // 2. id属性から取得
            else if (el.id && el.id.includes('flowchart-')) {
                // flowchart-N1-123 -> N1 のような形式
                const match = el.id.match(/flowchart-([A-Z]\d+)/);
                if (match) {
                    nodeId = match[1];
                }
            }
            // 3. 親要素のid属性から取得
            else if (el.parentElement && el.parentElement.id && el.parentElement.id.includes('flowchart-')) {
                const match = el.parentElement.id.match(/flowchart-([A-Z]\d+)/);
                if (match) {
                    nodeId = match[1];
                }
            }
            // 4. 祖父母要素まで遡って検索
            else {
                let parent = el.parentElement;
                let depth = 0;
                while (parent && depth < 3) {
                    if (parent.id && parent.id.includes('flowchart-')) {
                        const match = parent.id.match(/flowchart-([A-Z]\d+)/);
                        if (match) {
                            nodeId = match[1];
                            break;
                        }
                    }
                    parent = parent.parentElement;
                    depth++;
                }
            }
            // 5. テキスト内容からノードIDを推測
            if (!nodeId) {
                const textContent = el.textContent || el.innerText || '';
                // ノードのテキストまたはIDがマッチするものを探す
                const nodeMatch = state.nodes.find(n => 
                    textContent.includes(n.id) || 
                    textContent.includes(n.text) ||
                    (textContent.trim() === n.text.trim())
                );
                if (nodeMatch) {
                    nodeId = nodeMatch.id;
                }
            }

            // 有効なノードIDが見つかった場合のみイベントハンドラーを設定
            if (nodeId && state.nodes.find(n => n.id === nodeId)) {
                console.log(`Setting up click handler for node: ${nodeId} (element type: ${el.tagName}, class: ${el.className})`);
                
                el.setAttribute('data-node-handler', 'true');
                el.style.cursor = 'pointer';
                el.style.pointerEvents = 'all';

                // ノードの状態に応じてスタイルを適用
                updateNodeVisualState(el, nodeId);

                const clickHandler = (e) => {
                    // リンク選択モードがオンの場合は処理しない
                    if (linkSelectionModeToggle.checked) {
                        console.log('Link selection mode is ON, ignoring node click');
                        return;
                    }
                    
                    console.log('Node element clicked:', nodeId, el);
                    e.stopPropagation();
                    e.preventDefault();
                    handleNodeClick(nodeId);
                };

                // イベントハンドラーを要素に保存（後で削除するため）
                el._nodeClickHandler = clickHandler;
                el.addEventListener('click', clickHandler);
            } else {
                console.log(`No valid nodeId found for element:`, el, 'textContent:', el.textContent);
            }
        });

        // 追加のアプローチ：SVG内の全てのg要素をチェック
        const allGroups = mermaidDiagram.querySelectorAll('g');
        allGroups.forEach(group => {
            if (group.hasAttribute('data-node-handler')) return;
            
            // グループ内にテキスト要素があるかチェック
            const textElements = group.querySelectorAll('text, tspan, foreignObject');
            if (textElements.length === 0) return;
            
            let groupNodeId = null;
            textElements.forEach(textEl => {
                const textContent = textEl.textContent || textEl.innerText || '';
                const nodeMatch = state.nodes.find(n => 
                    textContent.includes(n.text) || textContent.trim() === n.text.trim()
                );
                if (nodeMatch && !groupNodeId) {
                    groupNodeId = nodeMatch.id;
                }
            });
            
            if (groupNodeId) {
                console.log(`Setting up click handler for group node: ${groupNodeId}`);
                group.setAttribute('data-node-handler', 'true');
                group.style.cursor = 'pointer';
                group.style.pointerEvents = 'all';
                
                updateNodeVisualState(group, groupNodeId);
                
                const clickHandler = (e) => {
                    // リンク選択モードがオンの場合は処理しない
                    if (linkSelectionModeToggle.checked) {
                        console.log('Link selection mode is ON, ignoring group node click');
                        return;
                    }
                    
                    console.log('Group node clicked:', groupNodeId, group);
                    e.stopPropagation();
                    e.preventDefault();
                    handleNodeClick(groupNodeId);
                };
                
                // イベントハンドラーを要素に保存（後で削除するため）
                group._nodeClickHandler = clickHandler;
                group.addEventListener('click', clickHandler);
            }
        });

        console.log('Node click handlers setup completed');
    }

    function updateNodeVisualState(element, nodeId) {
        // 親要素も含めてスタイルを適用（より確実にスタイルが反映されるように）
        const elementsToStyle = [element];
        
        // 子要素も含める（rect, path, text など）
        const childElements = element.querySelectorAll('rect, path, text, tspan, foreignObject');
        elementsToStyle.push(...childElements);
        
        // 親要素も含める（グループ要素など）
        if (element.parentElement && element.parentElement.tagName === 'g') {
            elementsToStyle.push(element.parentElement);
        }

        elementsToStyle.forEach(el => {
            // 既存のスタイルをリセット
            if (el.style) {
                el.style.stroke = '';
                el.style.strokeWidth = '';
                el.style.fill = '';
            }

            if (nodeClickState.fromNode === nodeId) {
                // 始点ノードは青色
                if (el.style) {
                    el.style.stroke = '#2196f3';
                    el.style.strokeWidth = '3px';
                    if (el.tagName === 'rect' || el.tagName === 'circle' || el.tagName === 'ellipse') {
                        el.style.fill = '#e3f2fd';
                    }
                }
                el.classList?.add('from-node-selected');
            } else if (nodeClickState.toNode === nodeId) {
                // 終点ノードは緑色
                if (el.style) {
                    el.style.stroke = '#4caf50';
                    el.style.strokeWidth = '3px';
                    if (el.tagName === 'rect' || el.tagName === 'circle' || el.tagName === 'ellipse') {
                        el.style.fill = '#e8f5e8';
                    }
                }
                el.classList?.add('to-node-selected');
            } else {
                // 通常状態
                el.classList?.remove('from-node-selected', 'to-node-selected');
            }
        });
    }

    function handleNodeClick(nodeId) {
        console.log('Node clicked:', nodeId);
        console.log('Current state:', nodeClickState);

        if (!nodeClickState.fromNode) {
            // 最初のクリック：始点ノードを設定
            nodeClickState.fromNode = nodeId;
            nodeClickState.isActive = true;
            showStatusMessage(`始点ノード ${nodeId} を選択しました。次に終点ノードをクリックしてください。`, 'info');
        } else if (nodeClickState.fromNode === nodeId) {
            // 同じノードをクリック：リセット
            resetNodeClickState();
            showStatusMessage('ノード選択をリセットしました。', 'info');
        } else if (!nodeClickState.toNode) {
            // 2番目のクリック：終点ノードを設定してリンクを作成
            nodeClickState.toNode = nodeId;
            createLinkFromNodeClick();
        } else {
            // 3番目以降のクリック：新しい始点ノードとして設定
            resetNodeClickState();
            nodeClickState.fromNode = nodeId;
            nodeClickState.isActive = true;
            showStatusMessage(`新しい始点ノード ${nodeId} を選択しました。次に終点ノードをクリックしてください。`, 'info');
        }

        // ノードの視覚状態を更新
        updateAllNodesVisualState();
    }

    function updateAllNodesVisualState() {
        // リンク選択モードがオンの場合はノードの視覚状態を更新しない
        if (linkSelectionModeToggle.checked) return;
        
        // 全てのノードの視覚状態を更新
        const allNodeElements = mermaidDiagram.querySelectorAll('[data-node-handler="true"]');
        allNodeElements.forEach(el => {
            // ノードIDを再取得
            let nodeId = null;
            if (el.getAttribute('data-id')) {
                nodeId = el.getAttribute('data-id');
            } else if (el.id && el.id.includes('flowchart-')) {
                const match = el.id.match(/flowchart-([A-Z]\d+)/);
                if (match) nodeId = match[1];
            } else {
                const textContent = el.textContent || el.innerText || '';
                const nodeMatch = state.nodes.find(n => 
                    textContent.includes(n.text) || textContent.trim() === n.text.trim()
                );
                if (nodeMatch) nodeId = nodeMatch.id;
            }
            
            if (nodeId) {
                updateNodeVisualState(el, nodeId);
            }
        });
        
        // data-node-handlerがないがノードである可能性のある要素も処理
        const allPossibleNodes = mermaidDiagram.querySelectorAll('g, rect, foreignObject');
        allPossibleNodes.forEach(el => {
            if (el.hasAttribute('data-node-handler')) return; // 既に処理済み
            
            const textContent = el.textContent || el.innerText || '';
            const nodeMatch = state.nodes.find(n => 
                textContent.includes(n.text) || textContent.trim() === n.text.trim()
            );
            if (nodeMatch) {
                updateNodeVisualState(el, nodeMatch.id);
            }
        });
    }

    function createLinkFromNodeClick() {
        if (!nodeClickState.fromNode || !nodeClickState.toNode) return;

        saveHistory();

        const newLink = {
            id: `L${state.linkCounter++}`,
            from: nodeClickState.fromNode,
            to: nodeClickState.toNode,
            label: ''
        };

        // 重複チェック
        const linkExists = state.links.some(
            link => link.from === newLink.from && link.to === newLink.to && link.label === newLink.label
        );

        if (!linkExists) {
            state.links.push(newLink);
            showStatusMessage(`リンク ${newLink.id}: ${nodeClickState.fromNode} → ${nodeClickState.toNode} を作成しました。次の始点ノードをクリックしてください。`, 'success');
        } else {
            showStatusMessage(`同じリンクが既に存在します。`, 'error');
        }

        // リンク操作パネルに反映
        linkFromSelect.value = nodeClickState.fromNode;
        linkToSelect.value = nodeClickState.toNode;

        // リンク作成後、選択状態を完全にリセット
        resetNodeClickState();
        
        updateDisplay();
        saveToStorage();
        
        // ノードクリック機能を再設定（次の操作ができるように）
        setTimeout(() => {
            if (!linkSelectionModeToggle.checked) {
                setupNodeClickHandlers();
                updateAllNodesVisualState();
            }
        }, 100);
    }

    function resetNodeClickState() {
        nodeClickState = {
            fromNode: null,
            toNode: null,
            isActive: false
        };
        console.log('Node click state reset');
        
        // ノードの視覚状態もリセット
        if (!linkSelectionModeToggle.checked) {
            // リンク選択モードがオフの場合のみ、ノードの視覚状態をリセット
            setTimeout(() => {
                updateAllNodesVisualState();
            }, 50);
        }
    }

    function toggleLinkSelection(linkId) {
        console.log('Toggling link selection:', linkId);
        const index = selectedLinks.indexOf(linkId);
        if (index > -1) {
            selectedLinks.splice(index, 1);
            console.log('Removed from selection');
        } else {
            selectedLinks.push(linkId);
            console.log('Added to selection');
        }
        updateSelectedLinksDisplay();
        // 選択状態をすぐに反映するために特定のリンクのスタイルのみ更新
        updateLinkSelectionVisual(linkId);
    }

    function updateLinkSelectionVisual(linkId) {
        const linkElements = mermaidDiagram.querySelectorAll('.edgeLabel, .edge-label, .edge .label, .edgeLabel tspan, .flowchart-link');
        
        linkElements.forEach(el => {
            const labelText = el.textContent || el.innerText || '';
            const linkIdMatch = labelText.match(/^(L\d+)/);
            
            if (linkIdMatch && linkIdMatch[0] === linkId) {
                let parentGroup = el.closest('.edge, .edgePath, g[class*="edge"]');
                if (!parentGroup) {
                    parentGroup = el.parentElement;
                    while (parentGroup && !parentGroup.classList.contains('edge') && parentGroup.tagName !== 'g') {
                        parentGroup = parentGroup.parentElement;
                    }
                }
                
                if (parentGroup) {
                    if (selectedLinks.includes(linkId)) {
                        parentGroup.style.stroke = '#ff6b6b';
                        parentGroup.style.strokeWidth = '3px';
                        parentGroup.classList.add('selected-link');
                        
                        // パス要素にもスタイルを適用
                        const pathElements = parentGroup.querySelectorAll('path');
                        pathElements.forEach(path => {
                            path.style.stroke = '#ff6b6b';
                            path.style.strokeWidth = '3px';
                        });
                    } else {
                        parentGroup.style.stroke = '';
                        parentGroup.style.strokeWidth = '';
                        parentGroup.classList.remove('selected-link');
                        
                        // パス要素のスタイルもリセット
                        const pathElements = parentGroup.querySelectorAll('path');
                        pathElements.forEach(path => {
                            path.style.stroke = '';
                            path.style.strokeWidth = '';
                        });
                    }
                }
            }
        });
    }

    function updateSelectedLinksDisplay() {
        selectedLinksContainer.innerHTML = '';
        if (selectedLinks.length === 0) {
            if (linkSelectionModeToggle.checked) {
                selectedLinksContainer.style.display = 'flex';
                const placeholder = document.createElement('div');
                placeholder.className = 'tag placeholder';
                placeholder.textContent = 'リンクが選択されていません';
                placeholder.style.opacity = '0.6';
                selectedLinksContainer.appendChild(placeholder);
            } else {
                selectedLinksContainer.style.display = 'none';
            }
            return;
        }
        
        selectedLinksContainer.style.display = 'flex';
        
        // 選択数の表示
        const countTag = document.createElement('div');
        countTag.className = 'tag count-tag';
        countTag.textContent = `選択中: ${selectedLinks.length}件`;
        countTag.style.backgroundColor = '#e3f2fd';
        countTag.style.color = '#1565c0';
        countTag.style.fontWeight = 'bold';
        selectedLinksContainer.appendChild(countTag);
        
        // 全選択解除ボタン
        const clearAllTag = document.createElement('div');
        clearAllTag.className = 'tag clear-all-tag';
        clearAllTag.textContent = '全て解除';
        clearAllTag.style.backgroundColor = '#ffebee';
        clearAllTag.style.color = '#c62828';
        clearAllTag.style.cursor = 'pointer';
        clearAllTag.onclick = () => {
            selectedLinks = [];
            updateSelectedLinksDisplay();
            // 全てのリンクの選択状態をクリア
            const allLinkElements = mermaidDiagram.querySelectorAll('.edge, .edgePath');
            allLinkElements.forEach(el => {
                el.style.stroke = '';
                el.style.strokeWidth = '';
                el.classList.remove('selected-link');
                const pathElements = el.querySelectorAll('path');
                pathElements.forEach(path => {
                    path.style.stroke = '';
                    path.style.strokeWidth = '';
                });
            });
        };
        selectedLinksContainer.appendChild(clearAllTag);
        
        selectedLinks.forEach(linkId => {
            const link = state.links.find(l => l.id === linkId);
            if (!link) return;

            const fromNode = state.nodes.find(n => n.id === link.from);
            const toNode = state.nodes.find(n => n.id === link.to);
            if (!fromNode || !toNode) return;

            const tag = document.createElement('div');
            tag.className = 'tag selected';
            tag.textContent = `${link.id}: ${fromNode.text.substring(0, 8)}.. → ${toNode.text.substring(0, 8)}..`;
            
            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove-tag';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                toggleLinkSelection(linkId);
            };
            tag.appendChild(removeBtn);
            selectedLinksContainer.appendChild(tag);
        });
    }

    function updateLinkOperationPanel() {
        const allNodes = state.nodes;
        const allLinks = state.links;

        // Populate From/To dropdowns
        linkFromSelect.innerHTML = '';
        linkToSelect.innerHTML = '';
        allNodes.forEach(node => {
            const option = document.createElement('option');
            option.value = node.id;
            option.textContent = `${node.id}: ${node.text}`;
            linkFromSelect.appendChild(option.cloneNode(true));
            linkToSelect.appendChild(option.cloneNode(true));
        });

        // Populate existing links dropdown
        existingLinksSelect.innerHTML = '<option value="">-- 新規作成またはリンクを選択 --</option>';
        allLinks.forEach(link => {
            const fromNode = allNodes.find(n => n.id === link.from);
            const toNode = allNodes.find(n => n.id === link.to);
            if (fromNode && toNode) {
                const option = document.createElement('option');
                option.value = link.id;
                option.textContent = `${link.id}: ${fromNode.id} -> ${toNode.id} (${link.label || 'ラベルなし'})`;
                existingLinksSelect.appendChild(option);
            }
        });
    }

    function addUpdateLink() {
        const selectedId = existingLinksSelect.value;
        const fromId = linkFromSelect.value;
        const toId = linkToSelect.value;
        const label = linkLabelInputOp.value.trim();

        if (!fromId || !toId) {
            showStatusMessage('始点と終点の両方を選択してください。', 'error');
            return;
        }
        if (fromId === toId) {
            showStatusMessage('始点と終点に同じノードは選択できません。', 'error');
            return;
        }

        saveHistory();

        if (selectedId) {
            // Update existing link
            const linkToUpdate = state.links.find(l => l.id === selectedId);
            if (linkToUpdate) {
                linkToUpdate.from = fromId;
                linkToUpdate.to = toId;
                linkToUpdate.label = label;
                showStatusMessage(`リンク ${selectedId} を更新しました。`, 'success');
            }
        } else {
            // Add new link
            const newLink = {
                id: `L${state.linkCounter++}`,
                from: fromId,
                to: toId,
                label: label
            };
            state.links.push(newLink);
            showStatusMessage(`新しいリンク ${newLink.id} を追加しました。`, 'success');
        }

        resetNodeClickState(); // リンク操作後にリセット
        updateDisplay();
        saveToStorage();
        
        // リンク選択モードがオフの場合、ノードクリック機能を再設定
        if (!linkSelectionModeToggle.checked) {
            setTimeout(() => {
                setupNodeClickHandlers();
                updateAllNodesVisualState();
            }, 150);
        }
    }

    function deleteSelectedLinks() {
        if (selectedLinks.length === 0) {
            showStatusMessage('削除するリンクが選択されていません。', 'error');
            return;
        }

        // 確認ダイアログを削除し、直接削除を実行
        saveHistory();
        state.links = state.links.filter(link => !selectedLinks.includes(link.id));
        const deletedCount = selectedLinks.length;
        selectedLinks = [];
        
        showStatusMessage(`${deletedCount}個のリンクを削除しました。`, 'success');
        resetNodeClickState(); // リンク削除後にリセット
        updateDisplay();
        saveToStorage();
        
        // リンク選択モードがオフの場合、ノードクリック機能を再設定
        if (!linkSelectionModeToggle.checked) {
            setTimeout(() => {
                setupNodeClickHandlers();
                updateAllNodesVisualState();
            }, 150);
        }
    }

    function reverseSelectedLinks() {
        if (selectedLinks.length === 0) {
            showStatusMessage('反転するリンクが選択されていません。', 'error');
            return;
        }

        saveHistory();

        let reversedCount = 0;
        selectedLinks.forEach(linkId => {
            const link = state.links.find(l => l.id === linkId);
            if (link) {
                // fromとtoを入れ替える
                const temp = link.from;
                link.from = link.to;
                link.to = temp;
                reversedCount++;
            }
        });

        // 重複リンクを削除
        const uniqueLinks = [];
        const linkSet = new Set();
        state.links.forEach(link => {
            const linkKey = `${link.from}-${link.to}-${link.label || ''}`;
            if (!linkSet.has(linkKey)) {
                linkSet.add(linkKey);
                uniqueLinks.push(link);
            }
        });
        state.links = uniqueLinks;

        selectedLinks = [];

        showStatusMessage(`${reversedCount}個のリンクを反転しました。`, 'success');
        resetNodeClickState(); // リンク反転後にリセット
        updateDisplay();
        saveToStorage();
        
        // リンク選択モードがオフの場合、ノードクリック機能を再設定
        if (!linkSelectionModeToggle.checked) {
            setTimeout(() => {
                setupNodeClickHandlers();
                updateAllNodesVisualState();
            }, 150);
        }
    }
    
    function mergeNodes() {
        const textMap = new Map();
        const nodesToRemove = new Set();
        const linksToUpdate = [];

        const sortedNodes = [...state.nodes].sort((a, b) => parseInt(a.id.substring(1)) - parseInt(b.id.substring(1)));

        for (const node of sortedNodes) {
            if (textMap.has(node.text)) {
                const mainNodeId = textMap.get(node.text);
                nodesToRemove.add(node.id);
                linksToUpdate.push({ from: node.id, to: mainNodeId });
            } else {
                textMap.set(node.text, node.id);
            }
        }

        if (nodesToRemove.size === 0) return;

        state.links.forEach(link => {
            for (const update of linksToUpdate) {
                if (link.from === update.from) link.from = update.to;
                if (link.to === update.from) link.to = update.to;
            }
        });

        state.nodes = state.nodes.filter(node => !nodesToRemove.has(node.id));

        const uniqueLinks = [];
        const linkSet = new Set();
        state.links.forEach(link => {
            const linkKey = `${link.from}-${link.to}-${link.label || ''}`;
            if (!linkSet.has(linkKey) && link.from !== link.to) {
                linkSet.add(linkKey);
                uniqueLinks.push(link);
            }
        });
        state.links = uniqueLinks;
    }

    function generateMermaidCode(includeMarkdownWrapper = false) {
        let mermaidString = 'flowchart TD\n';
        state.nodes.forEach(node => {
            mermaidString += `    ${node.id}["${escapeMermaidString(node.text)}"]\n`;
        });
        state.links.forEach(link => {
            if (link.label) {
                mermaidString += `    ${link.from} -->|${link.id}: ${escapeMermaidString(link.label)}| ${link.to}\n`;
            } else {
                mermaidString += `    ${link.from} -->|${link.id}| ${link.to}\n`;
            }
        });

        if (includeMarkdownWrapper) {
            return `\`\`\`mermaid\n${mermaidString}\`\`\``;
        }
        return mermaidString;
    }

    function copyMermaidCode() {
        const codeToCopy = generateMermaidCode(false);
        navigator.clipboard.writeText(codeToCopy).then(() => {
            showStatusMessage('Mermaidコードをクリップボードにコピーしました。', 'success');
        }, (err) => {
            showStatusMessage(`コピーに失敗しました: ${err}`, 'error');
        });
    }

    function exportMermaid() {
        const mermaidString = generateMermaidCode(true);
        const blob = new Blob([mermaidString], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'brainstorm_diagram.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function showStatusMessage(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        statusMessage.style.display = 'block';
        setTimeout(() => {
            statusMessage.className = 'status-message';
            statusMessage.style.display = 'none';
        }, 3000);
    }
    
    function saveHistory() {
        history.push(JSON.parse(JSON.stringify(state)));
        if (history.length > 10) {
            history.shift();
        }
        undoBtn.disabled = false;
    }

    function undo() {
        if (history.length > 0) {
            state = history.pop();
            updateDisplay();
            saveToStorage();
        }
        if (history.length === 0) {
            undoBtn.disabled = true;
        }
    }

    function resetState() {
        if (confirm('本当にすべてのノードとリンクを削除しますか？この操作は元に戻せません。')) {
            history = [];
            selectedTargets = [];
            selectedLinks = [];
            state = {
                nodes: [],
                links: [],
                nodeCounter: 1,
                linkCounter: 1,
            };
            resetNodeClickState();
            updateDisplay();
            saveToStorage();
            showStatusMessage('すべてのデータをリセットしました。', 'success');
            undoBtn.disabled = true;
        }
    }

    function applyZoom() {
        const svg = mermaidDiagram.querySelector('svg');
        if (svg) {
            svg.style.transform = `scale(${currentZoom})`;
            svg.style.transformOrigin = 'top left';
        }
    }

    function importFromMarkdown(markdownContent) {
        const mermaidRegex = /```mermaid\s*([\s\S]*?)\s*```/;
        const match = markdownContent.match(mermaidRegex);
        if (!match || !match[1]) {
            showStatusMessage('Mermaidコードブロックが見つかりませんでした。', 'error');
            return;
        }

        const content = match[1].trim();
        const lines = content.split('\n');

        const newNodes = [];
        const newLinks = [];
        let maxNodeId = 0;
        let maxLinkId = 0;

        const nodeRegex = /^\s*([a-zA-Z0-9]+)\["([^"]+)"\]/;
        const linkRegex = /^\s*([a-zA-Z0-9]+)\s*--(?:o|x| )?>\s*(?:\|([^|]+)\|)?\s*([a-zA-Z0-9]+)/;
        const linkWithLabelRegex = /^\s*([a-zA-Z0-9]+)\s*--\s*"([^"]+)"\s*-->\s*(?:\|([^|]+)\|)?\s*([a-zA-Z0-9]+)/;

        lines.forEach(line => {
            line = line.trim();
            let result;

            if ((result = line.match(nodeRegex))) {
                const id = result[1];
                const text = result[2].replace(/#quot;/g, '"');
                newNodes.push({ id, text });
                const numId = parseInt(id.replace(/[^0-9]/g, ''), 10);
                if (numId > maxNodeId) maxNodeId = numId;
            } else if ((result = line.match(linkWithLabelRegex))) {
                const from = result[1];
                const label = result[2];
                const id = result[3] || `L${maxLinkId + 1}`;
                const to = result[4];
                newLinks.push({ id, from, to, label });
                const numId = parseInt(id.replace(/[^0-9]/g, ''), 10);
                if (numId > maxLinkId) maxLinkId = numId;
            } else if ((result = line.match(linkRegex))) {
                const from = result[1];
                const id = result[2] || `L${maxLinkId + 1}`;
                const to = result[3];
                newLinks.push({ id, from, to, label: '' });
                const numId = parseInt(id.replace(/[^0-9]/g, ''), 10);
                if (numId > maxLinkId) maxLinkId = numId;
            }
        });

        if (newNodes.length > 0) {
            saveHistory();
            state.nodes = newNodes;
            state.links = newLinks;
            state.nodeCounter = maxNodeId + 1;
            state.linkCounter = maxLinkId + 1;
            resetNodeClickState();
            updateDisplay();
            saveToStorage();
            showStatusMessage('Markdownからデータをインポートしました。', 'success');
        } else {
            showStatusMessage('有効なノードまたはリンクが見つかりませんでした。', 'error');
        }
    }

    function setupEventListeners() {
        addNodesBtn.addEventListener('click', addNodes);
        clearInputBtn.addEventListener('click', () => {
            nodeInput.value = '';
            linkLabelInput.value = '';
        });

        clearSelectionBtn.addEventListener('click', () => {
            selectedTargets = [];
            updateDisplay();
        });

        searchTargetInput.addEventListener('input', () => {
            updateTargetDisplay(searchTargetInput.value);
        });
        
        nodeListToggle.addEventListener('click', () => {
            nodeUl.style.display = nodeUl.style.display === 'none' ? 'block' : 'none';
        });

        // --- Ctrl Key Handler for Link Selection Mode Toggle ---
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Control' && !e.repeat) {
                // Ctrlキーが押された時にリンク選択モードを切り替え
                e.preventDefault();
                linkSelectionModeToggle.checked = !linkSelectionModeToggle.checked;
                
                // トグルイベントを手動で発火
                const event = new Event('change');
                linkSelectionModeToggle.dispatchEvent(event);
            }
        });

        // --- Link Operation Listeners ---
        existingLinksSelect.addEventListener('change', () => {
            const selectedId = existingLinksSelect.value;
            if (selectedId) {
                const link = state.links.find(l => l.id === selectedId);
                if (link) {
                    linkFromSelect.value = link.from;
                    linkToSelect.value = link.to;
                    linkLabelInputOp.value = link.label || '';
                }
            } else {
                // Clear if "-- Select Link --" is chosen
                linkFromSelect.selectedIndex = -1;
                linkToSelect.selectedIndex = -1;
                linkLabelInputOp.value = '';
            }
        });

        addUpdateLinkBtn.addEventListener('click', addUpdateLink);
        deleteSelectedLinksBtn.addEventListener('click', deleteSelectedLinks);
        reverseSelectedLinksBtn.addEventListener('click', reverseSelectedLinks);

        linkSelectionModeToggle.addEventListener('change', () => {
            console.log('Link selection mode toggle:', linkSelectionModeToggle.checked);
            
            if (linkSelectionModeToggle.checked) {
                // リンク選択モードをオンにする
                selectedLinksContainer.style.display = 'flex';
                resetNodeClickState(); // リンク選択モードオン時にノードクリック状態をリセット
                updateSelectedLinksDisplay(); // プレースホルダーを表示
                
                // ノードクリック機能を無効化（視覚的にも）
                const nodeElements = mermaidDiagram.querySelectorAll('[data-node-handler="true"]');
                nodeElements.forEach(el => {
                    el.style.cursor = 'default';
                    // 既存のノードスタイルをクリア
                    el.classList.remove('from-node-selected', 'to-node-selected');
                    const childElements = el.querySelectorAll('rect, path, text, tspan, foreignObject');
                    childElements.forEach(child => {
                        if (child.style) {
                            child.style.stroke = '';
                            child.style.strokeWidth = '';
                            child.style.fill = '';
                        }
                        child.classList?.remove('from-node-selected', 'to-node-selected');
                    });
                });
                
                showStatusMessage('リンク選択モードがオンになりました。図上のリンクをクリックして複数選択できます。(Ctrlキーで切り替え)', 'info');
            } else {
                // リンク選択モードをオフにする
                console.log('Turning off link selection mode');
                
                // Clear selection when exiting mode
                if (selectedLinks.length > 0) {
                    selectedLinks = [];
                    // 全てのリンクの選択状態をクリア
                    const allLinkElements = mermaidDiagram.querySelectorAll('.edge, .edgePath');
                    allLinkElements.forEach(el => {
                        el.style.stroke = '';
                        el.style.strokeWidth = '';
                        el.classList.remove('selected-link');
                        const pathElements = el.querySelectorAll('path');
                        pathElements.forEach(path => {
                            path.style.stroke = '';
                            path.style.strokeWidth = '';
                        });
                    });
                }
                selectedLinksContainer.style.display = 'none';
                
                // ノードクリック機能を有効化
                console.log('Re-enabling node click functionality');
                setTimeout(() => {
                    setupNodeClickHandlers();
                    updateAllNodesVisualState();
                    console.log('Node click handlers re-setup completed');
                }, 150);
                
                showStatusMessage('リンク選択モードがオフになりました。ノードをクリックしてリンクを作成できます。(Ctrlキーで切り替え)', 'info');
            }
        });

        undoBtn.addEventListener('click', undo);
        exportBtn.addEventListener('click', exportMermaid);
        copyCodeBtn.addEventListener('click', copyMermaidCode);

        newWindowBtn.addEventListener('click', () => {
            const newWindow = window.open('', '_blank');
            newWindow.document.write('<html><head><title>Mermaid Diagram</title><style>svg{width:100%;height:100%;}</style></head><body>');
            newWindow.document.write(mermaidDiagram.innerHTML);
            newWindow.document.write('</body></html>');
            newWindow.document.close();
        });

        importMdBtn.addEventListener('click', () => mdFileInput.click());
        mdFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                importFromMarkdown(e.target.result);
            };
            reader.readAsText(file);
            mdFileInput.value = '';
        });

        zoomInBtn.addEventListener('click', () => {
            currentZoom = Math.min(3, currentZoom + 0.2);
            applyZoom();
        });
        zoomOutBtn.addEventListener('click', () => {
            currentZoom = Math.max(0.2, currentZoom - 0.2);
            applyZoom();
        });
        zoomResetBtn.addEventListener('click', () => {
            currentZoom = 1;
            applyZoom();
        });

        resetBtn.addEventListener('click', resetState);
    }

    // --- Initial Load ---
    setupEventListeners();
    loadFromStorage();
    undoBtn.disabled = true; // 初期状態では無効
});
