// ================= 設定・定数 (Config) =================
const CONFIG = {
  MAX_PLAYERS_TOTAL: 16, // ベンチ入り最大人数
  MAX_PLAYERS_COURT: 6   // コート上の最大人数
};

// ================= 状態管理 (State) =================
let scoreA = 0;
let scoreB = 0;
let matchLogs = [];

let roster = {
  A: { court: [], bench: [], gkId: null },
  B: { court: [], bench: [], gkId: null }
};

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
let currentPeriod = 1;

let allTeamData = []; 
let myTeamData = { name: "未設定", players: [] };

const API_URL = "https://script.google.com/macros/s/AKfycbzU3AOoiPm-XiY8Zf1DU58VK6ylfKudFO_ReJ9hJtCnD7vEVmIn1r5jNFIVxLAQQgUQ/exec";

// ================= 初期化・セットアップ (Initialization) =================
window.onload = async function() {
  const setupA = document.getElementById('setupA');
  const setupB = document.getElementById('setupB');
  
  // 入力欄の構築
  setupA.innerHTML = buildInputs('A');
  setupB.innerHTML = buildInputs('B');

  setupTimerEdit();
  
  // PDFタイトル用のイベントリスナー設定
  document.querySelector('.match-info-title').addEventListener('input', updateDocumentTitle);

  // スプレッドシートからデータを取得
  try {
    const response = await fetch(API_URL);
    allTeamData = await response.json();
    generateTeamButtons();
  } catch (error) {
    console.error("データの読み込みに失敗しました", error);
    document.getElementById('opponentButtons').innerHTML = `<p style="color:red; font-weight:bold;">エラー: ${error.message}</p>`;
  }
};

function buildInputs(teamPrefix) {
  let html = `
  <div class="setup-header">
    <div class="setup-header-col">コート/除外</div>
    <div class="setup-header-col">コート/除外</div>
  </div>
  <div class="input-grid">
    <div class="input-col">`;
  
  // ★ 16ではなく定数を使用
  for (let i = 1; i <= CONFIG.MAX_PLAYERS_TOTAL; i++) {
    if (i === 9) html += `</div><div class="input-col">`;
    html += `
    <div class="player-input-row">
      <input type="text" id="num${teamPrefix}_${i}" class="player-num-input" placeholder="No." oninput="updateGkDropdown('${teamPrefix}')">
      <input type="text" id="name${teamPrefix}_${i}" class="player-name-input" placeholder="名前" oninput="updateGkDropdown('${teamPrefix}')">
      <label class="starter-label" title="コート">
        <input type="checkbox" class="starter-check-${teamPrefix}" value="${i}" onclick="limitCheckAndGkUpdate(this, '${teamPrefix}')">
      </label>
      <label class="exclude-label" title="除外">
        <input type="checkbox" class="exclude-check-${teamPrefix}" value="${i}" onclick="handleExcludeCheck(this, '${teamPrefix}')">
      </label>
    </div>`;
  }
  html += `</div></div>`;
  return html;
}

function setupTimerEdit() {
  const timerElement = document.getElementById('timer');
  if (!timerElement) return;

  timerElement.title = "クリックして時間を直接修正";
  timerElement.style.cursor = "pointer";
  
  timerElement.addEventListener('click', function() {
    if (isEnded) return;
    if (isRunning) stopTimer(); 
    this.contentEditable = true; 
    this.focus();
    const range = document.createRange();
    range.selectNodeContents(this);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  
  timerElement.addEventListener('keydown', function(e) {
    if (e.isComposing) return; 
    if (e.key === 'Enter') {
      e.preventDefault();
      this.blur(); 
    }
  });
  
  timerElement.addEventListener('blur', function() {
    this.contentEditable = false; 
    let inputTime = this.innerText.trim();
    inputTime = inputTime.replace(/[０-９：]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    let parts = inputTime.split(':');
    
    if (parts.length === 2) {
      let m = parseInt(parts[0], 10);
      let s = parseInt(parts[1], 10);
      if (!isNaN(m) && !isNaN(s) && m >= 0 && s >= 0 && s < 60) {
        elapsedSeconds = m * 60 + s;
      } else {
        alert("正しい形式（例: 05:30）で入力してください。秒数は0〜59である必要があります。");
      }
    } else {
      alert("正しい形式（例: 05:30）で入力してください。");
    }
    this.innerText = formatTime(elapsedSeconds);
  });
}

function generateTeamButtons() {
  const container = document.getElementById('opponentButtons');
  container.innerHTML = ''; 
  
  allTeamData.forEach((team, index) => {
    if (index === 0) {
      myTeamData = team;
      let teamBtn = document.querySelector('.load-team-btn');
      if (teamBtn) teamBtn.textContent = team.name;
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'load-opponent-btn';
      btn.textContent = team.name.length > 6 ? team.name.substring(0, 5) + '…' : team.name; 
      btn.onclick = () => loadOpponentTeam(index);
      container.appendChild(btn);
    }
  });
}

// ================= データ読み込み・UIヘルパー =================
function applyTeamDataToInputs(team, teamData) {
  document.getElementById(`teamName${team}`).value = teamData.name;
  
  for (let i = 1; i <= CONFIG.MAX_PLAYERS_TOTAL; i++) {
    document.getElementById(`num${team}_${i}`).value = '';
    document.getElementById(`name${team}_${i}`).value = '';
    document.querySelector(`.starter-check-${team}[value="${i}"]`).checked = false;
    let excludeCheck = document.querySelector(`.exclude-check-${team}[value="${i}"]`);
    if (excludeCheck) excludeCheck.checked = false;
  }

  teamData.players.forEach((p, idx) => {
    let i = idx + 1;
    if (i > CONFIG.MAX_PLAYERS_TOTAL) return;
    document.getElementById(`num${team}_${i}`).value = p.num;
    document.getElementById(`name${team}_${i}`).value = p.name;
    document.querySelector(`.starter-check-${team}[value="${i}"]`).checked = !!p.isStarter;
    if (p.isExcluded !== undefined) {
      let excludeCheck = document.querySelector(`.exclude-check-${team}[value="${i}"]`);
      if (excludeCheck) excludeCheck.checked = p.isExcluded;
    }
  });
  updateGkDropdown(team);
}

function loadMyTeam() {
  applyTeamDataToInputs('A', myTeamData);
}

function loadOpponentTeam(index) {
  applyTeamDataToInputs('B', allTeamData[index]);
}

function limitCheckAndGkUpdate(checkbox, team) {
  let index = checkbox.value;
  if (checkbox.checked) {
    let excludeCheck = document.querySelector(`.exclude-check-${team}[value="${index}"]`);
    if (excludeCheck) excludeCheck.checked = false;
  }
  let checkedCount = document.querySelectorAll(`.starter-check-${team}:checked`).length;
  // ★ 6ではなく定数を使用
  if (checkedCount > CONFIG.MAX_PLAYERS_COURT) {
    checkbox.checked = false;
    alert(`コートメンバーは${CONFIG.MAX_PLAYERS_COURT}人までです。`);
    return;
  }
  updateGkDropdown(team);
}

function handleExcludeCheck(checkbox, team) {
  let index = checkbox.value;
  if (checkbox.checked) {
    let courtCheck = document.querySelector(`.starter-check-${team}[value="${index}"]`);
    if (courtCheck && courtCheck.checked) {
      courtCheck.checked = false;
      updateGkDropdown(team);
    }
  }
}

function updateGkDropdown(team) {
  const gkSelect = document.getElementById(`gkSelect${team}`);
  const checkedCheckboxes = document.querySelectorAll(`.starter-check-${team}:checked`);
  
  if (checkedCheckboxes.length === 0) {
    gkSelect.innerHTML = '<option value="">選択してください</option>';
    return;
  }

  let html = '<option value="">選択してください</option>';
  checkedCheckboxes.forEach(cb => {
    let index = cb.value;
    let nameVal = document.getElementById(`name${team}_${index}`).value.trim() || "-";
    let numVal = document.getElementById(`num${team}_${index}`).value.trim() || index;
    html += `<option value="${team}_${index}">${numVal}. ${nameVal}</option>`;
  });
  gkSelect.innerHTML = html;
}

// ================= キーボード操作 =================
document.addEventListener('keydown', function(e) {
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
    const active = document.activeElement;
    const match = active.id ? active.id.match(/^(num|name)(A|B)_(\d+)$/) : null;
    if (match) {
      if (e.isComposing) return;
      e.preventDefault(); 
      
      const type = match[1];
      const team = match[2];
      let idx = parseInt(match[3], 10);
      
      if (e.key === 'ArrowDown' || e.key === 'Enter') idx++;
      else if (e.key === 'ArrowUp') idx--;
      
      if (idx >= 1 && idx <= CONFIG.MAX_PLAYERS_TOTAL) {
        const nextInput = document.getElementById(`${type}${team}_${idx}`);
        if (nextInput) {
          nextInput.focus();
          nextInput.select(); 
        }
      }
    }
  }
});

// ================= ロスター（選手登録）処理 =================
function updateRoster() {
  customTeamA = document.getElementById('teamNameA').value.trim() || "Team A";
  customTeamB = document.getElementById('teamNameB').value.trim() || "Team B";

  const matchUpDisplay = document.getElementById('matchUpDisplay');
  if (matchUpDisplay) {
    matchUpDisplay.innerHTML = `
      <div class="match-row">
        <div class="align-left">${customTeamA}</div>
        <div class="align-center">vs.</div>
        <div class="align-right">${customTeamB}</div>
      </div>
    `;
  }

  const gkValA = document.getElementById('gkSelectA').value;
  const gkValB = document.getElementById('gkSelectB').value;

  if (!gkValA || !gkValB) {
    alert("両チームとも、コート上から1名ゴールキーパー(GK)を指定してください。");
    return;
  }

  document.getElementById('displayTeamNameA').innerText = customTeamA;
  document.getElementById('displayTeamNameB').innerText = customTeamB;
  
  const btnToA = document.getElementById('btnTimeoutA');
  const btnToB = document.getElementById('btnTimeoutB');
  if (btnToA) btnToA.innerText = customTeamA + ' T.O.';
  if (btnToB) btnToB.innerText = customTeamB + ' T.O.';

  document.getElementById('thPlayerA').innerText = customTeamA;
  document.getElementById('thPlayerB').innerText = customTeamB;

  processTeamRoster('A', gkValA);
  processTeamRoster('B', gkValB);

  activeSelection = { A: { court: null, bench: null }, B: { court: null, bench: null } };

  // 登録時にタイトルを更新（イベント駆動）
  updateDocumentTitle();

  renderButtons();
  renderLogs();
  
  document.getElementById('statsContainer').style.display = 'block';
  renderStats();
  document.querySelector('.setup-section').removeAttribute('open');
}

// 登録処理の共通化
function processTeamRoster(team, gkVal) {
  roster[team].court = [];
  roster[team].bench = [];
  roster[team].gkId = gkVal;

  for (let i = 1; i <= CONFIG.MAX_PLAYERS_TOTAL; i++) {
    let nameElem = document.getElementById(`name${team}_${i}`);
    let nameInput = nameElem.value.trim();
    let numVal = document.getElementById(`num${team}_${i}`).value.trim();
    let isCourt = document.querySelector(`.starter-check-${team}[value="${i}"]`).checked;
    let isExcluded = document.querySelector(`.exclude-check-${team}[value="${i}"]`).checked;
    
    if (!nameInput && (numVal !== "" || isCourt)) {
      nameInput = "-";
      nameElem.value = "-";
    }

    if (nameInput && !isExcluded) {
      let displayName = numVal ? `${numVal}. ${nameInput}` : nameInput;
      let numInt = parseInt(numVal, 10);
      if (isNaN(numInt)) numInt = 9999;

      let p = { id: `${team}_${i}`, name: displayName, num: numInt };
      if (isCourt) roster[team].court.push(p);
      else roster[team].bench.push(p);
    }
  }
  roster[team].court.sort((a, b) => a.num - b.num);
  roster[team].bench.sort((a, b) => a.num - b.num);
}

function swapTeams() {
  let tempTeamName = document.getElementById('teamNameA').value;
  document.getElementById('teamNameA').value = document.getElementById('teamNameB').value;
  document.getElementById('teamNameB').value = tempTeamName;

  for (let i = 1; i <= CONFIG.MAX_PLAYERS_TOTAL; i++) {
    let fields = ['num', 'name'];
    let checks = ['starter-check-', 'exclude-check-'];
    
    // 入力欄の入れ替え
    fields.forEach(f => {
      let a = document.getElementById(`${f}A_${i}`);
      let b = document.getElementById(`${f}B_${i}`);
      let temp = a.value;
      a.value = b.value;
      b.value = temp;
    });

    // チェックボックスの入れ替え
    checks.forEach(c => {
      let a = document.querySelector(`.${c}A[value="${i}"]`);
      let b = document.querySelector(`.${c}B[value="${i}"]`);
      if (a && b) {
        let temp = a.checked;
        a.checked = b.checked;
        b.checked = temp;
      }
    });
  }
  updateGkDropdown('A');
  updateGkDropdown('B');
}

// ================= UIレンダリング (画面更新) =================
function renderButtons() {
  const generateHtml = (team, type) => {
    return roster[team][type].map(p => {
      const isSelected = activeSelection[team][type] === p.id ? 'selected' : '';
      const isGk = roster[team].gkId === p.id ? ' <span class="gk-label">[GK]</span>' : '';
      const formattedName = p.name.replace(/^(\d+)\.\s*/, '<span class="player-num-display">$1.</span> ');
      return `<button class="player-btn ${isSelected}" onclick="selectPlayer('${team}', '${type}', '${p.id}', '${p.name}')">${formattedName}${isGk}</button>`;
    }).join('');
  };

  ['A', 'B'].forEach(team => {
    document.getElementById(`team${team}-court-buttons`).innerHTML = generateHtml(team, 'court') || '<p class="placeholder-text">なし</p>';
    document.getElementById(`team${team}-bench-buttons`).innerHTML = generateHtml(team, 'bench') || '<p class="placeholder-text">なし</p>';
  });
}

function selectPlayer(team, type, id, name) {
  const otherTeam = team === 'A' ? 'B' : 'A';
  activeSelection[otherTeam].court = null;
  activeSelection[otherTeam].bench = null;

  activeSelection[team][type] = (activeSelection[team][type] === id) ? null : id;
  renderButtons();

  const assistSelect = document.getElementById('assistSelect');
  assistSelect.innerHTML = '<option value="">-- なし --</option>';
  
  const targetId = activeSelection[team].court || activeSelection[team].bench;
  const targetPlayer = targetId ? [...roster[team].court, ...roster[team].bench].find(p => p.id === targetId) : null;

  if (targetPlayer) {
    roster[team].court.forEach(p => {
      if (p.name !== targetPlayer.name) {
        assistSelect.innerHTML += `<option value="${p.name}">${p.name}</option>`;
      }
    });
  }
}

// ================= タイマー管理 =================
function formatTime(totalSeconds) {
  let m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  let s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function startTimer() {
  if (isEnded || isRunning) return;
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    document.getElementById('timer').innerText = formatTime(elapsedSeconds);
  }, 1000);
  isRunning = true;
  document.getElementById('btnStart').disabled = true;
  document.getElementById('btnStop').disabled = false;
}

function stopTimer() {
  if (!isRunning) return;
  clearInterval(timerInterval);
  isRunning = false;
  document.getElementById('btnStart').disabled = false;
  document.getElementById('btnStop').disabled = true;
}

function halfTime() {
  if (!confirm("前半を終了し、タイマーをリセットして後半に移りますか？")) return;
  stopTimer(); 
  addLog(formatTime(elapsedSeconds), 'System', "", "前半終了／後半開始", 0);
  elapsedSeconds = 0;
  currentPeriod = 2; 
  document.getElementById('timer').innerText = formatTime(elapsedSeconds);
}

function endTimer() {
  stopTimer();
  isEnded = true;
}

function getRecordTime(actionName, isSub = false) {
  const manualTimeInput = document.getElementById('manualTime');
  if (manualTimeInput.value.trim() !== '') return manualTimeInput.value.trim();
  
  const noAlertActions = []; 
  if (!isRunning && !isSub && !noAlertActions.includes(actionName)) {
    if (!confirm('タイマーが停止中または開始前ですが、現在の表示時間で記録しますか？')) return null;
  }
  return formatTime(elapsedSeconds);
}

// ================= アクション記録・ログ管理 =================
function addLog(time, teamCode, playerName, actionText, points, playerId = null) {
  let parts = time.split(':');
  let timeSec = parts.length === 2 ? parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) : 0;
  let logPeriod = currentPeriod;
  
  if (logPeriod === 2 && timeSec > elapsedSeconds + 120) logPeriod = 1;

  matchLogs.push({
    id: Date.now() + Math.random(),
    time, timeSec, period: logPeriod,
    team: teamCode, playerId, player: playerName,
    action: actionText, points,
    gkIdA: roster.A.gkId, gkIdB: roster.B.gkId,
    bookmarked: false
  });

  matchLogs.sort((a, b) => {
    if (a.period !== b.period) return b.period - a.period;
    if (b.timeSec !== a.timeSec) return b.timeSec - a.timeSec;
    return b.id - a.id;
  });

  renderLogs();
  renderStats(); 
}

function renderLogs() {
  let currentScoreA = 0, currentScoreB = 0;
  let firstHalfA = 0, firstHalfB = 0;
  let isFirstHalf = true;
  
  for (let i = matchLogs.length - 1; i >= 0; i--) {
    let log = matchLogs[i];
    if (log.team === 'System' && log.action === '前半終了／後半開始') {
      isFirstHalf = false;
      firstHalfA = currentScoreA;
      firstHalfB = currentScoreB;
    }

    let scoreChangedA = false, scoreChangedB = false;
    if (log.points > 0) {
      if (log.team === 'A') { currentScoreA += log.points; scoreChangedA = true; }
      if (log.team === 'B') { currentScoreB += log.points; scoreChangedB = true; }
    }
    
    log.displayScoreA = scoreChangedA ? currentScoreA : '-';
    log.displayScoreB = scoreChangedB ? currentScoreB : '-';
  }

  if (isFirstHalf) { firstHalfA = currentScoreA; firstHalfB = currentScoreB; }
  
  scoreA = currentScoreA; scoreB = currentScoreB;
  document.getElementById('scoreA').innerText = scoreA;
  document.getElementById('scoreB').innerText = scoreB;

  const headerScoreDisplay = document.getElementById('headerScoreDisplay');
  if (headerScoreDisplay) {
    headerScoreDisplay.innerHTML = `
      <div class="match-row header-score-text">
        <div class="align-left">${scoreA}</div>
        <div class="align-center">-</div>
        <div class="align-right">${scoreB}</div>
      </div>
      <div class="match-row header-score-sub">
        <div class="align-left">${firstHalfA}</div>
        <div class="align-center">-</div>
        <div class="align-right">${firstHalfB}</div>
      </div>
    `;
  }

  const bookmarkSvg = `<svg class="bm-icon" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;
  const trashSvg = `<svg class="trash-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

  let tableHTML = matchLogs.map(log => {
    let aPlayer = log.team === 'A' ? log.player : '';
    let aAction = log.team === 'A' || log.team === 'System' ? log.action : '';
    let bPlayer = log.team === 'B' ? log.player : '';
    let bAction = log.team === 'B' || log.team === 'System' ? log.action : '';

    let bgA = log.bookmarked && (log.team === 'A' || log.team === 'System') ? 'background-color: #fff9e6;' : '';
    let bgB = log.bookmarked && (log.team === 'B' || log.team === 'System') ? 'background-color: #fff9e6;' : '';

    return `
    <tr>
      <td style="${bgA}">${aPlayer}</td>
      <td style="${bgA}">${aAction}</td>
      <td class="score-col">${log.displayScoreA}</td>
      <td style="font-weight: bold; background: #f8f9fa;">${log.time}</td>
      <td class="score-col">${log.displayScoreB}</td>
      <td style="${bgB}">${bAction}</td>
      <td style="${bgB}">${bPlayer}</td>
      <td class="noprint" style="display: flex; gap: 4px; justify-content: center; align-items: center; background: transparent;">
        <button class="toggle-bm-btn ${log.bookmarked ? 'active' : ''}" onclick="toggleBookmark(${log.id})">${bookmarkSvg}</button>
        ${log.team === 'System' ? '' : `<button class="delete-btn" onclick="deleteLog(${log.id})">${trashSvg}</button>`}
      </td>
    </tr>`;
  }).join('');
  
  document.getElementById('logTableBody').innerHTML = tableHTML;
  
  const latestLogText = document.getElementById('latestLogText');
  if (latestLogText) {
    if (matchLogs.length > 0) {
      let latest = matchLogs[0];
      let bmBtn = `<button class="latest-bm-btn ${latest.bookmarked ? 'active' : ''}" onclick="toggleBookmark(${latest.id})">${bookmarkSvg}</button>`;
      let playerStr = latest.player && latest.player !== "-" ? ` ${latest.player}` : "";
      
      latestLogText.innerHTML = latest.team === 'System' 
        ? `${bmBtn} <span style="vertical-align:middle;">${latest.time} ｜ ${latest.action}</span>`
        : `${bmBtn} <span style="vertical-align:middle;">${latest.time}   ${playerStr}</span> <span class="latest-log-action" style="vertical-align:middle;">  ${latest.action}</span>`;
    } else {
      latestLogText.innerText = "最新のログなし";
    }
  }
}

function deleteLog(id) {
  if (!confirm('この記録を削除しますか？\n※以降の累計得点も自動的に修正されます。')) return;
  matchLogs = matchLogs.filter(log => log.id !== id);
  renderLogs();
  renderStats(); 
}

function toggleBookmark(id) {
  let log = matchLogs.find(l => l.id === id);
  if (log) {
    log.bookmarked = !log.bookmarked;
    renderLogs(); 
  }
}

// ================= アクションの登録 =================
function getSelectedTeam() {
  return (activeSelection.A.court || activeSelection.A.bench) ? 'A' : 
         (activeSelection.B.court || activeSelection.B.bench) ? 'B' : null;
}

function recordAction(actionName, points) {
  let team = getSelectedTeam();
  if (!team) return alert('先に左右のチームから選手を選択してください！');

  let targetId = activeSelection[team].court || activeSelection[team].bench;
  let targetList = activeSelection[team].court ? roster[team].court : roster[team].bench;
  let targetPlayer = targetList.find(p => p.id === targetId).name;

  const recordTime = getRecordTime(actionName, false);
  if (recordTime === null) return;

  let assistText = "";
  const assistSelect = document.getElementById('assistSelect');
  if (points > 0 && assistSelect.value !== "") {
    assistText = `<br><small>Ast: ${assistSelect.value}</small>`;
  }

  const isGk = (roster[team].gkId === targetId) ? " [GK]" : "";
  addLog(recordTime, team, targetPlayer + isGk, `${actionName}${assistText}`, points, targetId);

  activeSelection[team].court = activeSelection[team].bench = null;
  document.getElementById('manualTime').value = '';
  assistSelect.innerHTML = '<option value="">-- なし --</option>';
  renderButtons();
}

function recordSubstitution() {
  let team = (activeSelection.A.court && activeSelection.A.bench) ? 'A' : 
             (activeSelection.B.court && activeSelection.B.bench) ? 'B' : null;

  if (!team) return alert("交代するチームの「コート上の選手」と「ベンチの選手」を両方（1名ずつ）選択してから押してください。");

  const recordTime = getRecordTime("交代", true);
  if (recordTime === null) return;

  let cId = activeSelection[team].court, bId = activeSelection[team].bench;
  let cIndex = roster[team].court.findIndex(p => p.id === cId);
  let bIndex = roster[team].bench.findIndex(p => p.id === bId);
  let cPlayer = roster[team].court[cIndex], bPlayer = roster[team].bench[bIndex];

  let outLabel = (roster[team].gkId === cId) ? `${cPlayer.name}(GK)` : cPlayer.name;
  let inLabel = (roster[team].gkId === cId) ? `${bPlayer.name}(GK)` : bPlayer.name;

  addLog(recordTime, team, "-", `OUT: ${outLabel}\nIN: ${inLabel}`, 0);

  if (roster[team].gkId === cId) roster[team].gkId = bId;

  roster[team].court[cIndex] = bPlayer;
  roster[team].bench[bIndex] = cPlayer;
  roster[team].court.sort((a, b) => a.num - b.num);
  roster[team].bench.sort((a, b) => a.num - b.num);

  activeSelection[team].court = activeSelection[team].bench = null;
  document.getElementById('manualTime').value = '';
  document.getElementById('assistSelect').innerHTML = '<option value="">-- なし --</option>';
  renderButtons();
}

function toggleGkRole() {
  let team = activeSelection.A.court ? 'A' : activeSelection.B.court ? 'B' : null;
  if (!team) return alert("コート上の選手から、新しくGKにする選手を1名選択してから押してください。");

  let targetId = activeSelection[team].court;
  if (roster[team].gkId === targetId) return alert("選択された選手は既にGKです。");

  const recordTime = getRecordTime("GK交代", true);
  if (recordTime === null) return;

  let oldGk = roster[team].court.find(p => p.id === roster[team].gkId);
  let newGk = roster[team].court.find(p => p.id === targetId);

  addLog(recordTime, team, "-", `GK変更 (前: ${oldGk ? oldGk.name : "なし"} → 新: ${newGk.name})`, 0);
  roster[team].gkId = targetId;

  activeSelection[team].court = activeSelection[team].bench = null;
  document.getElementById('manualTime').value = '';
  renderButtons();
}

function recordTimeout(team) {
  const recordTime = getRecordTime("タイムアウト", true);
  if (recordTime === null) return;
  stopTimer();
  addLog(recordTime, team, "-", "タイムアウト", 0);
  
  activeSelection.A.court = activeSelection.A.bench = null;
  activeSelection.B.court = activeSelection.B.bench = null;
  document.getElementById('manualTime').value = '';
  renderButtons();
}

// ================= シュートチャート (Modal) =================
let pendingActionName = "";
let pendingActionPoints = 0;

function openCourtPopup(actionName, points) {
  if (!getSelectedTeam()) return alert('先に左右のチームから選手を選択してください！');
  pendingActionName = actionName;
  pendingActionPoints = points;
  document.getElementById('courtModal').style.display = 'flex';
  
  // ★ モーダル展開時に背景のスクロールを止める
  document.body.classList.add('modal-open');
}

function closeCourtPopup() {
  document.getElementById('courtModal').style.display = 'none';
  
  // ★ モーダルを閉じたら背景のスクロールを復旧
  document.body.classList.remove('modal-open');
}

function recordShotWithZone(zoneName) {
  closeCourtPopup();
  recordAction(`${pendingActionName} [${zoneName}]`, pendingActionPoints);
}

// ================= 統計 (Stats & Charts) =================
function renderStats() {
  let stats = { A: {}, B: {} };
  
  const initStats = (team) => {
    [...roster[team].court, ...roster[team].bench].forEach(p => {
      stats[team][p.id] = { 
        name: p.name, num: p.num, goals: 0, sevenM_goals: 0, misses: 0, sevenM_misses: 0, 
        saves: 0, sevenM_saves: 0, conceded: 0, sevenM_conceded: 0, ofMisses: 0, ofFouls: 0,  
        dfFouls: 0, steals: 0, blocks: 0, warnings: 0, suspensions: 0, disqualifications: 0,
        assists: 0, gk_out: 0, sevenM_gk_out: 0
      };
    });
  };
  
  if (roster.A.court.length > 0 || roster.A.bench.length > 0) {
    initStats('A');
    initStats('B');
  } else return;

  matchLogs.forEach(log => {
    if (!log.playerId) return; 
    
    let isGoal = log.action.startsWith('得点');
    let is7mGoal = log.action.startsWith('7m得点');
    let isMiss = log.action.startsWith('ノーゴール');
    let is7mMiss = log.action.startsWith('7mノーゴール');
    let isOfMiss = /パスミス|キャッチミス|ドリブルミス/.test(log.action);
    let isOfFoul = /ダブルドリブル|3sec|ラインクロス|キックボール|チャージング/.test(log.action);
    
    let team = log.team;
    let oppTeam = team === 'A' ? 'B' : 'A';
    
    // アシスト計算
    let assistMatch = log.action.match(/Ast: (.*?)<\/small>/);
    if (assistMatch) {
      let assistPlayer = [...roster[team].court, ...roster[team].bench].find(p => p.name === assistMatch[1]);
      if (assistPlayer && stats[team][assistPlayer.id]) stats[team][assistPlayer.id].assists++;
    }

    if (stats[team][log.playerId]) {
      if (isGoal) stats[team][log.playerId].goals++;
      if (is7mGoal) stats[team][log.playerId].sevenM_goals++;
      if (isMiss) stats[team][log.playerId].misses++;
      if (is7mMiss) stats[team][log.playerId].sevenM_misses++;
      if (isOfMiss) stats[team][log.playerId].ofMisses++;
      if (isOfFoul) stats[team][log.playerId].ofFouls++;
      if (log.action.startsWith('DFファウル')) stats[team][log.playerId].dfFouls++;
      if (log.action.startsWith('パスカット')) stats[team][log.playerId].steals++;
      if (log.action.startsWith('ブロック')) stats[team][log.playerId].blocks++;
      if (log.action.startsWith('警告')) stats[team][log.playerId].warnings++;
      if (log.action.startsWith('2分間退場')) stats[team][log.playerId].suspensions++;
      if (log.action.startsWith('失格')) stats[team][log.playerId].disqualifications++;
    }

    // 相手GKの処理
    let oppGkId = oppTeam === 'A' ? log.gkIdA : log.gkIdB;
    if (oppGkId && stats[oppTeam][oppGkId]) {
      if (isGoal) stats[oppTeam][oppGkId].conceded++;
      if (is7mGoal) stats[oppTeam][oppGkId].sevenM_conceded++;
      if (isMiss) log.action.includes('枠外') ? stats[oppTeam][oppGkId].gk_out++ : stats[oppTeam][oppGkId].saves++;
      if (is7mMiss) log.action.includes('枠外') ? stats[oppTeam][oppGkId].sevenM_gk_out++ : stats[oppTeam][oppGkId].sevenM_saves++;
    }
  });

  const buildStatsHTML = (team) => {
    let html = '';
    let playerList = Object.values(stats[team]).sort((a, b) => a.num - b.num);
    let tt = { goals: 0, sevenM_goals: 0, misses: 0, sevenM_misses: 0, saves: 0, sevenM_saves: 0, conceded: 0, sevenM_conceded: 0, ofMisses: 0, ofFouls: 0, dfFouls: 0, steals: 0, blocks: 0, warnings: 0, suspensions: 0, disqualifications: 0, assists: 0, gk_out: 0, sevenM_gk_out: 0 };
    const formatStat = (success, attempt) => attempt === 0 ? '-' : `${success}/${attempt}（${Math.round((success / attempt) * 100)}％）`;

    playerList.forEach(p => {
      let regularShots = p.goals + p.misses, sevenMShots = p.sevenM_goals + p.sevenM_misses;
      let regularGk = p.saves + p.gk_out + p.conceded, sevenMGk = p.sevenM_saves + p.sevenM_gk_out + p.sevenM_conceded;
      
      let saveDisp = regularGk > 0 ? `${p.saves + p.gk_out} <span style="font-size:11px; color:#555;">(${p.gk_out})</span> / ${regularGk}（${Math.round(((p.saves + p.gk_out) / regularGk) * 100)}％）` : '-';
      let save7mDisp = sevenMGk > 0 ? `${p.sevenM_saves + p.sevenM_gk_out} <span style="font-size:11px; color:#555;">(${p.sevenM_gk_out})</span> / ${sevenMGk}（${Math.round(((p.sevenM_saves + p.sevenM_gk_out) / sevenMGk) * 100)}％）` : '-';
      
      html += `<tr>
        <td style="text-align:left;">${p.name}</td>
        <td>${p.goals + p.sevenM_goals} <span style="font-size:13px; color:#555;">(${p.sevenM_goals})</span></td>
        <td>${formatStat(p.goals, regularShots)}</td><td>${formatStat(p.sevenM_goals, sevenMShots)}</td>
        <td>${saveDisp}</td><td>${save7mDisp}</td>
        <td>${p.assists}</td><td>${p.steals}</td><td>${p.blocks}</td><td>${p.ofMisses}</td>
        <td>${p.ofFouls}</td><td>${p.dfFouls}</td><td>${p.warnings}</td><td>${p.suspensions}</td><td>${p.disqualifications}</td>
      </tr>`;
      
      Object.keys(tt).forEach(k => tt[k] += p[k]);
    });

    let ttRegShots = tt.goals + tt.misses, tt7mShots = tt.sevenM_goals + tt.sevenM_misses;
    let ttRegGk = tt.saves + tt.gk_out + tt.conceded, tt7mGk = tt.sevenM_saves + tt.sevenM_gk_out + tt.sevenM_conceded;
    
    let ttSaveDisp = ttRegGk > 0 ? `${tt.saves + tt.gk_out} <span style="font-size:11px; color:#555;">(${tt.gk_out})</span> / ${ttRegGk}（${Math.round(((tt.saves + tt.gk_out) / ttRegGk) * 100)}％）` : '-';
    let ttSave7mDisp = tt7mGk > 0 ? `${tt.sevenM_saves + tt.sevenM_gk_out} <span style="font-size:11px; color:#555;">(${tt.sevenM_gk_out})</span> / ${tt7mGk}（${Math.round(((tt.sevenM_saves + tt.sevenM_gk_out) / tt7mGk) * 100)}％）` : '-';

    html += `<tr class="team-total-row">
      <td style="text-align:left;">【チーム合計】</td>
      <td>${tt.goals + tt.sevenM_goals} <span style="font-size:13px; color:#555;">(${tt.sevenM_goals})</span></td>
      <td>${formatStat(tt.goals, ttRegShots)}</td><td>${formatStat(tt.sevenM_goals, tt7mShots)}</td>
      <td>${ttSaveDisp}</td><td>${ttSave7mDisp}</td>
      <td>${tt.assists}</td><td>${tt.steals}</td><td>${tt.blocks}</td><td>${tt.ofMisses}</td>
      <td>${tt.ofFouls}</td><td>${tt.dfFouls}</td><td>${tt.warnings}</td><td>${tt.suspensions}</td><td>${tt.disqualifications}</td>
    </tr>`;
    return html;
  };

  document.getElementById('statsTeamNameA').innerText = customTeamA;
  document.getElementById('statsTeamNameB').innerText = customTeamB;
  document.getElementById('statsBodyA').innerHTML = buildStatsHTML('A');
  document.getElementById('statsBodyB').innerHTML = buildStatsHTML('B');

  drawCharts('A', 'shootChartA', 'saveChartA');
  drawCharts('B', 'shootChartB', 'saveChartB');
}

function drawCharts(team, shootId, saveId) {
  const zones = ["左サイド", "左45度", "センター", "右45度", "右サイド", "左サイドミドル", "左45度ミドル", "センターミドル", "右45度ミドル", "右サイドミドル"];
  let shootStats = {}, saveStats = {};
  zones.forEach(z => { shootStats[z] = { attempts: 0, success: 0 }; saveStats[z] = { faced: 0, success: 0 }; });

  let oppTeam = team === 'A' ? 'B' : 'A';
  matchLogs.forEach(log => {
    let match = log.action.match(/\[(.*?)\]/);
    if (match) {
      let z = match[1];
      if (log.team === team && shootStats[z]) {
        shootStats[z].attempts++;
        if (log.action.includes("得点")) shootStats[z].success++;
      }
      if (log.team === oppTeam && saveStats[z]) {
        saveStats[z].faced++;
        if (log.action.includes("ノーゴール")) saveStats[z].success++;
      }
    }
  });

  const buildHtml = (stats, isSave) => zones.map(z => {
    let attempts = isSave ? stats[z].faced : stats[z].attempts, success = stats[z].success;
    let pctStr = attempts > 0 ? `${Math.round((success / attempts) * 100)}%` : "";
    let dispStr = attempts > 0 ? `${success}/${attempts}` : "";
    return `<div class="stat-box ${isSave ? "save-stat" : ""}"><span class="zone-name">${z}</span><span>${dispStr}</span><span class="pct">${pctStr}</span></div>`;
  }).join('');

  const sCont = document.getElementById(shootId), vCont = document.getElementById(saveId);
  if (sCont) sCont.innerHTML = buildHtml(shootStats, false);
  if (vCont) vCont.innerHTML = buildHtml(saveStats, true);
}

// ================= PDFタイトル監視・印刷 =================
// ★ イベント駆動型に変更 (setIntervalを廃止)
function updateDocumentTitle() {
  const title = document.querySelector('.match-info-title').value.trim() || "大会名未定";
  const matchUp = (customTeamA && customTeamB) ? `${customTeamA} vs. ${customTeamB}` : "対戦カード未定";
  document.title = `${title} ${matchUp}`;
}

function printToPDF() { window.print(); }