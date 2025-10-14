function Page() {
    // square highlight duration
    const _stimulus_time = 500;
    // total time to wait for user input
    const _total_trial_time = 3000;

    var self = this; // for event handlers
    var startButton = document.getElementById('start-button');
    var continueButton = document.getElementById('continue-button');

    this.blockCreator = new BlockCreator(); // is a static class in the original silverlight app

    // Audio preloading and management
    this.audioElements = {};
    this.audioLoaded = {};
    this.audioLoadPromises = [];

    // Initialize audio elements
    for (var i = 1; i <= 8; i++) {
        this.audioElements['letter' + i] = document.getElementById('letter' + i);
        this.audioLoaded['letter' + i] = false;
    }

    // Preload all audio files
    this.preloadAudio = function() {
        console.log('[N-Back Audio] Starting audio preload...');

        for (var key in self.audioElements) {
            var audio = self.audioElements[key];

            // Setup load event listeners
            audio.addEventListener('canplaythrough', function() {
                var audioId = this.id;
                self.audioLoaded[audioId] = true;
                console.log('[N-Back Audio] Loaded:', audioId);
            }, { once: true });

            audio.addEventListener('error', function(e) {
                console.error('[N-Back Audio] Error loading:', this.id, e);
            });

            // Trigger load
            audio.load();
        }
    };

    // Safe play audio with error handling
    this.safePlayAudio = function(audioId) {
        var audio = self.audioElements[audioId];

        if (!audio) {
            console.warn('[N-Back Audio] Audio element not found:', audioId);
            return;
        }

        console.log('[N-Back Audio] Attempting to play:', audioId);

        // Reset audio to beginning if it's already playing
        audio.currentTime = 0;

        // Play with promise handling
        var playPromise = audio.play();

        if (playPromise !== undefined) {
            playPromise
                .then(function() {
                    console.log('[N-Back Audio] Successfully played:', audioId);
                })
                .catch(function(error) {
                    console.error('[N-Back Audio] Playback failed for', audioId, ':', error);
                    // Try to load and play again
                    audio.load();
                    setTimeout(function() {
                        audio.play().catch(function(e) {
                            console.error('[N-Back Audio] Retry failed for', audioId, ':', e);
                        });
                    }, 100);
                });
        }
    };

	// our list of trials
	this.m_Trials = [];

	// current block we're working on
	this._blockNum = 0;

	// current trial we're working on
	this._trialNum = 0;

	// starting value of n
	this._starting_N = 1;

	// value of n for the current block
	this._n = this._starting_N;

	// keeps track of the user's score
	this._score = new Score();

    // set to true whenever the game is running
    this._playingGame = false;

    // timers - from Page.xaml
    // initial wait - gap before the trial starts so the user can get ready
    // Timer_1 - for the stimulus, i.e. the square highlights
    // TrialTimer - total trial time, trial is ended when complete
    // _continurTimer - a timer to wait after the "continue" button has been clicked
    this.initialWait;
    this.Timer_1;
    this.TrialTimer;
    this._continueTimer;
    this._letterDisplayTimer = null; // timer for letter display cleanup

	DisplayN(this._starting_N);
 	setProgress(0);


 	// EVENTS
    startButton.addEventListener('click', function(event) {
        // check for start/pause via changing the text value of the button itself
        if(event.target.value == "Start") {
            event.target.value = "Pause";
            event.target.textContent = "Pause";
            // original timer = 675 * 10000 (675ms)
            // in setTimeout() the delay is in milliseconds
            // 'this' in an event handler is the object that fired the event
            self.initialWait = new Timer(self.Start_Training, 675);
        } else if(event.target.value == "Pause") {
            event.target.value = "Resume";
            event.target.textContent = "Resume";
            // pause all animations/timers
            self.Timer_1.pause();
            self.TrialTimer.pause();
        } else if(event.target.value == "Resume") {
            // continue from pause
            event.target.value = "Pause";
            event.target.textContent = "Pause";
            self.Timer_1.resume();
            self.TrialTimer.resume();
        }
    });

    document.addEventListener("keyup", function(event) {
      if(self._playingGame === true) {
        self._score.recordButtonPress(event.key);
      }
    }, false);

    continueButton.addEventListener('click', function(event) {
        if(event.target.value == "Continue") {
            // Close the modal
            document.getElementById('scoreModal').classList.remove('show');

            // Start a new block...
            setProgress(0);
            self._blockNum++;
            document.getElementById("session-number").innerHTML = (self._blockNum + 1).toString() +
                " / " + self.blockCreator.GetDefaultBlockSize().toString();

            self.m_Trials = self.blockCreator.createBlock(self._n);
            self._trialNum = 0;

            // Tell the user the n they're using
            DisplayN(self._n);
            self._score.startBlock(self._n);

            // Resume playing state and update start button
            self._playingGame = true;
            startButton.value = "Pause";
            startButton.textContent = "暂停";

            // Give the user a chance to catch their breath before starting the next block.
            self._continueTimer = new Timer(self.startBlock, 675);
        } else if(event.target.value == "Reset") {
            // Close the modal
            document.getElementById('scoreModal').classList.remove('show');

            event.target.value = "Continue";
            event.target.textContent = "继续";

            startButton.value = "Start";
            startButton.textContent = "开始";

            self._blockNum = 0;
            self._playingGame = false;
            self._trialNum = 0;
            self._n = self._starting_N;
            self._score._score = 0;
            setProgress(0);
            DisplayN(self._n);

            // reset session number
            document.getElementById("session-number").innerHTML = "1 / " +
                self.blockCreator.GetDefaultBlockSize().toString();
            document.getElementById("score-text").innerHTML = "0";
        }
    });


    // FUNCTIONS
    // callback for when the timer expires for the stimulus, hide the stimulus
    this.hideStimulus = function() {
    	// just clear all grid squares for ease
        document.getElementById("bottom-left").style.backgroundColor = "";
        document.getElementById("bottom-middle").style.backgroundColor = "";
        document.getElementById("bottom-right").style.backgroundColor = "";
        document.getElementById("middle-left").style.backgroundColor = "";
        document.getElementById("middle-right").style.backgroundColor = "";
        document.getElementById("top-left").style.backgroundColor = "";
        document.getElementById("top-middle").style.backgroundColor = "";
        document.getElementById("top-right").style.backgroundColor = "";

        // Also hide letter display if in silent mode
        var letterDisplay = document.getElementById("letter-display");
        if (letterDisplay) {
            letterDisplay.classList.remove('show');
        }
    }

 	this.Start_Training = function() {
 		self._playingGame = true;

        // we're starting, get the list of trials and clear the extra stuff
        self._n = self._starting_N;
        self._blockNum = 0;
        self._trialNum = 0;
        self.m_Trials = self.blockCreator.createBlock(self._n);
        self._score.startBlock(self._n);

        // present the first trial to the user
        self.presentTrialInfoToUser(self.m_Trials[self._trialNum]);
        self._score.startNewTrial(self.m_Trials[self._trialNum].GetSecondTrialInTarget);

        // start the timers for the first trial
        self.Timer_1 = new Timer(self.hideStimulus, _stimulus_time);
        self.TrialTimer = new Timer(self.trialTimeUp, _total_trial_time);
 	}

 	// called whenever the total time for an individual trial has expired
 	this.trialTimeUp = function() {
 		self._score.endTrial();
 		self._trialNum++;

        // clear feedback boxes
        // TODO - should be handled with an animation so the boxes
        // are only shaded for a brief period, fade-in-out
        document.getElementById("left-hand-feedback").style.backgroundColor = "";
        document.getElementById("right-hand-feedback").style.backgroundColor = "";

 		var progress = self._trialNum / self.m_Trials.length;
 		setProgress(progress * 100);

 		// are we at the end of a block?
 		if(self._trialNum >= self.m_Trials.length) {
 			// are we at the end of an entire session (20 blocks)?
 			if(self._blockNum == (self.blockCreator.GetNumBlocksTotal() - 1)) {
 				// what was the average n level?
 				var averageN = self._score.getMeanN();
 				document.getElementById("next-level-info").innerHTML = "你已完成所有训练回合，恭喜！<br>" +
                    "你的平均N级别为 " + averageN.toString();

 				if(self._score.getPercentGFIncrease() > 0) {
 					var gFIncrease = self._score.getPercentGFIncrease();
 					document.getElementById("next-level-info").innerHTML += "<br>" + gFIncrease.toString();
 				}

                // output last block score, note the original version doesn't do this
                document.getElementById("correct-audio-results").innerHTML = "听觉正确率：" +
                    (self.blockCreator.GetDefaultBlockSize() - self._score.audioMistakes()).toString() +
                    " / " + self.blockCreator.GetDefaultBlockSize().toString();
                document.getElementById("correct-visual-results").innerHTML = "视觉正确率：" +
                    (self.blockCreator.GetDefaultBlockSize() - self._score.visualMistakes()).toString() +
                    " / " + self.blockCreator.GetDefaultBlockSize().toString();

                // change button to reset to start a brand new trial
                continueButton.value = "Reset";
                continueButton.textContent = "重置";

                // reset start button to initial state
                startButton.value = "Start";
                startButton.textContent = "开始";
                self._playingGame = false;

                // save current N level to localStorage
                if (typeof saveCurrentLevel === 'function') {
                    saveCurrentLevel(self._n);
                }

                // save progress
                addSessionToHistory(Date.now(), averageN);

                document.getElementById('scoreModal').classList.add('show');
                return;
 			}

 			// end the block, output results
            document.getElementById("correct-audio-results").innerHTML = "听觉正确率：" +
                (self.blockCreator.GetDefaultBlockSize() - self._score.audioMistakes()).toString() +
                " / " + self.blockCreator.GetDefaultBlockSize().toString();
            document.getElementById("correct-visual-results").innerHTML = "视觉正确率：" +
                (self.blockCreator.GetDefaultBlockSize() - self._score.visualMistakes()).toString() +
                " / " + self.blockCreator.GetDefaultBlockSize().toString();
 			var deltaN = self._score.endBlock();
 			if((deltaN + self._n) >= 2) {
 				self._n = self._n + deltaN;
 			}

 			// display the next trial level (N number) in the popup
            document.getElementById("next-level-info").innerHTML = "下一级别：" + self._n.toString();

            // save current N level to localStorage
            if (typeof saveCurrentLevel === 'function') {
                saveCurrentLevel(self._n);
            }

            // reset start button to show block has ended
            startButton.value = "Start";
            startButton.textContent = "开始";
            self._playingGame = false;

            // display results dialog
            document.getElementById('scoreModal').classList.add('show');
            return;
 		}

 		// start a new trial
 		self._score.startNewTrial(self.m_Trials[self._trialNum].GetSecondTrialInTarget());
 		self.presentTrialInfoToUser(self.m_Trials[self._trialNum]);

        self.Timer_1 = new Timer(self.hideStimulus, _stimulus_time);
        self.TrialTimer = new Timer(self.trialTimeUp, _total_trial_time);
 	}

 	this.startBlock = function() {
 		// start a new trial
 		self._score.startNewTrial(self.m_Trials[self._trialNum].GetSecondTrialInTarget());
 		self.presentTrialInfoToUser(self.m_Trials[self._trialNum]);

        window.clearTimeout(self.Timer_1);
        window.clearTimeout(self.TrialTimer);
        self.Timer_1 = new Timer(self.hideStimulus, _stimulus_time);
        self.TrialTimer = new Timer(self.trialTimeUp, _total_trial_time);
 	}


 	// display trial information (square, audio, etc.) to the user
 	this.presentTrialInfoToUser = function(t) {
 		// Letter mapping for visual display
 		var letterMap = {
 			'Letter1': 'C',
 			'Letter2': 'H',
 			'Letter3': 'K',
 			'Letter4': 'L',
 			'Letter5': 'Q',
 			'Letter6': 'R',
 			'Letter7': 'T',
 			'Letter8': 'W'
 		};

 		var letterKey = Object.keys(Consonant).find(function(key) {
 			return Consonant[key] === t.GetLetter();
 		});

 		// Check if silent mode is enabled
 		var isSilentMode = window.nbackSilentMode === true;

 		if (isSilentMode) {
 			// Silent mode: Display letter visually
 			var letterDisplay = document.getElementById("letter-display");
 			if (letterDisplay && letterKey) {
 				// Clear any existing letter display timer to prevent overlap
 				if (self._letterDisplayTimer) {
 					clearTimeout(self._letterDisplayTimer);
 					self._letterDisplayTimer = null;
 				}

 				// Immediately update letter and show
 				letterDisplay.textContent = letterMap[letterKey] || '';
 				letterDisplay.classList.remove('show'); // force reflow
 				setTimeout(function() {
 					letterDisplay.classList.add('show');
 				}, 10);

 				// Hide letter after stimulus time (500ms) - this will be also handled by hideStimulus
 				self._letterDisplayTimer = setTimeout(function() {
 					letterDisplay.classList.remove('show');
 					self._letterDisplayTimer = null;
 				}, _stimulus_time);
 			}
 		} else {
 			// Normal mode: Play audio using safe play method
 			switch(t.GetLetter()) {
 				case Consonant.Letter1:
 					self.safePlayAudio("letter1");
 					break;

				case Consonant.Letter2:
 					self.safePlayAudio("letter2");
 					break;

				case Consonant.Letter3:
 					self.safePlayAudio("letter3");
 					break;

				case Consonant.Letter4:
 					self.safePlayAudio("letter4");
 					break;

				case Consonant.Letter5:
 					self.safePlayAudio("letter5");
 					break;

				case Consonant.Letter6:
 					self.safePlayAudio("letter6");
 					break;

				case Consonant.Letter7:
 					self.safePlayAudio("letter7");
 					break;

				case Consonant.Letter8:
 					self.safePlayAudio("letter8");
 					break;

				default:
 					break;
 			}
 		}

 		// display the visual information
 		switch(t.GetPosition()) {
 			case SquarePosition.BottomLeft:
 				document.getElementById("bottom-left").style.backgroundColor = "orange";
 				break;

			case SquarePosition.BottomMiddle:
 				document.getElementById("bottom-middle").style.backgroundColor = "orange";
 				break;

			case SquarePosition.BottomRight:
 				document.getElementById("bottom-right").style.backgroundColor = "orange";
 				break;

			case SquarePosition.MiddleLeft:
 				document.getElementById("middle-left").style.backgroundColor = "orange";
 				break;

			case SquarePosition.MiddleRight:
 				document.getElementById("middle-right").style.backgroundColor = "orange";
 				break;

			case SquarePosition.TopLeft:
 				document.getElementById("top-left").style.backgroundColor = "orange";
 				break;

			case SquarePosition.TopMiddle:
 				document.getElementById("top-middle").style.backgroundColor = "orange";
 				break;

			case SquarePosition.TopRight:
 				document.getElementById("top-right").style.backgroundColor = "orange";
 				break;

			default:
 				break;
 		}
 	}
}


function handleScores(totalScore) {
    document.getElementById("score-text").innerHTML = totalScore.toString();
}


// called via an event to say if there was a trial success or failure
// highlights the left/right areas of the grid for success/failure feedback
// Page & Score access need access to this function
function handleTrialResult(result) {
    if(result == TrialResult.Visual_Success) {
        document.getElementById("left-hand-feedback").style.backgroundColor = "green";
    } else if(result == TrialResult.Visual_Failure) {
        document.getElementById("left-hand-feedback").style.backgroundColor = "red";
    }
    if(result == TrialResult.Audio_Success) {
        document.getElementById("right-hand-feedback").style.backgroundColor = "green";
    } else if(result == TrialResult.Audio_Failure) {
        document.getElementById("right-hand-feedback").style.backgroundColor = "red";
    }
}


// display appropriate N to user
// Updated to show clearer format: "当前难度：N=X"
function DisplayN(n) {
    var displayElement = document.getElementById("current-n-display");
    if (displayElement) {
        displayElement.textContent = "当前难度：N=" + n.toString();
    }
}

// set progress bar value
// from ProgressBar.xaml.cs
function setProgress(prog) {
    if((prog > 100) || (prog < 0)) {
        return;
    }

    document.getElementById("prog-bar").style.width = prog + "%";
}

// setTimeout wrapper to include pause functionality
// source: http://stackoverflow.com/questions/3969475/javascript-pause-settimeout
function Timer(callback, delay) {
    var timerId;
    var start;
    var remaining = delay;

    this.pause = function() {
        window.clearTimeout(timerId);
        remaining -= new Date() - start;
    };

    this.resume = function() {
        start = new Date();
        window.clearTimeout(timerId);
        timerId = window.setTimeout(callback, remaining);
    };

    this.resume();
}
