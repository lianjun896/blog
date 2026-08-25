/* ============================================================
   app.js —— 登录 + 博客融合页面逻辑
   登录成功后在同一页面内切换显示博客界面，不跳转
   ============================================================ */

const STORAGE_KEY = 'blog_new_messages';
let allMessages = [];
let blogInitialized = false;

/* ============================================================
   一、登录逻辑
   ============================================================ */

/* 页面加载：检查是否已登录，已登录则直接显示博客 */
document.addEventListener('DOMContentLoaded', function () {
    if (sessionStorage.getItem('loggedIn') === 'true') {
        showBlog();
    }
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
});

/* 登录表单提交处理 */
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.textContent = '';

    if (!username || !password) {
        errorMsg.textContent = '账号和密码都不能为空';
        return;
    }

    try {
        const response = await fetch('users.json');
        if (!response.ok) {
            throw new Error('无法读取 users.json（状态码：' + response.status + '）');
        }
        const users = await response.json();
        const matched = users.find(function (u) {
            return u.username === username && u.password === password;
        });

        if (matched) {
            // 登录成功：记录状态，自动填充博客用户名，切换到博客界面
            sessionStorage.setItem('loggedIn', 'true');
            sessionStorage.setItem('currentUser', username);
            document.getElementById('blogUsername').value = username;
            showBlog();
        } else {
            errorMsg.textContent = '账号或密码错误，请重试';
        }
    } catch (err) {
        console.error('登录异常：', err);
        errorMsg.textContent = '登录系统异常：' + err.message;
    }
}

/* 隐藏登录界面，显示博客界面 */
function showBlog() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('blogSection').style.display = 'block';
    if (!blogInitialized) {
        initBlog();
        blogInitialized = true;
    }
}

/* ============================================================
   二、博客逻辑（登录成功后初始化）
   ============================================================ */

/* 初始化博客：绑定事件 + 加载留言 */
function initBlog() {
    // 电脑端保存按钮
    document.getElementById('saveBtn').addEventListener('click', function () {
        const username = document.getElementById('blogUsername').value;
        const content = document.getElementById('inputText').value;
        if (!content.trim()) { alert('请输入留言内容'); return; }
        addMessage(username, content);
        document.getElementById('inputText').value = '';
    });

    // 手机端悬浮加号
    document.getElementById('fabBtn').addEventListener('click', function () {
        document.getElementById('modal').classList.add('active');
        document.getElementById('modalInput').focus();
    });

    // 手机端取消
    document.getElementById('modalCloseBtn').addEventListener('click', function () {
        document.getElementById('modal').classList.remove('active');
    });

    // 手机端遮罩关闭
    document.getElementById('modal').addEventListener('click', function (e) {
        if (e.target === this) this.classList.remove('active');
    });

    // 手机端保存
    document.getElementById('modalSaveBtn').addEventListener('click', function () {
        const username = document.getElementById('modalUsername').value;
        const content = document.getElementById('modalInput').value;
        if (!content.trim()) { alert('请输入留言内容'); return; }
        addMessage(username, content);
        document.getElementById('modalInput').value = '';
        document.getElementById('modal').classList.remove('active');
    });

    // JSON弹窗：重新复制
    document.getElementById('jsonCopyBtn').addEventListener('click', function () {
        copyToClipboard(document.getElementById('jsonOutput').value);
    });

    // JSON弹窗：关闭
    document.getElementById('jsonCloseBtn').addEventListener('click', function () {
        document.getElementById('jsonModal').classList.remove('active');
    });

    // JSON弹窗：遮罩关闭
    document.getElementById('jsonModal').addEventListener('click', function (e) {
        if (e.target === this) this.classList.remove('active');
    });

    // 加载留言
    loadMessages();
}

/* 生成精确时间：YYYY年MM月DD日 HH:MM:SS */
function formatTime(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return y + '年' + m + '月' + d + '日 ' + h + ':' + min + ':' + s;
}

/* HTML 转义 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/* 读取 localStorage 中新增的留言 */
function getLocalMessages() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) { return []; }
}

/* 保存新增留言到 localStorage */
function saveLocalMessage(msg) {
    const list = getLocalMessages();
    list.unshift(msg);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/* 加载留言：读取 messages.json + 合并本地新增（去重） */
async function loadMessages() {
    let fileMessages = [];
    try {
        const res = await fetch('messages.json');
        if (res.ok) fileMessages = await res.json();
    } catch (e) {
        console.warn('无法读取 messages.json：', e);
    }
    const localMessages = getLocalMessages();
    const merged = [];
    const seen = new Set();
    localMessages.concat(fileMessages).forEach(function (msg) {
        const key = (msg.content || '') + '|' + (msg.time || '');
        if (!seen.has(key)) { seen.add(key); merged.push(msg); }
    });
    allMessages = merged;
    renderMessages();
}

/* 渲染留言列表 */
function renderMessages() {
    const list = document.getElementById('messageList');
    if (allMessages.length === 0) {
        list.innerHTML = '<div class="empty-tip">还没有留言，写点什么吧~</div>';
        return;
    }
    list.innerHTML = allMessages.map(function (msg) {
        return '<div class="message-item">' +
            '<div class="message-header">' +
                '<span class="message-username">' + escapeHtml(msg.username || '匿名') + '</span>' +
                '<span class="message-time">' + escapeHtml(msg.time || '') + '</span>' +
            '</div>' +
            '<div class="message-content">' + escapeHtml(msg.content || '') + '</div>' +
        '</div>';
    }).join('');
}

/* 添加一条新留言 */
function addMessage(username, content) {
    const msg = {
        username: username.trim() || '匿名',
        content: content.trim(),
        time: formatTime(new Date())
    };
    allMessages.unshift(msg);
    saveLocalMessage(msg);
    renderMessages();
    showJsonOutput();
}

/* 生成完整 messages.json 并显示弹窗、自动复制 */
function showJsonOutput() {
    const jsonStr = JSON.stringify(allMessages, null, 4);
    document.getElementById('jsonOutput').value = jsonStr;
    document.getElementById('jsonModal').classList.add('active');
    copyToClipboard(jsonStr);
}

/* 复制到剪贴板 */
function copyToClipboard(text) {
    const statusEl = document.getElementById('copyStatus');
    statusEl.className = 'copy-status';
    statusEl.textContent = '';
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () {
            statusEl.textContent = '已自动复制到剪贴板 ✓';
        }).catch(function () { fallbackCopy(text); });
    } else {
        fallbackCopy(text);
    }
}

/* 降级复制方案 */
function fallbackCopy(text) {
    const statusEl = document.getElementById('copyStatus');
    const textarea = document.getElementById('jsonOutput');
    try {
        textarea.removeAttribute('readonly');
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        const ok = document.execCommand('copy');
        textarea.setAttribute('readonly', 'readonly');
        statusEl.textContent = ok ? '已自动复制到剪贴板 ✓' : '自动复制失败，请手动按 Ctrl+C 复制';
        if (!ok) statusEl.className = 'copy-status error';
    } catch (e) {
        statusEl.className = 'copy-status error';
        statusEl.textContent = '自动复制失败，请手动选中复制';
    }
}
