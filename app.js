// USDM要求管理ツール - Chrome拡張機能用JavaScript

// 要求データ
let requirements = [];

// ドキュメントタイトル
let documentTitle = 'USDM要求仕様書';

// 初期サンプルデータ
const defaultRequirements = [
    {
        level1_id: "1",
        level2_id: "",
        level3_id: "",
        level4_id: "",
        description: "新しい要求を追加してください",
        rationale: "",
        specification: "",
        category: ""
    }
];

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    loadData().then(() => {
        setupEventListeners();
        renderTree(false);
        collapseAll();
    }).catch(e => {
        console.error('Initialization error:', e);
        requirements = defaultRequirements.slice();
        setupEventListeners();
        renderTree(false);
        collapseAll();
    });
});

// データをChrome Storageから読み込み
async function loadData() {
    try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            const result = await chrome.storage.local.get(['requirements', 'documentTitle']);
            if (result.requirements && result.requirements.length > 0) {
                requirements = result.requirements;
            } else {
                requirements = defaultRequirements.slice();
            }
            if (result.documentTitle) {
                documentTitle = result.documentTitle;
            }
        } else {
            // Chrome Storage が利用できない場合
            console.log('Chrome Storage not available, using localStorage');
            const saved = localStorage.getItem('usdm_requirements');
            if (saved) {
                requirements = JSON.parse(saved);
            } else {
                requirements = defaultRequirements.slice();
            }
            const savedTitle = localStorage.getItem('usdm_title');
            if (savedTitle) {
                documentTitle = savedTitle;
            }
        }
        const titleEl = document.getElementById('doc-title');
        if (titleEl) {
            titleEl.textContent = documentTitle;
        }
    } catch (e) {
        console.error('Load error:', e);
        requirements = defaultRequirements.slice();
    }
}

// データを保存
async function saveData() {
    try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            await chrome.storage.local.set({ 
                requirements: requirements,
                documentTitle: documentTitle
            });
        } else {
            // localStorage にフォールバック
            localStorage.setItem('usdm_requirements', JSON.stringify(requirements));
            localStorage.setItem('usdm_title', documentTitle);
        }
    } catch (e) {
        console.error('Save error:', e);
    }
}

// イベントリスナーの設定
function setupEventListeners() {
    // ツールバーボタン
    document.getElementById('btn-expand-all').addEventListener('click', expandAll);
    document.getElementById('btn-collapse-all').addEventListener('click', collapseAll);
    document.getElementById('btn-add-root').addEventListener('click', addRootRequirement);
    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
    document.getElementById('csv-import').addEventListener('change', importCSV);
    document.getElementById('btn-export-pdf').addEventListener('click', exportPDF);
    document.getElementById('btn-clear-data').addEventListener('click', clearAllData);
    
    // フォーム
    document.getElementById('req-form').addEventListener('submit', handleFormSubmit);
    document.getElementById('btn-cancel').addEventListener('click', closeModal);
    
    // ID入力フィールド
    ['level1_id', 'level2_id', 'level3_id', 'level4_id'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateIdDisplay);
    });
    
    // モーダル外クリックで閉じる
    document.getElementById('modal-overlay').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
    
    // ESCキーで閉じる
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeModal();
    });
    
    // タイトルの編集
    document.getElementById('doc-title').addEventListener('dblclick', editTitle);
    
    // ツリーコンテナのイベント委譲
    document.getElementById('tree-container').addEventListener('click', handleTreeClick);
}

// タイトルの編集
function editTitle() {
    const titleEl = document.getElementById('doc-title');
    const newTitle = prompt('ドキュメントタイトルを入力してください:', documentTitle);
    if (newTitle && newTitle.trim()) {
        documentTitle = newTitle.trim();
        titleEl.textContent = documentTitle;
        saveData();
    }
}

// ユーティリティ関数
function getLevel(req) {
    if (req.level4_id) return 4;
    if (req.level3_id) return 3;
    if (req.level2_id) return 2;
    return 1;
}

function getFullId(req) {
    const ids = [req.level1_id];
    if (req.level2_id) ids.push(req.level2_id);
    if (req.level3_id) ids.push(req.level3_id);
    if (req.level4_id) ids.push(req.level4_id);
    return ids.join('-');
}

function getParentId(req) {
    const level = getLevel(req);
    if (level === 1) return null;
    const ids = [req.level1_id];
    if (level >= 3) ids.push(req.level2_id);
    if (level >= 4) ids.push(req.level3_id);
    return ids.join('-');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function escapeHtmlWithBreaks(text) {
    const escaped = escapeHtml(text);
    return escaped.replace(/\n/g, '<br>');
}

// ツリー構築
function buildTree() {
    const tree = { children: {}, req: null };
    
    requirements.forEach((req, index) => {
        let current = tree;
        const path = [req.level1_id];
        if (req.level2_id) path.push(req.level2_id);
        if (req.level3_id) path.push(req.level3_id);
        if (req.level4_id) path.push(req.level4_id);
        
        path.forEach(part => {
            if (!current.children[part]) {
                current.children[part] = { children: {}, req: null };
            }
            current = current.children[part];
        });
        current.req = req;
        current.index = index;
    });
    
    return tree;
}

// 展開状態を保存
function getExpandedState() {
    const expanded = new Set();
    document.querySelectorAll('.requirement').forEach(el => {
        const children = el.querySelector(':scope > .children');
        if (children && !children.classList.contains('collapsed')) {
            expanded.add(el.dataset.id);
        }
    });
    return expanded;
}

// 展開状態を復元
function restoreExpandedState(expanded) {
    document.querySelectorAll('.requirement').forEach(el => {
        const children = el.querySelector(':scope > .children');
        const btn = el.querySelector(':scope > .req-header > .toggle-btn');
        if (children && btn) {
            if (expanded.has(el.dataset.id)) {
                children.classList.remove('collapsed');
                btn.textContent = '−';
            } else {
                children.classList.add('collapsed');
                btn.textContent = '+';
            }
        }
    });
}

// 描画
function renderTree(preserveState = true) {
    const expanded = preserveState ? getExpandedState() : new Set();
    
    const container = document.getElementById('tree-container');
    const tree = buildTree();
    
    if (Object.keys(tree.children).length === 0) {
        container.innerHTML = '<div class="empty-message">要求がありません。「新規要求追加」ボタンで追加してください。</div>';
        return;
    }
    
    container.innerHTML = renderNode(tree);
    
    if (preserveState) {
        restoreExpandedState(expanded);
    }
}

function renderNode(node) {
    let html = '';
    
    for (const [key, child] of Object.entries(node.children)) {
        const req = child.req;
        if (!req) continue;
        
        const level = getLevel(req);
        const fullId = getFullId(req);
        const hasChildren = Object.keys(child.children).length > 0;
        const canAddChild = level < 4;
        
        let detailsHtml = '';
        if (req.rationale || req.specification || req.category) {
            detailsHtml = '<dl class="req-details">';
            if (req.rationale) detailsHtml += `<dt>理由:</dt><dd>${escapeHtmlWithBreaks(req.rationale)}</dd>`;
            if (req.specification) detailsHtml += `<dt>仕様:</dt><dd>${escapeHtmlWithBreaks(req.specification)}</dd>`;
            if (req.category) detailsHtml += `<dt>分類:</dt><dd>${escapeHtml(req.category)}</dd>`;
            detailsHtml += '</dl>';
        }
        
        const childrenHtml = hasChildren ? `<div class="children">${renderNode(child)}</div>` : '';
        
        const canLevelUp = level > 1;
        const canLevelDown = level < 4 && !hasChildren;
        
        html += `
            <div class="requirement level-${level}" data-id="${fullId}" data-index="${child.index}">
                <div class="req-header">
                    <button class="toggle-btn ${hasChildren ? '' : 'hidden'}" data-action="toggle">−</button>
                    <span class="level-badge">L${level}</span>
                    <span class="req-id">${escapeHtml(fullId)}</span>
                    <span class="req-description">${escapeHtml(req.description)}</span>
                    <div class="req-actions">
                        ${canLevelUp ? `<button class="btn-level-up" data-action="level-up" title="レベルを上げる">↑</button>` : ''}
                        ${canLevelDown ? `<button class="btn-level-down" data-action="level-down" title="レベルを下げる">↓</button>` : ''}
                        <button class="btn-edit" data-action="edit">編集</button>
                        ${canAddChild ? `<button class="btn-add" data-action="add-child" data-parent-id="${fullId}">＋子</button>` : ''}
                        <button class="btn-delete" data-action="delete">削除</button>
                    </div>
                </div>
                ${detailsHtml}
                ${childrenHtml}
            </div>
        `;
    }
    
    return html;
}

// ツリー内のクリックイベント処理
function handleTreeClick(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    
    const action = btn.dataset.action;
    const reqEl = btn.closest('.requirement');
    const index = reqEl ? parseInt(reqEl.dataset.index) : -1;
    
    switch (action) {
        case 'toggle':
            toggleNode(btn);
            break;
        case 'level-up':
            if (index >= 0) levelUp(index);
            break;
        case 'level-down':
            if (index >= 0) levelDown(index);
            break;
        case 'edit':
            if (index >= 0) editRequirement(index);
            break;
        case 'add-child':
            const parentId = btn.dataset.parentId;
            if (parentId) addChildRequirement(parentId);
            break;
        case 'delete':
            if (index >= 0) deleteRequirement(index);
            break;
    }
}

// 展開・折りたたみ
function toggleNode(btn) {
    const parent = btn.closest('.requirement');
    const children = parent.querySelector(':scope > .children');
    if (children) {
        children.classList.toggle('collapsed');
        btn.textContent = children.classList.contains('collapsed') ? '+' : '−';
    }
}

function expandAll() {
    document.querySelectorAll('.children').forEach(el => el.classList.remove('collapsed'));
    document.querySelectorAll('.toggle-btn:not(.hidden)').forEach(btn => btn.textContent = '−');
}

function collapseAll() {
    document.querySelectorAll('.children').forEach(el => el.classList.add('collapsed'));
    document.querySelectorAll('.toggle-btn:not(.hidden)').forEach(btn => btn.textContent = '+');
}

// モーダル操作
function openModal(title) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.getElementById('req-form').reset();
    document.getElementById('edit-index').value = '';
    document.getElementById('id-display').classList.remove('duplicate');
}

function updateIdDisplay() {
    const l1 = document.getElementById('level1_id').value.trim();
    const l2 = document.getElementById('level2_id').value.trim();
    const l3 = document.getElementById('level3_id').value.trim();
    const l4 = document.getElementById('level4_id').value.trim();
    
    const ids = [l1];
    if (l2) ids.push(l2);
    if (l3) ids.push(l3);
    if (l4) ids.push(l4);
    const fullId = ids.join('-');
    
    // レベルを計算
    let level = 1;
    if (l4) level = 4;
    else if (l3) level = 3;
    else if (l2) level = 2;
    
    const display = document.getElementById('id-display');
    display.textContent = `ID: ${fullId || '(未入力)'}`;
    display.classList.remove('duplicate', 'no-parent');
    
    const editIndex = document.getElementById('edit-index').value;
    
    // 重複チェック
    const isDuplicate = requirements.some((req, index) => {
        if (editIndex !== '' && index === parseInt(editIndex)) return false;
        return getFullId(req) === fullId;
    });
    
    if (isDuplicate && fullId) {
        display.classList.add('duplicate');
        display.textContent = `⚠️ ID: ${fullId} (重複しています)`;
        return;
    }
    
    // 親要求の存在チェック（L2以上の場合）
    if (level >= 2 && fullId) {
        // 親IDを計算
        const parentIds = [l1];
        if (level >= 3) parentIds.push(l2);
        if (level >= 4) parentIds.push(l3);
        const parentId = parentIds.join('-');
        
        const parentExists = requirements.some(req => getFullId(req) === parentId);
        
        if (!parentExists) {
            display.classList.add('no-parent');
            display.textContent = `⚠️ ID: ${fullId} (親要求 "${parentId}" が存在しません)`;
        }
    }
}

// 新規ルート要求追加
function addRootRequirement() {
    document.getElementById('edit-index').value = '';
    document.getElementById('level1_id').value = '';
    document.getElementById('level2_id').value = '';
    document.getElementById('level3_id').value = '';
    document.getElementById('level4_id').value = '';
    document.getElementById('description').value = '';
    document.getElementById('rationale').value = '';
    document.getElementById('specification').value = '';
    document.getElementById('category').value = '';

    const maxL1 = Math.max(0, ...requirements.filter(r => getLevel(r) === 1).map(r => parseInt(r.level1_id) || 0));
    document.getElementById('level1_id').value = maxL1 + 1;

    updateIdDisplay();
    openModal('新規要求を追加');
}

// 子要求追加
function addChildRequirement(parentId) {
    const parentReq = requirements.find(r => getFullId(r) === parentId);
    if (!parentReq) return;
    
    const parentLevel = getLevel(parentReq);
    if (parentLevel >= 4) {
        alert('レベル4以上の子要求は追加できません');
        return;
    }
    
    document.getElementById('edit-index').value = '';
    document.getElementById('description').value = '';
    document.getElementById('rationale').value = '';
    document.getElementById('specification').value = '';
    document.getElementById('category').value = '';

    const childLevel = parentLevel + 1;
    const childIdField = `level${childLevel}_id`;
    
    const siblings = requirements.filter(r => {
        if (getLevel(r) !== childLevel) return false;
        const rParentId = getParentId(r);
        return rParentId === parentId;
    });
    
    const maxChildId = Math.max(0, ...siblings.map(r => {
        const id = r[childIdField];
        return parseInt(id) || 0;
    }));
    
    document.getElementById('level1_id').value = parentReq.level1_id;
    document.getElementById('level2_id').value = parentReq.level2_id || '';
    document.getElementById('level3_id').value = parentReq.level3_id || '';
    document.getElementById('level4_id').value = '';
    
    document.getElementById(childIdField).value = maxChildId + 1;
    
    updateIdDisplay();
    openModal('子要求を追加');
}

// 編集
function editRequirement(index) {
    const req = requirements[index];
    document.getElementById('edit-index').value = index;
    document.getElementById('level1_id').value = req.level1_id;
    document.getElementById('level2_id').value = req.level2_id || '';
    document.getElementById('level3_id').value = req.level3_id || '';
    document.getElementById('level4_id').value = req.level4_id || '';
    document.getElementById('description').value = req.description;
    document.getElementById('rationale').value = req.rationale || '';
    document.getElementById('specification').value = req.specification || '';
    document.getElementById('category').value = req.category || '';
    updateIdDisplay();
    openModal('要求を編集');
}

// 削除
function deleteRequirement(index) {
    const req = requirements[index];
    const fullId = getFullId(req);
    
    const toDelete = requirements.filter(r => {
        const rId = getFullId(r);
        return rId === fullId || rId.startsWith(fullId + '-');
    });
    
    const message = toDelete.length > 1 
        ? `この要求と${toDelete.length - 1}件の子要求を削除しますか？`
        : 'この要求を削除しますか？';
    
    if (confirm(message)) {
        requirements = requirements.filter(r => {
            const rId = getFullId(r);
            return rId !== fullId && !rId.startsWith(fullId + '-');
        });
        saveData();
        renderTree();
    }
}

// レベルを上げる
function levelUp(index) {
    const req = requirements[index];
    const level = getLevel(req);
    
    if (level <= 1) {
        alert('これ以上レベルを上げられません');
        return;
    }
    
    const newReq = { ...req };
    
    if (level === 2) {
        const maxL1 = Math.max(0, ...requirements.filter(r => getLevel(r) === 1).map(r => parseInt(r.level1_id) || 0));
        newReq.level1_id = String(maxL1 + 1);
        newReq.level2_id = '';
        newReq.level3_id = '';
        newReq.level4_id = '';
    } else if (level === 3) {
        const siblings = requirements.filter(r => 
            r.level1_id === req.level1_id && getLevel(r) === 2
        );
        const maxL2 = Math.max(0, ...siblings.map(r => parseInt(r.level2_id) || 0));
        newReq.level2_id = String(maxL2 + 1);
        newReq.level3_id = '';
        newReq.level4_id = '';
    } else if (level === 4) {
        const siblings = requirements.filter(r => 
            r.level1_id === req.level1_id && 
            r.level2_id === req.level2_id && 
            getLevel(r) === 3
        );
        const maxL3 = Math.max(0, ...siblings.map(r => parseInt(r.level3_id) || 0));
        newReq.level3_id = String(maxL3 + 1);
        newReq.level4_id = '';
    }
    
    const newFullId = getFullId(newReq);
    if (requirements.some((r, i) => i !== index && getFullId(r) === newFullId)) {
        alert(`ID "${newFullId}" は既に存在します`);
        return;
    }
    
    requirements[index] = newReq;
    requirements.sort((a, b) => getFullId(a).localeCompare(getFullId(b), undefined, { numeric: true }));
    saveData();
    renderTree();
}

// レベルを下げる
function levelDown(index) {
    const req = requirements[index];
    const level = getLevel(req);
    
    if (level >= 4) {
        alert('これ以上レベルを下げられません');
        return;
    }
    
    const fullId = getFullId(req);
    const hasChildren = requirements.some(r => {
        const rId = getFullId(r);
        return rId !== fullId && rId.startsWith(fullId + '-');
    });
    
    if (hasChildren) {
        alert('子要求がある要求のレベルは下げられません');
        return;
    }
    
    let parentReq = null;
    const sortedReqs = [...requirements].sort((a, b) => 
        getFullId(a).localeCompare(getFullId(b), undefined, { numeric: true })
    );
    
    const currentIdx = sortedReqs.findIndex(r => getFullId(r) === fullId);
    
    for (let i = currentIdx - 1; i >= 0; i--) {
        const candidate = sortedReqs[i];
        const candidateLevel = getLevel(candidate);
        
        if (candidateLevel === level) {
            parentReq = candidate;
            break;
        } else if (candidateLevel < level) {
            break;
        }
    }
    
    if (!parentReq) {
        alert('親となる要求が見つかりません。');
        return;
    }
    
    const newReq = { ...req };
    
    if (level === 1) {
        newReq.level1_id = parentReq.level1_id;
        const siblings = requirements.filter(r => 
            r.level1_id === parentReq.level1_id && getLevel(r) === 2
        );
        const maxL2 = Math.max(0, ...siblings.map(r => parseInt(r.level2_id) || 0));
        newReq.level2_id = String(maxL2 + 1);
    } else if (level === 2) {
        newReq.level1_id = parentReq.level1_id;
        newReq.level2_id = parentReq.level2_id;
        const siblings = requirements.filter(r => 
            r.level1_id === parentReq.level1_id && 
            r.level2_id === parentReq.level2_id && 
            getLevel(r) === 3
        );
        const maxL3 = Math.max(0, ...siblings.map(r => parseInt(r.level3_id) || 0));
        newReq.level3_id = String(maxL3 + 1);
    } else if (level === 3) {
        newReq.level1_id = parentReq.level1_id;
        newReq.level2_id = parentReq.level2_id;
        newReq.level3_id = parentReq.level3_id;
        const siblings = requirements.filter(r => 
            r.level1_id === parentReq.level1_id && 
            r.level2_id === parentReq.level2_id && 
            r.level3_id === parentReq.level3_id && 
            getLevel(r) === 4
        );
        const maxL4 = Math.max(0, ...siblings.map(r => parseInt(r.level4_id) || 0));
        newReq.level4_id = String(maxL4 + 1);
    }
    
    const newFullId = getFullId(newReq);
    if (requirements.some((r, i) => i !== index && getFullId(r) === newFullId)) {
        alert(`ID "${newFullId}" は既に存在します`);
        return;
    }
    
    requirements[index] = newReq;
    requirements.sort((a, b) => getFullId(a).localeCompare(getFullId(b), undefined, { numeric: true }));
    saveData();
    renderTree();
}

// フォーム送信
function handleFormSubmit(e) {
    e.preventDefault();
    
    const editIndex = document.getElementById('edit-index').value;
    const newReq = {
        level1_id: document.getElementById('level1_id').value.trim(),
        level2_id: document.getElementById('level2_id').value.trim(),
        level3_id: document.getElementById('level3_id').value.trim(),
        level4_id: document.getElementById('level4_id').value.trim(),
        description: document.getElementById('description').value,
        rationale: document.getElementById('rationale').value,
        specification: document.getElementById('specification').value,
        category: document.getElementById('category').value.trim()
    };
    
    const newFullId = getFullId(newReq);
    const newLevel = getLevel(newReq);
    
    // 重複チェック
    const isDuplicate = requirements.some((req, index) => {
        if (editIndex !== '' && index === parseInt(editIndex)) return false;
        return getFullId(req) === newFullId;
    });
    
    if (isDuplicate) {
        alert(`ID "${newFullId}" は既に存在します。`);
        return;
    }
    
    // 親要求の存在チェック（L2以上の場合）
    if (newLevel >= 2) {
        const parentId = getParentId(newReq);
        const parentExists = requirements.some((req, index) => {
            // 編集中の要求自身は除外しない（親は別の要求なので）
            return getFullId(req) === parentId;
        });
        
        if (!parentExists) {
            alert(`親要求 "${parentId}" が存在しません。先に親要求を作成してください。`);
            return;
        }
    }
    
    if (editIndex !== '') {
        requirements[parseInt(editIndex)] = newReq;
    } else {
        requirements.push(newReq);
    }
    
    requirements.sort((a, b) => getFullId(a).localeCompare(getFullId(b), undefined, { numeric: true }));
    
    closeModal();
    saveData();
    renderTree();
}

// CSVエクスポート
function exportCSV() {
    const headers = ['レベル1 ID', 'レベル2 ID', 'レベル3 ID', 'レベル4 ID', '要求', '理由', '仕様', '分類'];
    const rows = requirements.map(req => [
        req.level1_id,
        req.level2_id || '',
        req.level3_id || '',
        req.level4_id || '',
        req.description,
        req.rationale || '',
        req.specification || '',
        req.category || ''
    ]);
    
    const csvLines = [
        headers.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','),
        ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    ];
    const csvContent = csvLines.join('\r\n');
    
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    // ファイル名をタイトルから生成
    const fileName = documentTitle.replace(/[\\/:*?"<>|]/g, '_') + '.csv';
    link.download = fileName;
    link.click();
}

// CSVインポート
function importCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // ファイル名から拡張子を除いてタイトルにする
    const fileName = file.name;
    const newTitle = fileName.replace(/\.[^/.]+$/, '') || 'USDM要求仕様書';
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            let text = e.target.result;
            if (text.charCodeAt(0) === 0xFEFF) {
                text = text.slice(1);
            }
            
            const allRows = parseCSV(text);
            
            // コメント行（#で始まる）を除外してデータ行のみ抽出
            const dataRows = [];
            
            for (const row of allRows) {
                const firstCell = (row[0] || '').trim();
                if (!firstCell.startsWith('#')) {
                    dataRows.push(row);
                }
            }
            
            if (dataRows.length < 2) {
                alert('エラー: CSVファイルにデータがありません（ヘッダー行とデータ行が必要です）');
                return;
            }
            
            // 1行目: ヘッダー（スキップ）
            // 2行目以降: データ
            
            function validateRequirement(req, lineNum) {
                const errors = [];
                
                if (!req.level1_id) {
                    errors.push('レベル1 IDが空です');
                } else if (req.level1_id === '0' || !/^[1-9][0-9]*$/.test(req.level1_id)) {
                    errors.push(`レベル1 ID "${req.level1_id}" は1以上の整数である必要があります`);
                }
                
                ['level2_id', 'level3_id', 'level4_id'].forEach((field, idx) => {
                    const val = req[field];
                    if (val && (val === '0' || !/^[1-9][0-9]*$/.test(val))) {
                        errors.push(`レベル${idx + 2} ID "${val}" は空か1以上の整数である必要があります`);
                    }
                });
                
                if (!req.level2_id && req.level3_id) {
                    errors.push('レベル2 IDが空なのにレベル3 IDが設定されています');
                }
                if (!req.level3_id && req.level4_id) {
                    errors.push('レベル3 IDが空なのにレベル4 IDが設定されています');
                }
                if (!req.level2_id && req.level4_id) {
                    errors.push('レベル2 IDが空なのにレベル4 IDが設定されています');
                }
                
                if (!req.description) {
                    errors.push('要求が空です');
                }
                
                return errors;
            }
            
            const newRequirements = [];
            const allErrors = [];
            
            // 2行目（index 1）からデータ読み込み（1行目はヘッダー）
            for (let i = 1; i < dataRows.length; i++) {
                const cells = dataRows[i];
                if (cells.length < 5) {
                    allErrors.push(`データ行${i + 1}: 列数が不足しています`);
                    continue;
                }
                
                const req = {
                    level1_id: (cells[0] || '').trim(),
                    level2_id: (cells[1] || '').trim(),
                    level3_id: (cells[2] || '').trim(),
                    level4_id: (cells[3] || '').trim(),
                    description: (cells[4] || '').trim(),
                    rationale: (cells[5] || '').trim(),
                    specification: (cells[6] || '').trim(),
                    category: (cells[7] || '').trim()
                };
                
                const errors = validateRequirement(req, i + 1);
                if (errors.length > 0) {
                    allErrors.push(`データ行${i + 1}: ${errors.join(', ')}`);
                } else {
                    newRequirements.push(req);
                }
            }
            
            if (allErrors.length > 0) {
                const maxShow = 10;
                let errorMsg = `CSVデータに${allErrors.length}件のエラーがあります:\n\n`;
                errorMsg += allErrors.slice(0, maxShow).join('\n');
                if (allErrors.length > maxShow) {
                    errorMsg += `\n...他${allErrors.length - maxShow}件`;
                }
                alert(errorMsg);
                return;
            }

            // 親要求の存在チェック
            const importedIds = new Set(newRequirements.map(r => getFullId(r)));
            const parentErrors = [];

            for (const req of newRequirements) {
                const level = getLevel(req);
                if (level >= 2) {
                    const parentId = getParentId(req);
                    if (!importedIds.has(parentId)) {
                        parentErrors.push(`要求 "${getFullId(req)}": 親要求 "${parentId}" が存在しません`);
                    }
                }
            }

            if (parentErrors.length > 0) {
                const maxShow = 10;
                let errorMsg = `親要求が存在しないエラーが${parentErrors.length}件あります:\n\n`;
                errorMsg += parentErrors.slice(0, maxShow).join('\n');
                if (parentErrors.length > maxShow) {
                    errorMsg += `\n...他${parentErrors.length - maxShow}件`;
                }
                alert(errorMsg);
                return;
            }
            
            if (newRequirements.length > 0) {
                if (confirm(`「${newTitle}」として${newRequirements.length}件の要求をインポートします。現在のデータは上書きされます。`)) {
                    documentTitle = newTitle;
                    document.getElementById('doc-title').textContent = documentTitle;
                    requirements = newRequirements;
                    saveData();
                    renderTree();
                }
            } else {
                alert('インポートできる要求が見つかりませんでした');
            }
        } catch (err) {
            alert('CSVの読み込みに失敗しました: ' + err.message);
        }
    };
    reader.readAsText(file, 'UTF-8');
    event.target.value = '';
}

// CSVパーサー
function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        
        if (inQuotes) {
            if (char === '"') {
                if (nextChar === '"') {
                    currentCell += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                currentCell += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                currentRow.push(currentCell);
                currentCell = '';
            } else if (char === '\r' || char === '\n') {
                if (char === '\r' && nextChar === '\n') {
                    i++;
                }
                currentRow.push(currentCell);
                if (currentRow.some(cell => cell.trim())) {
                    rows.push(currentRow);
                }
                currentRow = [];
                currentCell = '';
            } else {
                currentCell += char;
            }
        }
    }
    
    currentRow.push(currentCell);
    if (currentRow.some(cell => cell.trim())) {
        rows.push(currentRow);
    }
    
    return rows;
}

// PDF出力
function exportPDF() {
    const printContent = generatePrintContent();
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>${escapeHtml(documentTitle)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Hiragino Kaku Gothic ProN', 'メイリオ', sans-serif;
            padding: 10mm;
            font-size: 10pt;
        }
        h1 { 
            font-size: 14pt; 
            border-bottom: 2px solid #333;
            padding-bottom: 3px;
            margin-bottom: 8px;
        }
        .req {
            border: 1px solid #999;
            margin: 2px 0;
            padding: 3px 6px;
            background: #fff;
            page-break-inside: avoid;
        }
        .req.L1 { margin-left: 0; border-left: 3px solid #4a90d9; background: #f0f7fc; }
        .req.L2 { margin-left: 15px; border-left: 3px solid #5cb85c; background: #f0fcf0; }
        .req.L3 { margin-left: 30px; border-left: 3px solid #f0ad4e; background: #fffcf0; }
        .req.L4 { margin-left: 45px; border-left: 3px solid #d9534f; background: #fcf0f0; }
        .req-header { display: flex; align-items: center; gap: 5px; }
        .level-badge {
            font-size: 8pt;
            padding: 1px 4px;
            background: #666;
            color: white;
            border-radius: 3px;
        }
        .req-id {
            font-family: monospace;
            font-size: 8pt;
            background: #eee;
            padding: 1px 4px;
            border-radius: 2px;
        }
        .req-desc { font-weight: 500; }
        .req-details { 
            font-size: 9pt; 
            margin-top: 2px;
            padding-left: 10px;
            color: #444;
        }
        .req-details dt { 
            display: inline;
            font-weight: bold;
        }
        .req-details dd { 
            display: inline;
            margin: 0 10px 0 3px;
        }
    </style>
</head>
<body>
    <h1>${escapeHtml(documentTitle)}</h1>
    ${printContent}
</body>
</html>
    `);
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.print();
    }, 300);
}

function generatePrintContent() {
    let html = '';
    
    const sorted = [...requirements].sort((a, b) => {
        return getFullId(a).localeCompare(getFullId(b), undefined, { numeric: true });
    });
    
    for (const req of sorted) {
        const level = getLevel(req);
        const fullId = getFullId(req);
        
        let detailsHtml = '';
        if (req.rationale || req.specification || req.category) {
            detailsHtml = '<div class="req-details">';
            if (req.rationale) detailsHtml += `<dt>理由:</dt><dd>${escapeHtmlWithBreaks(req.rationale)}</dd>`;
            if (req.specification) detailsHtml += `<dt>仕様:</dt><dd>${escapeHtmlWithBreaks(req.specification)}</dd>`;
            if (req.category) detailsHtml += `<dt>分類:</dt><dd>${escapeHtml(req.category)}</dd>`;
            detailsHtml += '</div>';
        }
        
        html += `
            <div class="req L${level}">
                <div class="req-header">
                    <span class="level-badge">L${level}</span>
                    <span class="req-id">${escapeHtml(fullId)}</span>
                    <span class="req-desc">${escapeHtml(req.description)}</span>
                </div>
                ${detailsHtml}
            </div>
        `;
    }
    
    return html;
}

// データのクリア
function clearAllData() {
    if (confirm('すべてのデータを削除しますか？この操作は取り消せません。')) {
        requirements = [];
        saveData();
        renderTree(false);
    }
}
