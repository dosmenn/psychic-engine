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
    
    // Link Operation Elements
    const existingLinksSelect = document.getElementById('existing-links-select');
    const linkFromSelect = document.getElementById('link-from-select');
    const linkToSelect = document.getElementById('link-to-select');
    const linkLabelInputOp = document.getElementById('link-label-input-op');
    const addUpdateLinkBtn = document.getElementById('add-update-link-btn');
    const deleteLinkBtnOp = document.getElementById('delete-link-btn-op');


    // --- Data State ---
    let state = {
        nodes: [],
        links: [],
        nodeCounter: 1,
        linkCounter: 1,
    };
    let selectedTargets = [];
    let history = [];
    let currentZoom = 1;

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
            // Clicks are no longer used for editing
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
            newNodes.forEach(node => {
                selectedTargets.forEach(targetId => {
                    if (node.id !== targetId) {
                        createLink(node.id, targetId, linkLabel);
                    }
                });
            });
        }
        
        mergeNodes();
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
                '&': '&',
                '<': '<',
                '>': '>',
                '"': '"',
                "'": '&#39;'
            }[match];
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

        // Check if a link with the same from/to already exists.
        const existingLink = state.links.find(l => l.from === fromId && l.to === toId);

        if (existingLink) {
            // Update existing link's label
            existingLink.label = label;
            showStatusMessage(`リンク ${existingLink.id} のラベルを更新しました。`, 'success');
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

        updateDisplay();
        saveToStorage();
    }

    function deleteLinkOp() {
        const fromId = linkFromSelect.value;
        const toId = linkToSelect.value;

        if (!fromId || !toId) {
            showStatusMessage('削除するには始点と終点を選択してください。', 'error');
            return;
        }

        const linkIndex = state.links.findIndex(l => l.from === fromId && l.to === toId);

        if (linkIndex > -1) {
            if (confirm(`リンク ${fromId} -> ${toId} を本当に削除しますか？`)) {
                saveHistory();
                state.links.splice(linkIndex, 1);
                showStatusMessage('リンクを削除しました。', 'success');
                updateDisplay();
                saveToStorage();
            }
        } else {
            showStatusMessage('指定されたリンクは見つかりませんでした。', 'error');
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
        setTimeout(() => {
            statusMessage.className = 'status-message';
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
            state = {
                nodes: [],
                links: [],
                nodeCounter: 1,
                linkCounter: 1,
            };
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
        deleteLinkBtnOp.addEventListener('click', deleteLinkOp);


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
});
