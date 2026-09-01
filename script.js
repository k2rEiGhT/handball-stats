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
let currentPeriod = 1;

// 登録画面でコートチェックを監視し、GK選択肢を動的にアップデートする
function limitCheckAndGkUpdate(checkbox, team) {
  let index = checkbox.value;
  // ★追加：コートにチェックを入れたら除外チェックを外す
  if (checkbox.checked) {
    let excludeCheck = document.querySelector(`.exclude-check-${team}[value="${index}"]`);
    if (excludeCheck) excludeCheck.checked = false;
  }

  let checkedCount = document.querySelectorAll(`.starter-check-${team}:checked`).length;
  if (checkedCount > 6) {
    checkbox.checked = false;
    alert("コートメンバーは6人までです。");
    return;
  }
  updateGkDropdown(team);
}

// ★新規追加：除外チェックの挙動
function handleExcludeCheck(checkbox, team) {
  let index = checkbox.value;
  if (checkbox.checked) {
    // 除外をチェックしたらコートのチェックを外す
    let courtCheck = document.querySelector(`.starter-check-${team}[value="${index}"]`);
    if (courtCheck && courtCheck.checked) {
      courtCheck.checked = false;
      updateGkDropdown(team);
    }
  }
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
    let nameVal = document.getElementById(`name${team}_${index}`).value.trim() || "-";
    // 1〜16まですべて入力欄から背番号を取得する仕様
    let numVal = document.getElementById(`num${team}_${index}`).value.trim() || index;
    html += `<option value="${team}_${index}">${numVal}. ${nameVal}</option>`;
  });
  gkSelect.innerHTML = html;
}

// 初期化：入力欄とチェックボックスの生成 (16名まで)、およびタイマー編集イベントの登録
window.onload = function() {
  const setupA = document.getElementById('setupA');
  const setupB = document.getElementById('setupB');
  
  function buildInputs(teamPrefix) {
    let html = `
    <div class="setup-header">
      <div class="setup-header-col">コート/除外</div>
      <div class="setup-header-col">コート/除外</div>
    </div>
    <div class="input-grid">
      <div class="input-col">`;
    
    // 1から16まですべて背番号と名前の自由入力にする
    for (let i = 1; i <= 16; i++) {
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

  setupA.innerHTML = buildInputs('A');
  setupB.innerHTML = buildInputs('B');

  // ★追加：タイマーを画面のまま直接修正する機能
  const timerElement = document.getElementById('timer');
  if (timerElement) {
    timerElement.title = "クリックして時間を直接修正";
    timerElement.style.cursor = "pointer";
    
    // クリックで編集モード（直接入力可能）にする
    timerElement.addEventListener('click', function() {
      if (isEnded) return;
      if (isRunning) stopTimer(); // タイマーが動いていたら止める
      
      this.contentEditable = true; // 直接編集を許可
      this.focus();
      
      // テキストを全選択状態にして、すぐ上書き入力できるようにする
      const range = document.createRange();
      range.selectNodeContents(this);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });

    // エンターキーを押したときに編集を完了する
    timerElement.addEventListener('keydown', function(e) {
      // 変換中（日本語入力中）のEnterキーは無視
      if (e.isComposing) return; 
      if (e.key === 'Enter') {
        e.preventDefault();
        this.blur(); // フォーカスを外して、すぐ下の blur イベントを強制発火
      }
    });

    // 画面の別の場所をクリック（フォーカスが外れた）したときに時間を確定・反映する
    timerElement.addEventListener('blur', function() {
      this.contentEditable = false; // 編集モードを終了
      let inputTime = this.innerText.trim();
      
      // スマホ入力対策：全角数字や全角コロン（１２：３０）を半角に変換する
      inputTime = inputTime.replace(/[０-９：]/g, function(s) {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
      });
      
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
      
      // 最終的な正しい時間（または間違っていた場合は元の時間）を再表示
      this.innerText = formatTime(elapsedSeconds);
    });
  }
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
    let nameElem = document.getElementById(`nameA_${i}`);
    let nameInput = nameElem.value.trim();
    let numVal = document.getElementById(`numA_${i}`).value.trim();
    let isCourt = document.querySelector(`.starter-check-A[value="${i}"]`).checked;
    let isExcluded = document.querySelector(`.exclude-check-A[value="${i}"]`).checked;
    
    // 背番号がある、またはコートチェックが入っている場合で、氏名が空欄なら「-」を自動入力
    if (!nameInput && (numVal !== "" || isCourt)) {
      nameInput = "-";
      nameElem.value = "-"; // 画面上の入力ボックスにも「-」を表示
    }

    if (nameInput && !isExcluded) {
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
    let nameElem = document.getElementById(`nameB_${i}`);
    let nameInput = nameElem.value.trim();
    let numVal = document.getElementById(`numB_${i}`).value.trim();
    let isCourt = document.querySelector(`.starter-check-B[value="${i}"]`).checked;
    let isExcluded = document.querySelector(`.exclude-check-B[value="${i}"]`).checked;
    
    // 背番号がある、またはコートチェックが入っている場合で、氏名が空欄なら「-」を自動入力
    if (!nameInput && (numVal !== "" || isCourt)) {
      nameInput = "-";
      nameElem.value = "-"; // 画面上の入力ボックスにも「-」を表示
    }

    if (nameInput && !isExcluded) {
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

// 選手ボタンの描画
function renderButtons() {
  function generateHtml(team, type) {
    return roster[team][type].map(p => {
      const isSelected = activeSelection[team][type] === p.id ? 'selected' : '';
      const isGk = roster[team].gkId === p.id ? ' <span class="gk-label">[GK]</span>' : '';
      // 追加：先頭の「数字.」を装飾用タグで囲む
      const formattedName = p.name.replace(/^(\d+)\.\s*/, '<span class="player-num-display">$1.</span> ');
      return `<button class="player-btn ${isSelected}" onclick="selectPlayer('${team}', '${type}', '${p.id}', '${p.name}')">${formattedName}${isGk}</button>`;
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
    let courtPlayers = roster[team].court;
    courtPlayers.forEach(p => {
      if (p.name !== targetPlayerName) {
        assistSelect.innerHTML += `<option value="${p.name}">${p.name}</option>`;
      }
    });
  }
}

// ================= チームの左右入れ替え機能 =================
function swapTeams() {
  // チーム名の入れ替え
  let tempTeamName = document.getElementById('teamNameA').value;
  document.getElementById('teamNameA').value = document.getElementById('teamNameB').value;
  document.getElementById('teamNameB').value = tempTeamName;

  // 1〜16番の選手データ（背番号、名前、チェックボックス）を入れ替え
  for (let i = 1; i <= 16; i++) {
    // Team Aの現在の値を取得
    let numA = document.getElementById(`numA_${i}`).value;
    let nameA = document.getElementById(`nameA_${i}`).value;
    let checkA = document.querySelector(`.starter-check-A[value="${i}"]`).checked;
    let excludeA = document.querySelector(`.exclude-check-A[value="${i}"]`).checked;

    // Team Bの現在の値を取得
    let numB = document.getElementById(`numB_${i}`).value;
    let nameB = document.getElementById(`nameB_${i}`).value;
    let checkB = document.querySelector(`.starter-check-B[value="${i}"]`).checked;
    let excludeB = document.querySelector(`.exclude-check-B[value="${i}"]`).checked;

    // Bの値をAに代入（右から左へ）
    document.getElementById(`numA_${i}`).value = numB;
    document.getElementById(`nameA_${i}`).value = nameB;
    document.querySelector(`.starter-check-A[value="${i}"]`).checked = checkB;
    document.querySelector(`.exclude-check-A[value="${i}"]`).checked = excludeB;

    // Aの値をBに代入（左から右へ）
    document.getElementById(`numB_${i}`).value = numA;
    document.getElementById(`nameB_${i}`).value = nameA;
    document.querySelector(`.starter-check-B[value="${i}"]`).checked = checkA;
    document.querySelector(`.exclude-check-B[value="${i}"]`).checked = excludeA;
  }

  // 両チームのGKドロップダウンリストを再構築
  updateGkDropdown('A');
  updateGkDropdown('B');
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
  currentPeriod = 2; //後半と記録
  document.getElementById('timer').innerText = formatTime(elapsedSeconds);
}

function endTimer() {
  stopTimer();
}

function getRecordTime(actionName, isSub = false) {
  const manualTimeInput = document.getElementById('manualTime');
  if (manualTimeInput.value.trim() !== '') {
    return manualTimeInput.value.trim();
  }
  
    const noAlertActions = []; 
  
  if (!isRunning && (!isSub && !noAlertActions.includes(actionName))) {
    if (!confirm('タイマーが停止中または開始前ですが、現在の表示時間で記録しますか？')) {
      return null;
    }
  }
  return formatTime(elapsedSeconds);
}

// ================= ログの記録・描画 =================
function addLog(time, teamCode, playerName, actionText, points, playerId = null) {
  // ★「MM:SS」を秒数に変換（ソート用）
  let parts = time.split(':');
  let timeSec = 0;
  if (parts.length === 2) {
    timeSec = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  // ★ログが前半か後半かを判定
  let logPeriod = currentPeriod;
  
  // 賢い判定：後半(2)なのに、現在のタイマーより2分以上未来の時間（例: 15:00）を手動入力した場合、
  // それは「前半の入力漏れ」だと判断して自動的に前半(1)の適切な位置に挿入します。
  if (logPeriod === 2 && timeSec > elapsedSeconds + 120) {
      logPeriod = 1;
  }

  // ★先頭ではなく配列に追加し、その後全体を並び替える
  matchLogs.push({
    id: Date.now() + Math.random(),
    time: time,
    timeSec: timeSec,         // ソート用の秒数
    period: logPeriod,        // ソート用のピリオド
    team: teamCode,
    playerId: playerId,       // 誰がアクションを起こしたかを記憶
    player: playerName,
    action: actionText,
    points: points,
    gkIdA: roster.A.gkId,     // アクション当時のTeam AのGK
    gkIdB: roster.B.gkId,     // アクション当時のTeam BのGK
    bookmarked: false
  });

  // ★時系列順（新しいものが上＝降順）にソート
  matchLogs.sort((a, b) => {
    // 1. まずピリオドを比較（後半=2 が 前半=1 より上に来る）
    if (a.period !== b.period) {
      return b.period - a.period;
    }
    // 2. 同じピリオドなら、時間が大きい（進んでいる）方が上
    if (b.timeSec !== a.timeSec) {
        return b.timeSec - a.timeSec;
    }
    // 3. 全く同じ時間なら、新しく入力された方（idが大きい方）を上
    return b.id - a.id;
  });

  renderLogs();
  renderStats(); // ログ追加時にスタッツ再計算
}

function renderLogs() {
  let currentScoreA = 0;
  let currentScoreB = 0;
  
  // ★追加：前半の点数を記憶する変数
  let firstHalfA = 0;
  let firstHalfB = 0;
  let isFirstHalf = true;
  
  // 古い記録から順に累計得点と表示用のスコアを計算
  for (let i = matchLogs.length - 1; i >= 0; i--) {
    let log = matchLogs[i];

    // ★追加：前半終了のログを検知したら、そこまでの得点を前半スコアとして確定
    if (log.team === 'System' && log.action === '前半終了／後半開始') {
      isFirstHalf = false;
      firstHalfA = currentScoreA;
      firstHalfB = currentScoreB;
    }

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

  // ★追加：まだ前半（ハーフタイム前）の場合は、現在の点数をそのまま前半スコアにする
  if (isFirstHalf) {
    firstHalfA = currentScoreA;
    firstHalfB = currentScoreB;
  }

  scoreA = currentScoreA;
  scoreB = currentScoreB;
  document.getElementById('scoreA').innerText = scoreA;
  document.getElementById('scoreB').innerText = scoreB;

  // ★追加：ヘッダーの対戦カード下部にスコアと前半スコアを表示
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

  let tableHTML = '';
  for (let i = 0; i < matchLogs.length; i++) {
    let log = matchLogs[i];
    
    let aPlayer = log.team === 'A' ? log.player : '';
    let aAction = log.team === 'A' ? log.action : (log.team === 'System' ? log.action : '');
    let bPlayer = log.team === 'B' ? log.player : '';
    let bAction = log.team === 'B' ? log.action : (log.team === 'System' ? log.action : '');

    let bgA = (log.bookmarked && log.team === 'A') ? 'background-color: #fff9e6;' : '';
    let bgB = (log.bookmarked && log.team === 'B') ? 'background-color: #fff9e6;' : '';
    
    // ※システム（前半終了など）をブックマークした場合は両サイドを薄黄色にする
    if (log.bookmarked && log.team === 'System') {
      bgA = 'background-color: #fff9e6;';
      bgB = 'background-color: #fff9e6;';
    }

    // ▼ 時間の背景色(timeBg)に関する行を削除し、時間のマスはデフォルトの #f8f9fa 固定にします
    tableHTML += `
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
        <!-- ▼ 「削除」の文字を trashSvg に置き換え -->
        <button class="delete-btn" onclick="deleteLog(${log.id})">${trashSvg}</button>
      </td>
    </tr>
    `;
  }
  document.getElementById('logTableBody').innerHTML = tableHTML;
  
  const latestLogText = document.getElementById('latestLogText');
  if (latestLogText) {
    if (matchLogs.length > 0) {
      let latest = matchLogs[0];
      
      // ▼ ここも 🔖の代わりに bookmarkSvg を埋め込む
      let bmBtn = `<button class="latest-bm-btn ${latest.bookmarked ? 'active' : ''}" onclick="toggleBookmark(${latest.id})">${bookmarkSvg}</button>`;
      
      if (latest.team === 'System') {
        latestLogText.innerHTML = `${bmBtn} <span style="vertical-align:middle;">${latest.time} ｜ ${latest.action}</span>`;
      } else {
        let playerStr = latest.player && latest.player !== "-" ? ` ${latest.player}` : "";
        latestLogText.innerHTML = `${bmBtn} <span style="vertical-align:middle;">${latest.time}   ${playerStr}</span> <span class="latest-log-action" style="vertical-align:middle;">  ${latest.action}</span>`;
      }
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

// ================= マイチームの自動入力機能 =================
const myTeamData = {
  name: "すわろ〜ず",
  players: [
    { num: "1", name: "大久保 裕章", isStarter: true },
    { num: "2", name: "刈谷 匡志", isStarter: true },
    { num: "3", name: "宮下 優華", isStarter: true },
    { num: "4", name: "板東 慶晃", isStarter: true },
    { num: "5", name: "堤 萌加", isStarter: false },
    { num: "6", name: "村岡 沙耶", isStarter: false },
    { num: "7", name: "馬場 美友", isStarter: false },
    { num: "8", name: "山本 峻也", isStarter: true },
    { num: "10", name: "馬場 康二朗", isStarter: true },
    { num: "11", name: "堤 史土", isStarter: false },
    { num: "12", name: "馬場 美那", isStarter: false },
    { num: "15", name: "福田 あかね", isStarter: false }
  ]
};

function loadMyTeam() {
  document.getElementById('teamNameA').value = myTeamData.name;
  
  for (let i = 1; i <= 16; i++) {
    document.getElementById(`numA_${i}`).value = '';
    document.getElementById(`nameA_${i}`).value = '';
    document.querySelector(`.starter-check-A[value="${i}"]`).checked = false;
    document.querySelector(`.exclude-check-A[value="${i}"]`).checked = false;
  }

  myTeamData.players.forEach((p, index) => {
    let i = index + 1;
    if (i > 16) return;
    
    document.getElementById(`numA_${i}`).value = p.num;
    document.getElementById(`nameA_${i}`).value = p.name;
    document.querySelector(`.starter-check-A[value="${i}"]`).checked = p.isStarter;
  });

  updateGkDropdown('A');
}

// =================相手チームの自動入力機能 =================
const opponentTeams = [
  {
    name: "Acro",
    players: [
      { num: "1", name: "歴舎 望", isStarter: true },
      { num: "3", name: "松本 爽", isStarter: true },
      { num: "5", name: "齋藤 克弥", isStarter: true },
      { num: "13", name: "足立 麻弥", isStarter: false },
      { num: "14", name: "大濵 佑輔", isStarter: false },
      { num: "30", name: "歴舎 敦輝", isStarter: true },
      { num: "31", name: "深谷 直輝", isStarter: true },
      { num: "56", name: "上中 大輔", isStarter: true },
      { num: "99", name: "岸場 郁子", isStarter: false }
    ]
  },
  {
    name: "LBH",
    players: [
      { num: "2", name: "安田 孝志", isStarter: true },
      { num: "3", name: "東出 修弥", isStarter: true },
      { num: "4", name: "東 武志", isStarter: true },
      { num: "5", name: "田中 大樹", isStarter: true },
      { num: "7", name: "木村 正也", isStarter: true },
      { num: "8", name: "佐藤 璃恵子", isStarter: false },
      { num: "21", name: "佐藤 克輝", isStarter: true },
      { num: "38", name: "友田 幸作", isStarter: false },
      { num: "51", name: "磯井 秀人", isStarter: false },
      { num: "70", name: "北野 尚人", isStarter: false },
      { num: "73", name: "八橋 龍二", isStarter: true },
      { num: "84", name: "橋口 勇喜", isStarter: false },
      { num: "88", name: "廣田 琢磨", isStarter: false },
      { num: "99", name: "大石 亜木菜", isStarter: false }
    ]
  },
  {
    name: "未登録",
    players: [
      { num: "1", name: "", isStarter: true },
      { num: "2", name: "", isStarter: true },
      { num: "3", name: "", isStarter: true },
      { num: "4", name: "", isStarter: true },
      { num: "5", name: "", isStarter: true },
      { num: "6", name: "", isStarter: true },
    ]
  },
  {
    name: "未登録",
    players: [
      { num: "1", name: "", isStarter: true },
      { num: "2", name: "", isStarter: true },
      { num: "3", name: "", isStarter: true },
      { num: "4", name: "", isStarter: true },
      { num: "5", name: "", isStarter: true },
      { num: "6", name: "", isStarter: true },
    ]
  },
  {
    name: "未登録",
    players: [
      { num: "1", name: "", isStarter: true },
      { num: "2", name: "", isStarter: true },
      { num: "3", name: "", isStarter: true },
      { num: "4", name: "", isStarter: true },
      { num: "5", name: "", isStarter: true },
      { num: "6", name: "", isStarter: true },
    ]
  },
  {
    name: "未登録",
    players: [
      { num: "1", name: "", isStarter: true },
      { num: "2", name: "", isStarter: true },
      { num: "3", name: "", isStarter: true },
      { num: "4", name: "", isStarter: true },
      { num: "5", name: "", isStarter: true },
      { num: "6", name: "", isStarter: true },
    ]
  },
  {
    name: "未登録",
    players: [
      { num: "1", name: "", isStarter: true },
      { num: "2", name: "", isStarter: true },
      { num: "3", name: "", isStarter: true },
      { num: "4", name: "", isStarter: true },
      { num: "5", name: "", isStarter: true },
      { num: "6", name: "", isStarter: true },
    ]
  },
  {
    name: "未登録",
    players: [
      { num: "1", name: "", isStarter: true },
      { num: "2", name: "", isStarter: true },
      { num: "3", name: "", isStarter: true },
      { num: "4", name: "", isStarter: true },
      { num: "5", name: "", isStarter: true },
      { num: "6", name: "", isStarter: true },
    ]
  },
  {
    name: "未登録",
    players: [
      { num: "1", name: "", isStarter: true },
      { num: "2", name: "", isStarter: true },
      { num: "3", name: "", isStarter: true },
      { num: "4", name: "", isStarter: true },
      { num: "5", name: "", isStarter: true },
      { num: "6", name: "", isStarter: true },
    ]
  },
  {
    name: "未登録",
    players: [
      { num: "1", name: "", isStarter: true },
      { num: "2", name: "", isStarter: true },
      { num: "3", name: "", isStarter: true },
      { num: "4", name: "", isStarter: true },
      { num: "5", name: "", isStarter: true },
      { num: "6", name: "", isStarter: true },
    ]
  }
];

function loadOpponentTeam(index) {
  const teamData = opponentTeams[index];
  document.getElementById('teamNameB').value = teamData.name;
  
  // 一度Team Bのすべての入力をクリアする
  for (let i = 1; i <= 16; i++) {
    document.getElementById(`numB_${i}`).value = '';
    document.getElementById(`nameB_${i}`).value = '';
    document.querySelector(`.starter-check-B[value="${i}"]`).checked = false;
    document.querySelector(`.exclude-check-B[value="${i}"]`).checked = false;
  }

  // データを順番にTeam Bの入力枠に埋める
  teamData.players.forEach((p, idx) => {
    let i = idx + 1;
    if (i > 16) return; // 最大16人まで
    
    document.getElementById(`numB_${i}`).value = p.num;
    document.getElementById(`nameB_${i}`).value = p.name;
    document.querySelector(`.starter-check-B[value="${i}"]`).checked = p.isStarter;
  });

  // GKのドロップダウンを更新
  updateGkDropdown('B');
}

// ================= 統計(スタッツ)の計算・描画 =================
function renderStats() {
  let stats = { A: {}, B: {} };
  
  // 初期化：アシスト（assists）を追加
  let initStats = (team) => {
    let allPlayers = [...roster[team].court, ...roster[team].bench];
    allPlayers.forEach(p => {
      stats[team][p.id] = { 
        name: p.name, num: p.num, 
        goals: 0, sevenM_goals: 0, misses: 0, sevenM_misses: 0, 
        saves: 0, sevenM_saves: 0, conceded: 0, sevenM_conceded: 0,
        ofMisses: 0, 
        ofFouls: 0,  
        dfFouls: 0,  
        steals: 0,   
        blocks: 0,   
        warnings: 0, 
        suspensions: 0, 
        disqualifications: 0,
        assists: 0   // ★アシストを追加
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
    let is7mGoal = log.action.startsWith('7m得点');
    let isMiss = log.action.startsWith('ノーゴール');
    let is7mMiss = log.action.startsWith('7mノーゴール');
    
    let isOfMiss = log.action.startsWith('パスミス') || 
                   log.action.startsWith('キャッチミス') || 
                   log.action.startsWith('ドリブルミス');
                   
    let isOfFoul = log.action.startsWith('ダブルドリブル') || 
                   log.action.startsWith('3sec') || 
                   log.action.startsWith('ラインクロス') || 
                   log.action.startsWith('キックボール') || 
                   log.action.startsWith('チャージング');
                   
    let isDfFoul = log.action.startsWith('DFファウル');
    let isSteal = log.action.startsWith('パスカット');
    let isBlock = log.action.startsWith('ブロック');
    let isWarning = log.action.startsWith('警告');
    let isSuspension = log.action.startsWith('2分間退場');
    let isDisqualification = log.action.startsWith('失格');

    // ★アシストをした選手名をログのテキストから抽出
    let assistPlayerName = null;
    let assistMatch = log.action.match(/Ast: (.*?)<\/small>/);
    if (assistMatch) {
      assistPlayerName = assistMatch[1];
    }
    
    if (isGoal || is7mGoal || isMiss || is7mMiss || isOfMiss || isOfFoul || isDfFoul || isSteal || isBlock || isWarning || isSuspension || isDisqualification || assistPlayerName) {
      let team = log.team;
      let oppTeam = team === 'A' ? 'B' : 'A';
      
      // シューター・プレイヤーのスタッツ加算
      if (stats[team][log.playerId]) {
        if (isGoal) stats[team][log.playerId].goals++;
        if (is7mGoal) stats[team][log.playerId].sevenM_goals++;
        if (isMiss) stats[team][log.playerId].misses++;
        if (is7mMiss) stats[team][log.playerId].sevenM_misses++;
        if (isOfMiss) stats[team][log.playerId].ofMisses++;
        if (isOfFoul) stats[team][log.playerId].ofFouls++;
        if (isDfFoul) stats[team][log.playerId].dfFouls++;
        if (isSteal) stats[team][log.playerId].steals++;
        if (isBlock) stats[team][log.playerId].blocks++;
        if (isWarning) stats[team][log.playerId].warnings++;
        if (isSuspension) stats[team][log.playerId].suspensions++;
        if (isDisqualification) stats[team][log.playerId].disqualifications++;
      }

      // ★アシストを記録する処理（名前が一致する選手を探してカウント）
      if (assistPlayerName) {
        let allPlayers = [...roster[team].court, ...roster[team].bench];
        let assistPlayer = allPlayers.find(p => p.name === assistPlayerName);
        if (assistPlayer && stats[team][assistPlayer.id]) {
            stats[team][assistPlayer.id].assists++;
        }
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
    
    let teamTotal = {
      goals: 0, sevenM_goals: 0,
      misses: 0, sevenM_misses: 0,
      saves: 0, sevenM_saves: 0,
      conceded: 0, sevenM_conceded: 0,
      ofMisses: 0, ofFouls: 0, dfFouls: 0,
      steals: 0, blocks: 0,
      warnings: 0, suspensions: 0, disqualifications: 0,
      assists: 0 // ★追加
    };

    // 数値から「成功数/試行数 (パーセンテージ)」の文字列を生成するヘルパー関数
    const formatStat = (success, attempt) => {
      if (attempt === 0) return '-';
      let pct = Math.round((success / attempt) * 100);
      return `${success}/${attempt}（${pct}％）`;
    };

    playerList.forEach(p => {
      // 合計の計算
      let totalGoals = p.goals + p.sevenM_goals;
      let regularShotsTotal = p.goals + p.misses;
      let sevenMShotsTotal = p.sevenM_goals + p.sevenM_misses;
      let regularGkFaced = p.saves + p.conceded;
      let sevenMGkFaced = p.sevenM_saves + p.sevenM_conceded;

      // フォーマット済みの文字列を取得
      let shotDisplay = formatStat(p.goals, regularShotsTotal);
      let sevenMShotDisplay = formatStat(p.sevenM_goals, sevenMShotsTotal);
      let saveDisplay = formatStat(p.saves, regularGkFaced);
      let sevenMSaveDisplay = formatStat(p.sevenM_saves, sevenMGkFaced);
      
      // ★ご指定の順番に合わせて並び替え、アシストを追加
      html += `<tr>
        <td style="text-align:left;">${p.name}</td>
        <td>${totalGoals} <span style="font-size:13px; color:#555;">(${p.sevenM_goals})</span></td>
        <td>${shotDisplay}</td>
        <td>${sevenMShotDisplay}</td>
        <td>${saveDisplay}</td>
        <td>${sevenMSaveDisplay}</td>
        <td>${p.assists}</td>
        <td>${p.steals}</td>
        <td>${p.blocks}</td>
        <td>${p.ofMisses}</td>
        <td>${p.ofFouls}</td>
        <td>${p.dfFouls}</td>
        <td>${p.warnings}</td>
        <td>${p.suspensions}</td>
        <td>${p.disqualifications}</td>
      </tr>`;

      // チーム合計用に加算
      teamTotal.goals += p.goals;
      teamTotal.sevenM_goals += p.sevenM_goals;
      teamTotal.misses += p.misses;
      teamTotal.sevenM_misses += p.sevenM_misses;
      teamTotal.saves += p.saves;
      teamTotal.sevenM_saves += p.sevenM_saves;
      teamTotal.conceded += p.conceded;
      teamTotal.sevenM_conceded += p.sevenM_conceded;
      teamTotal.ofMisses += p.ofMisses;
      teamTotal.ofFouls += p.ofFouls;
      teamTotal.dfFouls += p.dfFouls;
      teamTotal.steals += p.steals;
      teamTotal.blocks += p.blocks;
      teamTotal.warnings += p.warnings;
      teamTotal.suspensions += p.suspensions;
      teamTotal.disqualifications += p.disqualifications;
      teamTotal.assists += p.assists; // ★追加
    });

    // チーム合計行の計算と表示
    let tTotalGoals = teamTotal.goals + teamTotal.sevenM_goals;
    let tRegularShotsTotal = teamTotal.goals + teamTotal.misses;
    let tSevenMShotsTotal = teamTotal.sevenM_goals + teamTotal.sevenM_misses;
    let tRegularGkFaced = teamTotal.saves + teamTotal.conceded;
    let tSevenMGkFaced = teamTotal.sevenM_saves + teamTotal.sevenM_conceded;

    let tShotDisplay = formatStat(teamTotal.goals, tRegularShotsTotal);
    let tSevenMShotDisplay = formatStat(teamTotal.sevenM_goals, tSevenMShotsTotal);
    let tSaveDisplay = formatStat(teamTotal.saves, tRegularGkFaced);
    let tSevenMSaveDisplay = formatStat(teamTotal.sevenM_saves, tSevenMGkFaced);

    // ★チーム合計も順番に合わせて出力
    html += `<tr class="team-total-row">
      <td style="text-align:left;">【チーム合計】</td>
      <td>${tTotalGoals} <span style="font-size:13px; color:#555;">(${teamTotal.sevenM_goals})</span></td>
      <td>${tShotDisplay}</td>
      <td>${tSevenMShotDisplay}</td>
      <td>${tSaveDisplay}</td>
      <td>${tSevenMSaveDisplay}</td>
      <td>${teamTotal.assists}</td>
      <td>${teamTotal.steals}</td>
      <td>${teamTotal.blocks}</td>
      <td>${teamTotal.ofMisses}</td>
      <td>${teamTotal.ofFouls}</td>
      <td>${teamTotal.dfFouls}</td>
      <td>${teamTotal.warnings}</td>
      <td>${teamTotal.suspensions}</td>
      <td>${teamTotal.disqualifications}</td>
    </tr>`;

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

// ================= PDF変換時のファイル名変更機能（iPad Chrome最終対策） =================

// 裏側で1秒ごとにチェックするが、タイトルを変更するのは「スタート」が押された後だけにする
setInterval(function() {
  // タイマーが動いている、または1秒でも進んでいる、または試合終了している場合のみ実行
  if (isRunning || elapsedSeconds > 0 || isEnded) {
    const matchTitle = document.querySelector('.match-info-title').value.trim() || "大会名未定";
    // 画面のテキストではなく、変数から直接対戦カードを組み立てる
    const matchUp = (customTeamA && customTeamB) ? `${customTeamA} vs. ${customTeamB}` : "対戦カード未定";

    // ブラウザのタイトル（PDFの保存ファイル名）を「大会名 対戦カード」に更新（間に半角スペース）
    document.title = `${matchTitle} ${matchUp}`;
  }
}, 1000);

// ボタンが押されたときは、ただ印刷画面を呼び出すだけにする
function printToPDF() {
  window.print();
}

// ================= ブックマーク機能 =================
function toggleBookmark(id) {
  let log = matchLogs.find(l => l.id === id);
  if (log) {
    log.bookmarked = !log.bookmarked; // true/false を反転
    renderLogs(); // 画面を再描画
  }
}