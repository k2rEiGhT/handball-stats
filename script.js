let scoreA = 0;
let scoreB = 0;

// 試合の全ログを管理する配列
let matchLogs = [];

// データ構造：チームごとにコート(4名)とベンチを管理
let roster = {
    A: { court: [], bench: [] },
    B: { court: [], bench: [] }
};

// 選択状態の管理
let activeSelection = {
    A: { court: null, bench: null },
    B: { court: null, bench: null }
};

let customTeamA = "Team A";
let customTeamB = "Team B";

let elapsedSeconds = 0;
let timerInterval = null;
let isRunning = false;
let isEnded = false;

// 4人を超えないよう制御する関数
function limitCheck(checkbox, team) {
    let checkedCount = document.querySelectorAll(`.starter-check-${team}:checked`).length;
    if (checkedCount > 4) {
        checkbox.checked = false;
        alert("コートメンバーは4人までです。");
    }
}

// 初期化：入力欄とチェックボックスの生成
window.onload = function() {
    const setupA = document.getElementById('setupA');
    const setupB = document.getElementById('setupB');
    
    function buildInputs(teamPrefix) {
        let html = `
        <div class="setup-header">
            <div class="setup-header-col">コート</div>
            <div class="setup-header-col">コート</div>
        </div>
        <div class="input-grid">
            <div class="input-col">`;
            
        // 左カラム: 1から8 (1〜8は固定番号)
        for (let i = 1; i <= 8; i++) {
            html += `
            <div class="player-input-row">
                <div class="fixed-num">${i}</div>
                <input type="text" id="name${teamPrefix}_${i}" class="player-name-input" placeholder="名前">
                <label class="starter-label">
                    <input type="checkbox" class="starter-check-${teamPrefix}" value="${i}" onclick="limitCheck(this, '${teamPrefix}')">
                </label>
            </div>`;
        }
        
        html += `</div><div class="input-col">`;
        
        // 右カラム: 9から15 (9, 10は固定番号、11〜15は手入力番号)
        for (let i = 9; i <= 15; i++) {
            let numInputHtml = (i <= 10) 
                ? `<div class="fixed-num">${i}</div>` 
                : `<input type="text" id="num${teamPrefix}_${i}" class="player-num-input" placeholder="No.">`;

            html += `
            <div class="player-input-row">
                ${numInputHtml}
                <input type="text" id="name${teamPrefix}_${i}" class="player-name-input" placeholder="名前">
                <label class="starter-label">
                    <input type="checkbox" class="starter-check-${teamPrefix}" value="${i}" onclick="limitCheck(this, '${teamPrefix}')">
                </label>
            </div>`;
        }
        
        html += `</div></div>`;
        return html;
    }

    setupA.innerHTML = buildInputs('A');
    setupB.innerHTML = buildInputs('B');
}

// 選手リストの読み込み
function updateRoster() {
    customTeamA = document.getElementById('teamNameA').value.trim() || "Team A";
    customTeamB = document.getElementById('teamNameB').value.trim() || "Team B";

    document.getElementById('displayTeamNameA').innerText = customTeamA;
    document.getElementById('displayTeamNameB').innerText = customTeamB;
    
    // テーブルのヘッダーもチーム名に更新
    document.getElementById('thScoreA').innerText = customTeamA + " 得点";
    document.getElementById('thScoreB').innerText = customTeamB + " 得点";

    roster.A.court = []; roster.A.bench = [];
    roster.B.court = []; roster.B.bench = [];
    activeSelection = { A: { court: null, bench: null }, B: { court: null, bench: null } };

    // Team A の振り分けと表示名作成
    for (let i = 1; i <= 15; i++) {
        let nameInput = document.getElementById(`nameA_${i}`).value.trim();
        let isCourt = document.querySelector(`.starter-check-A[value="${i}"]`).checked;
        if (nameInput) {
            let numVal = (i <= 10) ? String(i) : document.getElementById(`numA_${i}`).value.trim();
            let displayName = numVal ? `${numVal}. ${nameInput}` : nameInput;
            
            let p = { id: `A_${i}`, name: displayName };
            if (isCourt) roster.A.court.push(p);
            else roster.A.bench.push(p);
        }
    }

    // Team B の振り分けと表示名作成
    for (let i = 1; i <= 15; i++) {
        let nameInput = document.getElementById(`nameB_${i}`).value.trim();
        let isCourt = document.querySelector(`.starter-check-B[value="${i}"]`).checked;
        if (nameInput) {
            let numVal = (i <= 10) ? String(i) : document.getElementById(`numB_${i}`).value.trim();
            let displayName = numVal ? `${numVal}. ${nameInput}` : nameInput;
            
            let p = { id: `B_${i}`, name: displayName };
            if (isCourt) roster.B.court.push(p);
            else roster.B.bench.push(p);
        }
    }

    renderButtons();
    renderLogs();
    document.querySelector('.setup-section').removeAttribute('open');
}

// 選手ボタンの描画
function renderButtons() {
    function generateHtml(team, type) {
        return roster[team][type].map(p => {
            const isSelected = activeSelection[team][type] === p.id ? 'selected' : '';
            return `<button class="player-btn ${isSelected}" onclick="selectPlayer('${team}', '${type}', '${p.id}', '${p.name}')">${p.name}</button>`;
        }).join('');
    }

    document.getElementById('teamA-court-buttons').innerHTML = generateHtml('A', 'court') || '<p class="placeholder-text">なし</p>';
    document.getElementById('teamA-bench-buttons').innerHTML = generateHtml('A', 'bench') || '<p class="placeholder-text">なし</p>';
    document.getElementById('teamB-court-buttons').innerHTML = generateHtml('B', 'court') || '<p class="placeholder-text">なし</p>';
    document.getElementById('teamB-bench-buttons').innerHTML = generateHtml('B', 'bench') || '<p class="placeholder-text">なし</p>';
}

// 選手の選択
function selectPlayer(team, type, id, name) {
    const otherTeam = team === 'A' ? 'B' : 'A';
    activeSelection[otherTeam].court = null;
    activeSelection[otherTeam].bench = null;

    if (activeSelection[team][type] === id) {
        activeSelection[team][type] = null;
    } else {
        activeSelection[team][type] = id;
    }

    renderButtons();

    // アシスト選択プルダウンの更新
    const assistSelect = document.getElementById('assistSelect');
    assistSelect.innerHTML = '<option value="">-- なし --</option>';
    
    const gkSelect = document.getElementById('gkSelect');
    gkSelect.innerHTML = '<option value="">-- なし --</option>';
    
    const targetPlayerName = activeSelection[team].court ? 
        roster[team].court.find(p => p.id === activeSelection[team].court).name : 
        activeSelection[team].bench ? roster[team].bench.find(p => p.id === activeSelection[team].bench).name : null;

    if (targetPlayerName) {
        // 自チームの他の選手をアシストにリストアップ
        let allPlayers = [...roster[team].court, ...roster[team].bench];
        allPlayers.forEach(p => {
            if (p.name !== targetPlayerName) {
                assistSelect.innerHTML += `<option value="${p.name}">${p.name}</option>`;
            }
        });

        // 相手チームの選手をGK候補にリストアップ
        let opponentPlayers = [...roster[otherTeam].court, ...roster[otherTeam].bench];
        opponentPlayers.forEach(p => {
            gkSelect.innerHTML += `<option value="${p.name}">${p.name}</option>`;
        });
    }
}

// ================= タイマー機能 =================
function formatTime(totalSeconds) {
    let m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    let s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}
function startTimer() {
    if (isEnded) return;
    if (!isRunning) {
        timerInterval = setInterval(() => {
            elapsedSeconds++;
            document.getElementById('timer').innerText = formatTime(elapsedSeconds);
        }, 1000);
        isRunning = true;
        document.getElementById('btnStart').disabled = true;
        document.getElementById('btnStop').disabled = false;
    }
}
function stopTimer() {
    if (isRunning) {
        clearInterval(timerInterval);
        isRunning = false;
        document.getElementById('btnStart').disabled = false;
        document.getElementById('btnStop').disabled = true;
    }
}
function endTimer() {
    stopTimer();
    isEnded = true;
    document.getElementById('btnStart').disabled = true;
    document.getElementById('btnStop').disabled = true;
    document.getElementById('btnEnd').disabled = true;
    alert("試合終了！\n記録をPDFで保存してください。");
}

function getRecordTime(actionName, isSub = false) {
    const manualTimeInput = document.getElementById('manualTime');
    if (manualTimeInput.value.trim() !== '') {
        return manualTimeInput.value.trim();
    }
    // アラートを回避するアクションに パスミス, パスカット, キャッチミス を追加
    const noAlertActions = ['警告', '退場(次ターンオーバー迄)', '失格', 'ダブルドリブル', 'キックボール', '3sec', 'ラインクロス', 'ターンオーバー', 'リバウンド', 'チャージング', 'シュートミス', 'パスミス', 'パスカット', 'キャッチミス'];
    if (!isRunning && (!isSub && !noAlertActions.includes(actionName))) {
        if (!confirm('タイマーが停止中または開始前ですが、現在の表示時間で記録しますか？')) {
            return null;
        }
    }
    return formatTime(elapsedSeconds);
}

// ================= ログの記録・描画 =================
function addLog(time, teamCode, playerName, actionText, points) {
    matchLogs.unshift({
        id: Date.now() + Math.random(),
        time: time,
        team: teamCode,
        player: playerName,
        action: actionText,
        points: points
    });
    
    renderLogs();
}

function renderLogs() {
    let currentScoreA = 0;
    let currentScoreB = 0;
    
    for (let i = matchLogs.length - 1; i >= 0; i--) {
        let log = matchLogs[i];
        if (log.points > 0) {
            if (log.team === 'A') currentScoreA += log.points;
            if (log.team === 'B') currentScoreB += log.points;
        }
        log.cumScoreA = currentScoreA;
        log.cumScoreB = currentScoreB;
    }

    scoreA = currentScoreA;
    scoreB = currentScoreB;
    document.getElementById('scoreA').innerText = scoreA;
    document.getElementById('scoreB').innerText = scoreB;

    let tableHTML = '';
    for (let i = 0; i < matchLogs.length; i++) {
        let log = matchLogs[i];
        let displayTeam = log.team === 'A' ? customTeamA : (log.team === 'B' ? customTeamB : '-');
        tableHTML += `
            <tr>
                <td>${log.time}</td>
                <td>${displayTeam}</td>
                <td>${log.player}</td>
                <td>${log.action}</td>
                <td class="score-col">${log.cumScoreA}</td>
                <td class="score-col">${log.cumScoreB}</td>
                <td class="noprint">
                    <button class="delete-btn" onclick="deleteLog(${log.id})">削除</button>
                </td>
            </tr>
        `;
    }
    document.getElementById('logTableBody').innerHTML = tableHTML;
}

// ログの削除（再計算）
function deleteLog(id) {
    if (!confirm('この記録を削除しますか？\n※以降の累計得点も自動的に修正されます。')) return;
    
    matchLogs = matchLogs.filter(log => log.id !== id);
    renderLogs();
}

// ================= アクションの記録 =================
function recordAction(actionName, points) {
    let team = activeSelection.A.court || activeSelection.A.bench ? 'A' : 
               activeSelection.B.court || activeSelection.B.bench ? 'B' : null;

    if (!team) {
        alert('先に左右のチームから選手を選択してください！');
        return;
    }

    let targetId = activeSelection[team].court || activeSelection[team].bench;
    let isCourt = !!activeSelection[team].court;
    let targetList = isCourt ? roster[team].court : roster[team].bench;
    let targetPlayer = targetList.find(p => p.id === targetId).name;

    const recordTime = getRecordTime(actionName, false);
    if (recordTime === null) return;

    // アシストと相手GKの情報を取得
    let assistText = "";
    const assistSelect = document.getElementById('assistSelect');
    if (points > 0 && assistSelect.value !== "") {
        assistText = `<br><small>Ast: ${assistSelect.value}</small>`;
    }
    
    let gkText = "";
    const gkSelect = document.getElementById('gkSelect');
    if (gkSelect.value !== "") {
        gkText = `<br><small>GK: ${gkSelect.value}</small>`;
    }

    addLog(recordTime, team, targetPlayer, `${actionName}${assistText}${gkText}`, points);

    activeSelection[team].court = null;
    activeSelection[team].bench = null;
    document.getElementById('manualTime').value = '';
    assistSelect.innerHTML = '<option value="">-- なし --</option>';
    gkSelect.innerHTML = '<option value="">-- なし --</option>';
    renderButtons();
}

// ================= 交代の記録と処理 =================
function recordSubstitution() {
    let team = (activeSelection.A.court && activeSelection.A.bench) ? 'A' : 
               (activeSelection.B.court && activeSelection.B.bench) ? 'B' : null;

    if (!team) {
        alert("交代するチームの「コート上の選手」と「ベンチの選手」を両方（1名ずつ）選択してから押してください。");
        return;
    }

    const recordTime = getRecordTime("交代", true);
    if (recordTime === null) return;

    let cId = activeSelection[team].court;
    let bId = activeSelection[team].bench;

    let cIndex = roster[team].court.findIndex(p => p.id === cId);
    let bIndex = roster[team].bench.findIndex(p => p.id === bId);

    let cPlayer = roster[team].court[cIndex];
    let bPlayer = roster[team].bench[bIndex];

    addLog(recordTime, team, "-", `交代 (OUT: ${cPlayer.name} / IN: ${bPlayer.name})`, 0);

    roster[team].court[cIndex] = bPlayer;
    roster[team].bench[bIndex] = cPlayer;

    activeSelection[team].court = null;
    activeSelection[team].bench = null;
    document.getElementById('manualTime').value = '';
    document.getElementById('assistSelect').innerHTML = '<option value="">-- なし --</option>';
    
    renderButtons();
}