/* ============================================================
   app.js —— 登录 + 博客融合页面逻辑
   登录成功后在同一页面内切换显示博客界面，不跳转
   ============================================================ */

const STORAGE_KEY = 'blog_new_messages';
let allMessages = [];
let blogInitialized = false;
let currentProfile = null;   // 当前登录用户的个人资料（来自 user_profiles.json）
let allProfiles = [];        // 全部用户的个人资料（用于点击留言头像查看他人资料）

/* ============================================================
   0、工具函数
   ============================================================ */

/* 解析 JSONC 格式：支持 // 行注释和斜杠星号块注释（方便在配置文件里写中文说明），
   也兼容标准 JSON。字符串必须使用双引号，不能有末尾逗号。 */
function parseJsonc(text) {
    if (!text) return null;
    let out = '';
    let i = 0;
    const n = text.length;
    let inStr = false;
    while (i < n) {
        const ch = text[i];
        if (inStr) {
            out += ch;
            if (ch === '\\') { i++; if (i < n) out += text[i]; }
            else if (ch === '"') inStr = false;
            i++;
            continue;
        }
        if (ch === '"') { inStr = true; out += ch; i++; continue; }
        if (ch === '/' && text[i + 1] === '/') {
            while (i < n && text[i] !== '\n') i++;
            continue;
        }
        if (ch === '/' && text[i + 1] === '*') {
            i += 2;
            while (i < n && !(text[i] === '*' && text[i + 1] === '/')) i++;
            i += 2;
            continue;
        }
        out += ch;
        i++;
    }
    return JSON.parse(out);
}

/* 读取本地 JSONC/JSON 文件：返回解析后的对象，失败返回 null */
async function fetchJsonc(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const text = await res.text();
        return parseJsonc(text);
    } catch (e) {
        console.warn('无法读取 ' + url + '：', e);
        return null;
    }
}

/* ============================================================
   一、登录逻辑
   ============================================================ */

/* 页面加载：检查是否已登录，已登录则直接显示博客 */
document.addEventListener('DOMContentLoaded', async function () {
    if (sessionStorage.getItem('loggedIn') === 'true') {
        const user = sessionStorage.getItem('currentUser');
        await loadUserProfile(user);
        showBlog();
    }
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    /* 使用条款弹窗：登录前后均可打开/关闭 */
    const termsModal = document.getElementById('termsModal');
    function openTerms() { termsModal.classList.add('active'); }
    document.getElementById('termsLinkLogin').addEventListener('click', openTerms);
    document.getElementById('termsLinkBlog').addEventListener('click', openTerms);
    document.getElementById('termsCloseBtn').addEventListener('click', function () {
        termsModal.classList.remove('active');
    });
    termsModal.addEventListener('click', function (e) {
        if (e.target === termsModal) termsModal.classList.remove('active');
    });
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
        const users = await fetchJsonc('users.json');
        if (!users) {
            throw new Error('无法读取 users.json，请检查文件是否存在或格式是否正确');
        }
        const matched = users.find(function (u) {
            return u.username === username && u.password === password;
        });

        if (matched) {
            // 登录成功：记录状态，自动填充博客用户名，切换到博客界面
            sessionStorage.setItem('loggedIn', 'true');
            sessionStorage.setItem('currentUser', username);
            document.getElementById('blogUsername').value = username;
            await loadUserProfile(username);
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
    // 顶部导航显示当前登录用户
    const label = document.getElementById('currentUserLabel');
    const user = sessionStorage.getItem('currentUser');
    label.textContent = user ? (user + ' 已登录') : '';
    // 渲染左上角用户信息卡片
    renderUserProfile();
    if (!blogInitialized) {
        initBlog();
        blogInitialized = true;
    }
}

/* ============================================================
   三、用户资料（左上角卡片 + 资料弹窗）
   数据来源：user_profiles.json（可在文件中增删字段，自动展示）
   ============================================================ */

/* 读取当前登录用户的个人资料，同时缓存全部用户的资料 */
async function loadUserProfile(username) {
    allProfiles = [];
    currentProfile = null;
    const profiles = await fetchJsonc('user_profiles.json');
    if (profiles) {
        allProfiles = profiles;
        const found = profiles.find(function (p) {
            return p.username === username;
        });
        currentProfile = found || null;
    }
}

/* 根据用户名查找个人资料；没有配置资料时返回一个兜底对象 */
function getProfileFor(username) {
    if (!username) return null;
    const found = allProfiles.find(function (p) {
        return p.username === username;
    });
    if (found) return found;
    return {
        username: username,
        nickname: username,
        avatar: '',
        signature: '这个人很懒，什么都没写~'
    };
}

/* 设置头像：有头像文件就显示图片，否则显示首字母彩色圆（仿微信默认头像） */
function setAvatar(imgEl, letterEl, avatarName, fallbackText) {
    const letter = (fallbackText || '?').charAt(0).toUpperCase();
    if (avatarName) {
        imgEl.src = avatarName;
        imgEl.style.display = '';
        letterEl.style.display = 'none';
        letterEl.textContent = letter;
        imgEl.onerror = function () {
            // 头像文件缺失/加载失败时回退为首字母
            imgEl.style.display = 'none';
            letterEl.textContent = letter;
            letterEl.style.display = '';
        };
    } else {
        imgEl.removeAttribute('src');
        imgEl.style.display = 'none';
        letterEl.textContent = letter;
        letterEl.style.display = '';
    }
}

/* 渲染左上角用户信息卡片（头像在左、昵称在右、下方个性签名） */
function renderUserProfile() {
    const nicknameEl = document.getElementById('profileNickname');
    const sigEl = document.getElementById('profileSignature');
    const levelEl = document.getElementById('profileLevel');

    const nickname = (currentProfile && (currentProfile.nickname || currentProfile.username)) || sessionStorage.getItem('currentUser') || '匿名';
    const signature = (currentProfile && currentProfile.signature) || '这个人很懒，什么都没写~';

    nicknameEl.textContent = nickname;
    sigEl.textContent = signature;
    levelEl.textContent = (currentProfile && currentProfile.level) || '';

    setAvatar(
        document.getElementById('profileAvatar'),
        document.getElementById('profileAvatarLetter'),
        currentProfile ? currentProfile.avatar : '',
        nickname
    );
}

/* 资料弹窗中要展示的字段顺序与中文名（新增字段若未在此配置，也会自动显示，标签用字段名） */
const PROFILE_FIELD_LABELS = {
    gender: '性别',
    region: '地区',
    birthday: '生日',
    constellation: '星座',
    email: '邮箱',
    occupation: '职业',
    hobby: '爱好',
    bio: '个人简介'
};
const PROFILE_FIELD_ORDER = ['gender', 'region', 'birthday', 'constellation', 'email', 'occupation', 'hobby', 'bio'];
const PROFILE_RESERVED_KEYS = ['username', 'nickname', 'avatar', 'signature', 'tags', 'level', 'memberSince'];

/* 打开个人资料弹窗：信息全部来自 user_profiles.json，动态渲染。
   username 可指定要查看的用户（如点击某条留言的头像）；不传则默认查看当前登录用户。 */
function openProfileModal(username) {
    const target = getProfileFor(username || sessionStorage.getItem('currentUser'));
    if (!target) return;

    const modal = document.getElementById('profileModal');
    const nickname = target.nickname || target.username || '匿名';

    document.getElementById('modalNickname').textContent = nickname;
    document.getElementById('modalSignature').textContent = target.signature || '这个人很懒，什么都没写~';

    setAvatar(
        document.getElementById('modalAvatar'),
        document.getElementById('modalAvatarLetter'),
        target.avatar || '',
        nickname
    );

    // 渲染资料字段（空值不显示；按配置顺序展示，JSON 中新增的字段会自动追加）
    const fieldsEl = document.getElementById('profileFields');
    let html = '';
    if (target) {
        PROFILE_FIELD_ORDER.forEach(function (key) {
            const val = target[key];
            if (val === undefined || val === null || val === '') return;
            html += '<div class="profile-field">' +
                '<span class="profile-field-label">' + escapeHtml(PROFILE_FIELD_LABELS[key] || key) + '</span>' +
                '<span class="profile-field-value">' + escapeHtml(String(val)) + '</span>' +
                '</div>';
        });
        // 自动展示 JSON 里额外新增的字段
        Object.keys(target).forEach(function (key) {
            if (PROFILE_FIELD_ORDER.indexOf(key) !== -1) return;
            if (PROFILE_RESERVED_KEYS.indexOf(key) !== -1) return;
            const val = target[key];
            if (val === undefined || val === null || val === '') return;
            html += '<div class="profile-field">' +
                '<span class="profile-field-label">' + escapeHtml(key) + '</span>' +
                '<span class="profile-field-value">' + escapeHtml(String(val)) + '</span>' +
                '</div>';
        });
    }
    fieldsEl.innerHTML = html || '<div class="profile-empty-tip">还没有填写更多资料～</div>';

    // 标签
    const tagsEl = document.getElementById('profileTags');
    const tags = (target && target.tags) || [];
    if (tags.length) {
        tagsEl.innerHTML = tags.map(function (t) {
            return '<span class="profile-tag">' + escapeHtml(String(t)) + '</span>';
        }).join('');
        tagsEl.style.display = '';
    } else {
        tagsEl.innerHTML = '';
        tagsEl.style.display = 'none';
    }

    // 加入时间
    document.getElementById('profileFoot').textContent = (target && target.memberSince)
        ? '加入于 ' + target.memberSince
        : '';

    modal.classList.add('active');
}

/* ============================================================
   二、博客逻辑（登录成功后初始化）
   ============================================================ */

/* 初始化博客：绑定事件 + 加载留言 */
function initBlog() {
    // 退出登录
    document.getElementById('logoutBtn').addEventListener('click', function () {
        sessionStorage.removeItem('loggedIn');
        sessionStorage.removeItem('currentUser');
        location.reload();
    });

    // 左上角用户卡片：点击查看自己的个人资料
    document.getElementById('userProfile').addEventListener('click', function () {
        openProfileModal();
    });

    // 点击留言头像：弹出该留言用户的资料
    document.getElementById('messageList').addEventListener('click', function (e) {
        const avatar = e.target.closest('.message-avatar');
        if (avatar) {
            const username = avatar.getAttribute('data-username');
            if (username) openProfileModal(username);
        }
    });

    // 留言头像图片加载失败：回退为首字母彩色圆
    document.getElementById('messageList').addEventListener('error', function (e) {
        const img = e.target;
        if (img && img.classList.contains('message-avatar-img')) {
            img.style.display = 'none';
            const letter = img.parentNode.querySelector('.message-avatar-letter');
            if (letter) letter.style.display = 'flex';
        }
    }, true);

    // 资料弹窗：关闭按钮
    document.getElementById('profileCloseBtn').addEventListener('click', function () {
        document.getElementById('profileModal').classList.remove('active');
    });

    // 资料弹窗：点击遮罩关闭
    document.getElementById('profileModal').addEventListener('click', function (e) {
        if (e.target === this) this.classList.remove('active');
    });

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

/* 读取 sessionStorage 中新增的留言（会话级缓存，关闭网页即丢失） */
function getLocalMessages() {
    try {
        return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) { return []; }
}

/* 保存新增留言到 sessionStorage（关闭网页后不保留，仅粘贴进 messages.json 才永久保存） */
function saveLocalMessage(msg) {
    const list = getLocalMessages();
    list.unshift(msg);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/* 加载留言：读取 messages.json + 合并本地新增（去重） */
async function loadMessages() {
    let fileMessages = [];
    const parsed = await fetchJsonc('messages.json');
    if (Array.isArray(parsed)) fileMessages = parsed;
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
    const countEl = document.getElementById('messageCount');
    if (countEl) countEl.textContent = allMessages.length + ' 条留言';
    if (allMessages.length === 0) {
        list.innerHTML = '<div class="empty-tip">还没有留言，写点什么吧~</div>';
        return;
    }
    list.innerHTML = allMessages.map(function (msg) {
        const name = (msg.username || '匿名');
        const initial = name.charAt(0).toUpperCase();
        const profile = getProfileFor(name);
        const avatarName = profile ? profile.avatar : '';
        let avatarInner;
        if (avatarName) {
            // 有头像：显示图片，加载失败时回退首字母
            avatarInner = '<img class="message-avatar-img" src="' + escapeHtml(avatarName) + '" alt="头像">' +
                '<span class="message-avatar-letter" style="display:none">' + escapeHtml(initial) + '</span>';
        } else {
            avatarInner = '<span class="message-avatar-letter">' + escapeHtml(initial) + '</span>';
        }
        return '<div class="message-item">' +
            '<div class="message-avatar" data-username="' + escapeHtml(name) + '" title="查看 ' + escapeHtml(name) + ' 的资料">' + avatarInner + '</div>' +
            '<div class="message-body">' +
                '<div class="message-header">' +
                    '<span class="message-username">' + escapeHtml(name) + '</span>' +
                    '<span class="message-time">' + escapeHtml(msg.time || '') + '</span>' +
                '</div>' +
                '<div class="message-content">' + escapeHtml(msg.content || '') + '</div>' +
            '</div>' +
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
