let scoreA = 0;
let scoreB = 0;

// 試合の全ログを管理する配列
let matchLogs = [];

// データ構造：チームごとにコート(6名、うち1名がGK)とベンチを管理
let roster = {
  A: { court: [], bench: [], gkId: null },
  B: { court: [], bench: [], gkId: null }
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

// 登録画面でコートチェックを監視し、GK選択肢を動的にアップデートする
function limitCheckAndGkUpdate(checkbox, team) {
  let checkedCount = document.querySelectorAll(`.starter-check-${team}:checked`).length;
  if (checkedCount > 6) {
    checkbox.checked = false;
    alert("コートメンバーは6人までです。");
    return;
  }
  updateGkDropdown(team);
}

// 登録画面のGKセレクトボックスを構築
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
    let nameVal = document.getElementById(`name${team}_${index}`).value.trim() || `選手${index}`;
    // 1〜16まですべて入力欄から背番号を取得する仕様
    let numVal = document.getElementById(`num${team}_${index}`).value.trim() || index;
    html += `<option value="${team}_${index}">${numVal}. ${nameVal}</option>`;
  });
  gkSelect.innerHTML = html;
}

// 初期化：入力欄とチェックボックスの生成 (16名まで)
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
    
    // 1から16まですべて背番号と名前の自由入力にする
    for (let i = 1; i <= 16; i++) {
      if (i === 9) html += `</div><div class="input-col">`; // 9番目で右カラムへ
      
      html += `
      <div class="player-input-row">
        <input type="text" id="num${teamPrefix}_${i}" class="player-num-input" placeholder="No." oninput="updateGkDropdown('${teamPrefix}')">
        <input type="text" id="name${teamPrefix}_${i}" class="player-name-input" placeholder="名前" oninput="updateGkDropdown('${teamPrefix}')">
        <label class="starter-label">
          <input type="checkbox" class="starter-check-${teamPrefix}" value="${i}" onclick="limitCheckAndGkUpdate(this, '${teamPrefix}')">
        </label>
      </div>`;
    }
    
    html += `</div></div>`;
    return html;
  }

  setupA.innerHTML = buildInputs('A');
  setupB.innerHTML = buildInputs('B');
}

// ================= 矢印キー・Enterキーで入力欄を移動する機能 =================
document.addEventListener('keydown', function(e) {
  // ↑(ArrowUp), ↓(ArrowDown), Enterキーのみ処理
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
    const active = document.activeElement;
    
    // 現在フォーカスされているのが、背番号か名前の入力欄かチェック
    const match = active.id ? active.id.match(/^(num|name)(A|B)_(\d+)$/) : null;
    if (match) {
      // 変換中（日本語入力中）のEnterキーは無視する
      if (e.isComposing) return;
      
      e.preventDefault(); // デフォルトの動き（画面スクロールなど）を止める
      
      const type = match[1];
      const team = match[2];
      let idx = parseInt(match[3], 10);
      
      // ↓またはEnterなら次の番号へ、↑なら前の番号へ
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        idx++;
      } else if (e.key === 'ArrowUp') {
        idx--;
      }
      
      // 1〜16の範囲内ならフォーカスを移動
      if (idx >= 1 && idx <= 16) {
        const nextInput = document.getElementById(`${type}${team}_${idx}`);
        if (nextInput) {
          nextInput.focus();
          nextInput.select(); // 連続入力しやすいように文字を選択状態にする
        }
      }
    }
  }
});

// 選手リストの登録
function updateRoster() {
  customTeamA = document.getElementById('teamNameA').value.trim() || "Team A";
  customTeamB = document.getElementById('teamNameB').value.trim() || "Team B";

  // 大会名の横に対戦カードを自動表示
  const matchUpDisplay = document.getElementById('matchUpDisplay');
  if (matchUpDisplay) {
    matchUpDisplay.innerText = `${customTeamA} vs. ${customTeamB}`;
  }

  const gkValA = document.getElementById('gkSelectA').value;
  const gkValB = document.getElementById('gkSelectB').value;

  // GKの初期選択必須チェック
  if (!gkValA || !gkValB) {
    alert("両チームとも、コート上から1名ゴールキーパー(GK)を指定してください。");
    return;
  }

  document.getElementById('displayTeamNameA').innerText = customTeamA;
  document.getElementById('displayTeamNameB').innerText = customTeamB;
  
  // タイムアウトボタンのチーム名も更新
  const btnToA = document.getElementById('btnTimeoutA');
  const btnToB = document.getElementById('btnTimeoutB');
  if (btnToA) btnToA.innerText = customTeamA + ' T.O.';
  if (btnToB) btnToB.innerText = customTeamB + ' T.O.';

  // ログテーブルのヘッダー更新（左右のチーム名）
  document.getElementById('thPlayerA').innerText = customTeamA;
  document.getElementById('thPlayerB').innerText = customTeamB;

  roster.A.court = []; roster.A.bench = []; roster.A.gkId = gkValA;
  roster.B.court = []; roster.B.bench = []; roster.B.gkId = gkValB;
  activeSelection = { A: { court: null, bench: null }, B: { court: null, bench: null } };

  // Team A
  for (let i = 1; i <= 16; i++) {
    let nameInput = document.getElementById(`nameA_${i}`).value.trim();
    let isCourt = document.querySelector(`.starter-check-A[value="${i}"]`).checked;
    if (nameInput) {
      let numVal = document.getElementById(`numA_${i}`).value.trim();
      let displayName = numVal ? `${numVal}. ${nameInput}` : nameInput;
      
      // ソート用に背番号を数値化（空欄や文字列の場合は9999にして末尾へ）
      let numInt = parseInt(numVal, 10);
      if (isNaN(numInt)) numInt = 9999;

      let p = { id: `A_${i}`, name: displayName, num: numInt };
      if (isCourt) roster.A.court.push(p);
      else roster.A.bench.push(p);
    }
  }

  // Team B
  for (let i = 1; i <= 16; i++) {
    let nameInput = document.getElementById(`nameB_${i}`).value.trim();
    let isCourt = document.querySelector(`.starter-check-B[value="${i}"]`).checked;
    if (nameInput) {
      let numVal = document.getElementById(`numB_${i}`).value.trim();
      let displayName = numVal ? `${numVal}. ${nameInput}` : nameInput;
      
      // ソート用に背番号を数値化
      let numInt = parseInt(numVal, 10);
      if (isNaN(numInt)) numInt = 9999;

      let p = { id: `B_${i}`, name: displayName, num: numInt };
      if (isCourt) roster.B.court.push(p);
      else roster.B.bench.push(p);
    }
  }

  // 両チームのコート・ベンチを背番号順（昇順）に並べ替え
  roster.A.court.sort((a, b) => a.num - b.num);
  roster.A.bench.sort((a, b) => a.num - b.num);
  roster.B.court.sort((a, b) => a.num - b.num);
  roster.B.bench.sort((a, b) => a.num - b.num);

  renderButtons();
  renderLogs();
  
  // スタッツ画面の表示と初期計算
  document.getElementById('statsContainer').style.display = 'block';
  renderStats();
  
  document.querySelector('.setup-section').removeAttribute('open');
}

// 選手ボタンの描画 (GKは青系の特別なラベルを付与)
function renderButtons() {
  function generateHtml(team, type) {
    return roster[team][type].map(p => {
      const isSelected = activeSelection[team][type] === p.id ? 'selected' : '';
      const isGk = roster[team].gkId === p.id ? ' <span style="color:#007bff; font-weight:bold;">[GK]</span>' : '';
      return `<button class="player-btn ${isSelected}" onclick="selectPlayer('${team}', '${type}', '${p.id}', '${p.name}')">${p.name}${isGk}</button>`;
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

  const assistSelect = document.getElementById('assistSelect');
  assistSelect.innerHTML = '<option value="">-- なし --</option>';
  
  const targetPlayerName = activeSelection[team].court ? 
    roster[team].court.find(p => p.id === activeSelection[team].court).name : 
    activeSelection[team].bench ? roster[team].bench.find(p => p.id === activeSelection[team].bench).name : null;

  if (targetPlayerName) {
    let allPlayers = [...roster[team].court, ...roster[team].bench];
    allPlayers.forEach(p => {
      if (p.name !== targetPlayerName) {
        assistSelect.innerHTML += `<option value="${p.name}">${p.name}</option>`;
      }
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

// 前半終了ボタンの処理
function halfTime() {
  if (!confirm("前半を終了し、タイマーをリセットして後半に移りますか？")) return;
  
  stopTimer(); // タイマーを止める
  
  // ログに記録を残す（システムメッセージとして記録）
  let recordTime = formatTime(elapsedSeconds);
  addLog(recordTime, 'System', "", "前半終了／後半開始", 0);
  
  // タイマーを00:00に戻す
  elapsedSeconds = 0;
  document.getElementById('timer').innerText = formatTime(elapsedSeconds);
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
  const noAlertActions = ['警告', '2分間退場', '失格', 'ダブルドリブル', 'キックボール', '3sec', 'ラインクロス', 'ターンオーバー', 'リバウンド', 'チャージング', 'シュートミス', 'パスミス', 'パスカット', 'キャッチミス', 'GK指定/交代'];
  if (!isRunning && (!isSub && !noAlertActions.includes(actionName))) {
    if (!confirm('タイマーが停止中または開始前ですが、現在の表示時間で記録しますか？')) {
      return null;
    }
  }
  return formatTime(elapsedSeconds);
}

// ================= ログの記録・描画 =================
function addLog(time, teamCode, playerName, actionText, points, playerId = null) {
  matchLogs.unshift({
    id: Date.now() + Math.random(),
    time: time,
    team: teamCode,
    playerId: playerId,       // 誰がアクションを起こしたかを記憶
    player: playerName,
    action: actionText,
    points: points,
    gkIdA: roster.A.gkId,     // アクション当時のTeam AのGK
    gkIdB: roster.B.gkId      // アクション当時のTeam BのGK
  });
  renderLogs();
  renderStats(); // ログ追加時にスタッツ再計算
}

function renderLogs() {
  let currentScoreA = 0;
  let currentScoreB = 0;
  
  // 古い記録から順に累計得点と表示用のスコアを計算
  for (let i = matchLogs.length - 1; i >= 0; i--) {
    let log = matchLogs[i];
    let scoreChangedA = false;
    let scoreChangedB = false;

    if (log.points > 0) {
      if (log.team === 'A') {
        currentScoreA += log.points;
        scoreChangedA = true;
      }
      if (log.team === 'B') {
        currentScoreB += log.points;
        scoreChangedB = true;
      }
    }
    
    // 累計得点は保持しつつ、画面表示用は変更があった時のみ数字にする
    log.cumScoreA = currentScoreA;
    log.cumScoreB = currentScoreB;
    log.displayScoreA = scoreChangedA ? currentScoreA : '-';
    log.displayScoreB = scoreChangedB ? currentScoreB : '-';
  }

  scoreA = currentScoreA;
  scoreB = currentScoreB;
  document.getElementById('scoreA').innerText = scoreA;
  document.getElementById('scoreB').innerText = scoreB;

  let tableHTML = '';
  for (let i = 0; i < matchLogs.length; i++) {
    let log = matchLogs[i];
    
    // チームAのアクションなら左側に、チームBなら右側にデータを配置
    // System（前半終了など）の場合は両方のアクション列に表示して目立たせる
    let aPlayer = log.team === 'A' ? log.player : '';
    let aAction = log.team === 'A' ? log.action : (log.team === 'System' ? log.action : '');
    let bPlayer = log.team === 'B' ? log.player : '';
    let bAction = log.team === 'B' ? log.action : (log.team === 'System' ? log.action : '');

    tableHTML += `
    <tr>
      <td>${aPlayer}</td>
      <td>${aAction}</td>
      <td class="score-col">${log.displayScoreA}</td>
      <td style="font-weight: bold; background: #f8f9fa;">${log.time}</td>
      <td class="score-col">${log.displayScoreB}</td>
      <td>${bAction}</td>
      <td>${bPlayer}</td>
      <td class="noprint">
        <button class="delete-btn" onclick="deleteLog(${log.id})">削除</button>
      </td>
    </tr>
    `;
  }
  document.getElementById('logTableBody').innerHTML = tableHTML;
}

function deleteLog(id) {
  if (!confirm('この記録を削除しますか？\n※以降の累計得点も自動的に修正されます。')) return;
  matchLogs = matchLogs.filter(log => log.id !== id);
  renderLogs();
  renderStats(); // ログ削除時にスタッツ再計算
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

  let assistText = "";
  const assistSelect = document.getElementById('assistSelect');
  if (points > 0 && assistSelect.value !== "") {
    assistText = `<br><small>Ast: ${assistSelect.value}</small>`;
  }

  // GKの記録を判別
  const isGk = (roster[team].gkId === targetId) ? " [GK]" : "";

  // 最後に targetId を追加で渡す
  addLog(recordTime, team, targetPlayer + isGk, `${actionName}${assistText}`, points, targetId);

  activeSelection[team].court = null;
  activeSelection[team].bench = null;
  document.getElementById('manualTime').value = '';
  assistSelect.innerHTML = '<option value="">-- なし --</option>';
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

  // GKが退く(または入る)場合のラベル処理
  let outLabel = (roster[team].gkId === cId) ? `${cPlayer.name}(GK)` : cPlayer.name;
  let inLabel = (roster[team].gkId === cId) ? `${bPlayer.name}(GK)` : bPlayer.name;

  addLog(recordTime, team, "-", `交代 (OUT: ${outLabel} / IN: ${inLabel})`, 0);

  // GKがベンチに下がる場合は、新しく入ってきた選手に自動でGKを引き継ぐ
  if (roster[team].gkId === cId) {
    roster[team].gkId = bId;
  }

  roster[team].court[cIndex] = bPlayer;
  roster[team].bench[bIndex] = cPlayer;

  activeSelection[team].court = null;
  activeSelection[team].bench = null;
  document.getElementById('manualTime').value = '';
  document.getElementById('assistSelect').innerHTML = '<option value="">-- なし --</option>';
  
  renderButtons();
}

// ================= GKの役割切り替え機能 =================
function toggleGkRole() {
  let team = activeSelection.A.court ? 'A' : activeSelection.B.court ? 'B' : null;

  if (!team) {
    alert("コート上の選手から、新しくGKにする選手を1名選択してから押してください。");
    return;
  }

  let targetId = activeSelection[team].court;
  if (!targetId) {
    alert("ベンチの選手をGKに指定することはできません。交代を行ってからGK指定してください。");
    return;
  }

  if (roster[team].gkId === targetId) {
    alert("選択された選手は既にGKです。");
    return;
  }

  const recordTime = getRecordTime("GK交代", true);
  if (recordTime === null) return;

  let oldGk = roster[team].court.find(p => p.id === roster[team].gkId);
  let newGk = roster[team].court.find(p => p.id === targetId);

  let oldGkName = oldGk ? oldGk.name : "なし";
  addLog(recordTime, team, "-", `GK変更 (前: ${oldGkName} → 新: ${newGk.name})`, 0);

  roster[team].gkId = targetId;

  activeSelection[team].court = null;
  activeSelection[team].bench = null;
  document.getElementById('manualTime').value = '';
  renderButtons();
}

// ================= マイチーム自動入力機能 =================
// ★ここにご自身のチーム名と選手リストを設定してください
const myTeamData = {
  name: "すわろ〜ず",
  players: [
    { num: "1", name: "大久保 裕章", isStarter: true },
    { num: "2", name: "刈谷 匡志", isStarter: true },
    { num: "3", name: "板東 慶晃", isStarter: true },
    { num: "4", name: "宮下 優華", isStarter: true },
    { num: "7", name: "馬場 美友", isStarter: false },
    { num: "8", name: "山本 峻也", isStarter: true },
    { num: "10", name: "馬場 康二朗", isStarter: true },
    { num: "11", name: "堤 史土", isStarter: false },
    { num: "15", name: "福田 あかね", isStarter: false }
    // 必要に応じて16名まで追加可能
  ]
};

function loadMyTeam() {
  document.getElementById('teamNameA').value = myTeamData.name;
  
  // 一度すべての入力をクリアする
  for (let i = 1; i <= 16; i++) {
    document.getElementById(`numA_${i}`).value = '';
    document.getElementById(`nameA_${i}`).value = '';
    document.querySelector(`.starter-check-A[value="${i}"]`).checked = false;
  }

  // データを順番に入力枠に埋める
  myTeamData.players.forEach((p, index) => {
    let i = index + 1;
    if (i > 16) return; // 最大16人まで
    
    document.getElementById(`numA_${i}`).value = p.num;
    document.getElementById(`nameA_${i}`).value = p.name;
    document.querySelector(`.starter-check-A[value="${i}"]`).checked = p.isStarter;
  });

  // GKのドロップダウンを更新
  updateGkDropdown('A');
}

// ================= 統計(スタッツ)の計算・描画 =================
function renderStats() {
  let stats = { A: {}, B: {} };
  
  // 初期化：7m用の項目を細分化
  let initStats = (team) => {
    let allPlayers = [...roster[team].court, ...roster[team].bench];
    allPlayers.forEach(p => {
      stats[team][p.id] = { 
        name: p.name, num: p.num, 
        goals: 0, sevenM_goals: 0, 
        misses: 0, sevenM_misses: 0, 
        saves: 0, sevenM_saves: 0, 
        conceded: 0, sevenM_conceded: 0 
      };
    });
  };
  
  if (roster.A.court.length > 0 || roster.A.bench.length > 0) {
    initStats('A');
    initStats('B');
  } else {
    return;
  }

  // ログを全てなぞって集計する
  matchLogs.forEach(log => {
    if (!log.playerId) return; 
    
    let isGoal = log.action.startsWith('得点');
    let is7mGoal = log.action.startsWith('7m得点') || (log.action.startsWith('7m') && !log.action.includes('ミス'));
    let isMiss = log.action.startsWith('シュートミス');
    let is7mMiss = log.action.startsWith('7mシュートミス');
    
    if (isGoal || is7mGoal || isMiss || is7mMiss) {
      let team = log.team;
      let oppTeam = team === 'A' ? 'B' : 'A';
      
      // シューターのスタッツ加算
      if (stats[team][log.playerId]) {
        if (isGoal) stats[team][log.playerId].goals++;
        if (is7mGoal) stats[team][log.playerId].sevenM_goals++;
        if (isMiss) stats[team][log.playerId].misses++;
        if (is7mMiss) stats[team][log.playerId].sevenM_misses++;
      }
      
      // 相手GKのスタッツ加算（ミス＝セーブとして扱う）
      let oppGkId = oppTeam === 'A' ? log.gkIdA : log.gkIdB;
      if (oppGkId && stats[oppTeam][oppGkId]) {
        if (isGoal) stats[oppTeam][oppGkId].conceded++;
        if (is7mGoal) stats[oppTeam][oppGkId].sevenM_conceded++;
        if (isMiss) stats[oppTeam][oppGkId].saves++;
        if (is7mMiss) stats[oppTeam][oppGkId].sevenM_saves++;
      }
    }
  });


// HTML構築
  function buildStatsHTML(team) {
    let html = '';
    let playerList = Object.values(stats[team]).sort((a, b) => a.num - b.num);
    
    playerList.forEach(p => {
      // 総得点の計算（ここは7mを含む）
      let totalGoals = p.goals + p.sevenM_goals;

      // 通常のシュート計算（7mを含まない）
      let regularShots = p.goals + p.misses;
      let shotPct = regularShots > 0 ? Math.round((p.goals / regularShots) * 100) + '%' : '-';
      let shotFraction = `${p.goals}/${regularShots}`; // シュート数 (成功/試行)
      
      // 7mのシュート計算
      let sevenMShots = p.sevenM_goals + p.sevenM_misses;
      let sevenMShotPct = sevenMShots > 0 ? Math.round((p.sevenM_goals / sevenMShots) * 100) + '%' : '-';
      let sevenMShotFraction = `${p.sevenM_goals}/${sevenMShots}`; // 7mシュート数 (成功/試行)

      // 通常のGKセーブ計算（★7mを含まないように修正）
      let regularSaves = p.saves;
      let regularConceded = p.conceded;
      let regularGkFaced = regularSaves + regularConceded;
      let savePct = regularGkFaced > 0 ? Math.round((regularSaves / regularGkFaced) * 100) + '%' : '-';
      let saveFraction = `${regularSaves}/${regularGkFaced}`; // GKセーブ数 (セーブ/被シュート)
      
      // 7mのGKセーブ計算
      let sevenMGkFaced = p.sevenM_saves + p.sevenM_conceded;
      let sevenMSavePct = sevenMGkFaced > 0 ? Math.round((p.sevenM_saves / sevenMGkFaced) * 100) + '%' : '-';
      let sevenMSaveFraction = `${p.sevenM_saves}/${sevenMGkFaced}`; // 7mセーブ数 (セーブ/被シュート)
      
      html += `<tr>
        <td style="text-align:left;">${p.name}</td>
        <td>${totalGoals} <span style="font-size:10px; color:#555;">(${p.sevenM_goals})</span></td>
        <td>${shotFraction}</td>
        <td>${shotPct}</td>
        <td>${sevenMShotFraction}</td>
        <td>${sevenMShotPct}</td>
        <td>${saveFraction}</td>
        <td>${savePct}</td>
        <td>${sevenMSaveFraction}</td>
        <td>${sevenMSavePct}</td>
      </tr>`;
    });
    return html;
  }

  document.getElementById('statsTeamNameA').innerText = customTeamA;
  document.getElementById('statsTeamNameB').innerText = customTeamB;
  document.getElementById('statsBodyA').innerHTML = buildStatsHTML('A');
  document.getElementById('statsBodyB').innerHTML = buildStatsHTML('B');
}

// ================= タイムアウトの記録と処理 =================
function recordTimeout(team) {
  // 時間を取得（引数にtrueを渡して停止警告をスキップ）
  const recordTime = getRecordTime("タイムアウト", true);
  if (recordTime === null) return;

  // ★タイマーを自動的にストップ
  stopTimer();

  // ログに追加（タイムアウトはチーム全体のアクションなので選手名は「-」）
  addLog(recordTime, team, "-", "タイムアウト", 0);

  // 選手が選択状態だった場合は解除してリセット
  activeSelection.A.court = null;
  activeSelection.A.bench = null;
  activeSelection.B.court = null;
  activeSelection.B.bench = null;
  document.getElementById('manualTime').value = '';
  renderButtons();
}