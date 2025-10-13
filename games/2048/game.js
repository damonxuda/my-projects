// 2048 Game - UI and Interaction Logic
// Adapted for 子杰之家 games module with authentication and cloud sync

(function() {
  // Storage Manager with Cloud Sync
  function StorageManager() {
    this.gameStateKey = 'game2048State';
    this.bestScoreKey = 'game2048BestScore';
    this.storage = null;

    // Initialize SmartGameStorage when available
    this.initStorage();
  }

  StorageManager.prototype.initStorage = function() {
    // Wait for SmartGameStorage to be available
    if (window.Smart2048Storage) {
      this.storage = new window.Smart2048Storage();
      console.log('✅ 2048 Storage initialized with cloud sync');
    }
  };

  StorageManager.prototype.getGameState = function() {
    if (this.storage) {
      // This will be async, but for now use localStorage for compatibility
      var stateString = localStorage.getItem(this.gameStateKey);
      return stateString ? JSON.parse(stateString) : null;
    }
    return null;
  };

  StorageManager.prototype.setGameState = function(gameState) {
    if (this.storage) {
      localStorage.setItem(this.gameStateKey, JSON.stringify(gameState));
      // Async save to cloud
      this.storage.saveGameState(gameState).catch(function(err) {
        console.warn('Cloud save failed:', err);
      });
    } else {
      localStorage.setItem(this.gameStateKey, JSON.stringify(gameState));
    }
  };

  StorageManager.prototype.clearGameState = function() {
    localStorage.removeItem(this.gameStateKey);
    if (this.storage) {
      this.storage.clearGameState().catch(function(err) {
        console.warn('Cloud clear failed:', err);
      });
    }
  };

  StorageManager.prototype.getBestScore = function() {
    if (this.storage) {
      var score = localStorage.getItem(this.bestScoreKey);
      return score ? parseInt(score, 10) : 0;
    }
    return 0;
  };

  StorageManager.prototype.setBestScore = function(score) {
    localStorage.setItem(this.bestScoreKey, score);
    if (this.storage) {
      this.storage.saveBestScore(score).catch(function(err) {
        console.warn('Cloud save best score failed:', err);
      });
    }
  };

  // HTML Actuator - Renders the game state to DOM
  function HTMLActuator() {
    this.tileContainer = document.querySelector('.tile-container');
    this.scoreContainer = document.querySelector('.score-container');
    this.bestContainer = document.querySelector('.best-container');
    this.messageContainer = document.querySelector('.game-message');

    this.score = 0;
  }

  HTMLActuator.prototype.actuate = function(grid, metadata) {
    var self = this;

    window.requestAnimationFrame(function() {
      self.clearContainer(self.tileContainer);

      grid.cells.forEach(function(column) {
        column.forEach(function(cell) {
          if (cell) {
            self.addTile(cell);
          }
        });
      });

      self.updateScore(metadata.score);
      self.updateBestScore(metadata.bestScore);

      if (metadata.terminated) {
        if (metadata.over) {
          self.message(false); // Game over
        } else if (metadata.won) {
          self.message(true); // You won!
        }
      }
    });
  };

  HTMLActuator.prototype.clearContainer = function(container) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  };

  HTMLActuator.prototype.addTile = function(tile) {
    var self = this;
    var wrapper = document.createElement('div');
    var inner = document.createElement('div');
    var position = tile.previousPosition || { x: tile.x, y: tile.y };
    var positionClass = this.positionClass(position);

    var classes = ['tile', 'tile-' + tile.value, positionClass];

    if (tile.value > 2048) classes.push('tile-super');

    this.applyClasses(wrapper, classes);

    inner.classList.add('tile-inner');
    inner.textContent = tile.value;

    if (tile.previousPosition) {
      window.requestAnimationFrame(function() {
        classes[2] = self.positionClass({ x: tile.x, y: tile.y });
        self.applyClasses(wrapper, classes);
      });
    } else if (tile.mergedFrom) {
      classes.push('tile-merged');
      this.applyClasses(wrapper, classes);

      tile.mergedFrom.forEach(function(merged) {
        self.addTile(merged);
      });
    } else {
      classes.push('tile-new');
      this.applyClasses(wrapper, classes);
    }

    wrapper.appendChild(inner);
    this.tileContainer.appendChild(wrapper);
  };

  HTMLActuator.prototype.applyClasses = function(element, classes) {
    element.setAttribute('class', classes.join(' '));
  };

  HTMLActuator.prototype.positionClass = function(position) {
    return 'tile-position-' + (position.x + 1) + '-' + (position.y + 1);
  };

  HTMLActuator.prototype.updateScore = function(score) {
    this.clearContainer(this.scoreContainer);

    var difference = score - this.score;
    this.score = score;

    this.scoreContainer.textContent = this.score;

    if (difference > 0) {
      var addition = document.createElement('div');
      addition.classList.add('score-addition');
      addition.textContent = '+' + difference;

      this.scoreContainer.appendChild(addition);
    }
  };

  HTMLActuator.prototype.updateBestScore = function(bestScore) {
    this.bestContainer.textContent = bestScore;
  };

  HTMLActuator.prototype.message = function(won) {
    var type = won ? 'game-won' : 'game-over';
    var message = won ? '你赢了！' : '游戏结束！';

    this.messageContainer.classList.add(type);
    this.messageContainer.getElementsByTagName('p')[0].textContent = message;
  };

  HTMLActuator.prototype.clearMessage = function() {
    this.messageContainer.classList.remove('game-won');
    this.messageContainer.classList.remove('game-over');
  };

  // Keyboard Input Manager
  function KeyboardInputManager() {
    this.events = {};

    this.listen();
  }

  KeyboardInputManager.prototype.on = function(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  };

  KeyboardInputManager.prototype.emit = function(event, data) {
    var callbacks = this.events[event];
    if (callbacks) {
      callbacks.forEach(function(callback) {
        callback(data);
      });
    }
  };

  KeyboardInputManager.prototype.listen = function() {
    var self = this;

    var map = {
      38: 0, // Up
      39: 1, // Right
      40: 2, // Down
      37: 3, // Left
      87: 0, // W
      68: 1, // D
      83: 2, // S
      65: 3  // A
    };

    document.addEventListener('keydown', function(event) {
      var modifiers = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
      var mapped = map[event.which];

      if (!modifiers) {
        if (mapped !== undefined) {
          event.preventDefault();
          self.emit('move', mapped);
        }
      }

      if (!modifiers && event.which === 82) {
        self.restart.call(self, event);
      }
    });

    this.bindButtonPress('.retry-button', this.restart);
    this.bindButtonPress('.restart-button', this.restart);
    this.bindButtonPress('.keep-playing-button', this.keepPlaying);

    // Touch events
    var touchStartClientX, touchStartClientY;
    var gameContainer = document.getElementsByClassName('game-container')[0];

    gameContainer.addEventListener('touchstart', function(event) {
      if ((!window.navigator.msPointerEnabled && event.touches.length > 1) ||
          event.targetTouches.length > 1) {
        return;
      }

      if (window.navigator.msPointerEnabled) {
        touchStartClientX = event.pageX;
        touchStartClientY = event.pageY;
      } else {
        touchStartClientX = event.touches[0].clientX;
        touchStartClientY = event.touches[0].clientY;
      }

      event.preventDefault();
    });

    gameContainer.addEventListener('touchmove', function(event) {
      event.preventDefault();
    });

    gameContainer.addEventListener('touchend', function(event) {
      if ((!window.navigator.msPointerEnabled && event.touches.length > 0) ||
          event.targetTouches.length > 0) {
        return;
      }

      var touchEndClientX, touchEndClientY;

      if (window.navigator.msPointerEnabled) {
        touchEndClientX = event.pageX;
        touchEndClientY = event.pageY;
      } else {
        touchEndClientX = event.changedTouches[0].clientX;
        touchEndClientY = event.changedTouches[0].clientY;
      }

      var dx = touchEndClientX - touchStartClientX;
      var absDx = Math.abs(dx);

      var dy = touchEndClientY - touchStartClientY;
      var absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) > 10) {
        self.emit('move', absDx > absDy ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
      }
    });
  };

  KeyboardInputManager.prototype.restart = function(event) {
    event.preventDefault();
    this.emit('restart');
  };

  KeyboardInputManager.prototype.keepPlaying = function(event) {
    event.preventDefault();
    this.emit('keepPlaying');
  };

  KeyboardInputManager.prototype.bindButtonPress = function(selector, fn) {
    var button = document.querySelector(selector);
    if (button) {
      button.addEventListener('click', fn.bind(this));
      button.addEventListener('touchend', fn.bind(this));
    }
  };

  // Application Controller
  function Application() {
    this.storageManager = new StorageManager();
    this.inputManager = new KeyboardInputManager();
    this.actuator = new HTMLActuator();

    this.inputManager.on('move', this.move.bind(this));
    this.inputManager.on('restart', this.restart.bind(this));
    this.inputManager.on('keepPlaying', this.keepPlaying.bind(this));

    this.setup();
  }

  Application.prototype.setup = function() {
    var previousState = this.storageManager.getGameState();

    this.gameManager = new GameManager(4, this.storageManager);

    this.actuator.actuate(this.gameManager.grid, {
      score: this.gameManager.score,
      over: this.gameManager.over,
      won: this.gameManager.won,
      bestScore: this.storageManager.getBestScore(),
      terminated: this.gameManager.isGameTerminated()
    });
  };

  Application.prototype.restart = function() {
    this.actuator.clearMessage();
    this.gameManager.restart();
    this.actuator.actuate(this.gameManager.grid, {
      score: this.gameManager.score,
      over: this.gameManager.over,
      won: this.gameManager.won,
      bestScore: this.storageManager.getBestScore(),
      terminated: this.gameManager.isGameTerminated()
    });
  };

  Application.prototype.keepPlaying = function() {
    this.gameManager.keepPlaying();
    this.actuator.clearMessage();
  };

  Application.prototype.move = function(direction) {
    var moved = this.gameManager.move(direction);

    if (moved) {
      if (this.gameManager.score > this.storageManager.getBestScore()) {
        this.storageManager.setBestScore(this.gameManager.score);
      }

      this.actuator.actuate(this.gameManager.grid, {
        score: this.gameManager.score,
        over: this.gameManager.over,
        won: this.gameManager.won,
        bestScore: this.storageManager.getBestScore(),
        terminated: this.gameManager.isGameTerminated()
      });
    }
  };

  // Initialize the game when page loads
  window.addEventListener('load', function() {
    // Wait for Clerk to initialize
    window.addEventListener('clerkReady', function() {
      console.log('🎮 2048 Game - Clerk ready, initializing game');
      window.game2048 = new Application();
    });

    // Fallback if Clerk doesn't initialize
    setTimeout(function() {
      if (!window.game2048) {
        console.log('🎮 2048 Game - Starting without Clerk');
        window.game2048 = new Application();
      }
    }, 3000);
  });
})();
