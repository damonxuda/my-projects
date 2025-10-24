var progressLink = document.getElementById("progress-link");

// Is local storage available?
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
function storageAvailable(type) {
	try {
		var storage = window[type];
		var x = '__storage_test__';
		storage.setItem(x, x);
		storage.removeItem(x);
		return true;
	}
	catch(e) {
		return false;
	}
}

// 初始化游戏存储管理器（直接连接 Supabase）
var gameStorage = null;
try {
	gameStorage = new SmartGameStorage('nback');
} catch (e) {
	console.warn('[N-Back] SmartGameStorage初始化失败:', e);
}

// adds a completed session to a user's history
// if local storage is available, and the save toggle is on
async function addSessionToHistory(date, meanN) {
	// 1. 保存历史记录到本地（用于显示历史列表）
	if(storageAvailable('localStorage') && $("#save-toggle").prop('checked')) {
		localStorage.setItem(date, meanN);
	}

	// 2. 使用SmartGameStorage保存游戏进度（自动处理本地/云端同步）
	if (gameStorage && $("#save-toggle").prop('checked')) {
		try {
			console.log('[N-Back] 保存游戏进度:', { meanN });

			// 从localStorage获取当前N级别，如果没有则使用meanN
			let currentN = meanN;
			if (typeof getCurrentLevel === 'function') {
				const savedN = getCurrentLevel();
				if (savedN) {
					currentN = savedN;
				}
			}

			// 保存游戏进度数据
			await gameStorage.save('progress', {
				current_n: currentN,
				last_score: meanN,
				updated_at: new Date().toISOString()
			});

			console.log('[N-Back] ✅ 游戏进度保存成功');
		} catch (error) {
			console.error('[N-Back] ❌ 保存游戏进度失败:', error);
		}
	}
}

// gets all items in history and prints them to the appropriate element
function printHistory() {
	var tableOutput = document.getElementById("progress-score-table");

	// remove previous score rows, leaving the header row intact
	var scoreRows = document.getElementsByClassName("score-row");
	while(scoreRows.length > 0) {
		scoreRows[0].parentNode.removeChild(scoreRows[0]);
	}

	if(storageAvailable('localStorage')) {
		for(var i = 0; i < localStorage.length; i++) {
			var key = localStorage.key(i);
			var value = localStorage[key];
			var keyDate = new Date();
			keyDate.setTime(parseInt(key));
			var dateOptions = {
				weekday: "short",
				year: "numeric",
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit"
			};

			var tableRow = document.createElement('tr');
			tableRow.setAttribute('class', 'score-row');
			var rowNum = document.createElement('td');
			var rowDate = document.createElement('td');
			var rowScore = document.createElement('td');

			var rowNumText = document.createTextNode(i + 1);
			var rowDateText = document.createTextNode(keyDate.toLocaleTimeString("en-GB", dateOptions));
			var rowScoreText = document.createTextNode(value);

			rowNum.appendChild(rowNumText);
			rowDate.appendChild(rowDateText);
			rowScore.appendChild(rowScoreText);

			tableRow.appendChild(rowNum);
			tableRow.appendChild(rowDate);
			tableRow.appendChild(rowScore);

			tableOutput.appendChild(tableRow);
		}
	} else {
		tableOutput.appendChild(document.createTextNode("Local storage isn't available in your browser so your scores cannot be saved"));
	}
}

// clears the history
function clearHistory() {
	localStorage.clear();
}

// show progress click event handler
progressLink.addEventListener('click', function(event) {
	printHistory();
	$('#progressModal').modal('show');
});