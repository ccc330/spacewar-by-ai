// 游戏主类
class SpacewarGame {
    constructor() {
        // 获取画布和上下文
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 设置画布尺寸
        this.canvas.width = 380;
        this.canvas.height = 500;
        
        // 游戏状态
        this.gameRunning = false;
        this.gamePaused = false;
        
        // 得分相关
        this.score = 0;
        this.highScore = localStorage.getItem('highScore') || 0;
        
        // 游戏元素
        this.player = null;
        this.enemies = [];
        this.bullets = [];
        this.explosions = [];
        
        // 星空背景元素
        this.stars = [];
        this.numStars = 100; // 星星数量
        this.initStars(); // 初始化星空
        
        // 游戏计时和速度
        this.lastEnemySpawn = 0;
        this.enemySpawnInterval = 1500; // 敌人生成间隔(ms)默认值提高
        this.lastFrameTime = 0;
        this.lastBulletTime = 0; // 用于触摸控制时限制射击频率
        this.gameTime = 0; // 游戏运行时间计数（毫秒）
        this.currentGameTime = 0; // 当前局游戏时间（毫秒）
        
        // 难度系统
        this.waveController = new WaveController();
        this.currentPhase = 'normal'; // 当前游戏阶段：normal, rush, boss
        this.phaseTime = 0; // 当前阶段已运行时间
        this.normalPhaseDuration = 20000; // 普通阶段持续20秒
        this.rushPhaseDuration = 15000; // 暴走阶段持续15秒
        this.isWarningActive = false; // 警告特效标志
        this.warningAlpha = 0; // 警告特效透明度
        
        // 敌人编队系统
        this.formationActive = false; // 当前是否有编队
        this.formationEnemies = []; // 编队中的敌人
        this.formationDelay = 0; // 编队生成间隔计时
        this.formationIndex = 0; // 当前编队中的敌人索引
        
        // 初始化音频环境
        this.audioContext = null;
        this.bgmNodes = null; // 存储BGM的音频节点
        this.bgmPlaying = false; // BGM播放状态
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API不受支持，将没有音效:', e);
        }
        
        // 加载资源
        this.loadAssets();
        
        // 初始化事件监听
        this.initEventListeners();
        
        // 初始化界面
        this.updateScoreDisplay();
        this.updatePhaseDisplay();
        
        // 移动设备检测
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    // 加载游戏资源
    loadAssets() {
        // 加载图像
        this.playerImage = new Image();
        this.playerImage.src = 'static/player.png';
        
        this.enemyImage = new Image();
        this.enemyImage.src = 'static/enemy.png';
        
        this.bulletImage = new Image();
        this.bulletImage.src = 'static/bullet.png';
        
        // 加载高速敌人图像
        this.fastEnemyImage = new Image();
        this.fastEnemyImage.src = 'static/fast_enemy.png';
        
        // 加载装甲敌人图像
        this.armoredEnemyImage = new Image();
        this.armoredEnemyImage.src = 'static/armored_enemy.png';
    }
    
    // 播放爆炸音效
    playExplosion() {
        if (!this.audioContext) return;
        
        // 创建主振荡器（低频爆炸声）
        const mainOsc = this.audioContext.createOscillator();
        const mainGain = this.audioContext.createGain();
        mainOsc.type = "sine";
        mainOsc.frequency.setValueAtTime(100, this.audioContext.currentTime);
        mainOsc.frequency.exponentialRampToValueAtTime(30, this.audioContext.currentTime + 0.4);
        mainGain.gain.setValueAtTime(1, this.audioContext.currentTime);
        mainGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.4);
        
        // 创建噪声（爆炸碎片声）
        const noiseGain = this.audioContext.createGain();
        const bufferSize = 2 * this.audioContext.sampleRate;
        const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        const noise = this.audioContext.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;
        
        // 控制噪声音量
        noiseGain.gain.setValueAtTime(0.6, this.audioContext.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
        
        // 创建高频振荡器（爆炸尖锐声）
        const highOsc = this.audioContext.createOscillator();
        const highGain = this.audioContext.createGain();
        highOsc.type = "sawtooth";
        highOsc.frequency.setValueAtTime(800, this.audioContext.currentTime);
        highOsc.frequency.exponentialRampToValueAtTime(300, this.audioContext.currentTime + 0.1);
        highGain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        highGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
        
        // 连接所有音频节点
        mainOsc.connect(mainGain);
        noise.connect(noiseGain);
        highOsc.connect(highGain);
        
        // 增加失真效果以增强爆炸感
        const distortion = this.audioContext.createWaveShaper();
        function makeDistortionCurve(amount) {
            const k = typeof amount === 'number' ? amount : 50;
            const n_samples = 44100;
            const curve = new Float32Array(n_samples);
            const deg = Math.PI / 180;
            for (let i = 0; i < n_samples; ++i) {
                const x = i * 2 / n_samples - 1;
                curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
            }
            return curve;
        }
        distortion.curve = makeDistortionCurve(50);
        distortion.oversample = '4x';
        
        // 最终音量控制
        const masterGain = this.audioContext.createGain();
        masterGain.gain.setValueAtTime(0.5, this.audioContext.currentTime);
        
        // 连接到失真和主输出
        mainGain.connect(distortion);
        noiseGain.connect(distortion);
        highGain.connect(distortion);
        distortion.connect(masterGain);
        masterGain.connect(this.audioContext.destination);
        
        // 开始所有声音
        mainOsc.start();
        noise.start();
        highOsc.start();
        
        // 停止所有声音
        mainOsc.stop(this.audioContext.currentTime + 0.5);
        noise.stop(this.audioContext.currentTime + 0.5);
        highOsc.stop(this.audioContext.currentTime + 0.5);
    }
    
    // 初始化事件监听
    initEventListeners() {
        // 开始按钮
        document.getElementById('startBtn').addEventListener('click', () => {
            if (!this.gameRunning) {
                this.startGame();
            }
        });
        
        // 暂停按钮
        document.getElementById('pauseBtn').addEventListener('click', () => {
            if (this.gameRunning) {
                this.togglePause();
            }
        });
        
        // 音乐按钮
        document.getElementById('musicBtn').addEventListener('click', () => {
            this.toggleBGM();
        });
        
        // 重新开始按钮
        document.getElementById('restartBtn').addEventListener('click', () => {
            document.getElementById('gameOver').classList.add('hidden');
            this.startGame();
        });
        
        // 操作说明按钮
        document.getElementById('instructionBtn').addEventListener('click', () => {
            document.getElementById('instructionModal').classList.remove('hidden');
        });
        
        // 游戏规则按钮
        document.getElementById('rulesBtn').addEventListener('click', () => {
            document.getElementById('rulesModal').classList.remove('hidden');
        });
        
        // 关闭操作说明弹窗
        document.getElementById('closeModal').addEventListener('click', () => {
            document.getElementById('instructionModal').classList.add('hidden');
        });
        
        // 关闭游戏规则弹窗
        document.getElementById('closeRulesModal').addEventListener('click', () => {
            document.getElementById('rulesModal').classList.add('hidden');
        });
        
        // 点击弹窗外部区域关闭弹窗
        document.getElementById('instructionModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('instructionModal')) {
                document.getElementById('instructionModal').classList.add('hidden');
            }
        });
        
        document.getElementById('rulesModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('rulesModal')) {
                document.getElementById('rulesModal').classList.add('hidden');
            }
        });
        
        // 键盘控制
        window.addEventListener('keydown', (e) => {
            if (this.player) {
                this.player.handleKeyDown(e.key);
            }
            
            // 空格键发射子弹
            if (e.key === ' ' && this.gameRunning && !this.gamePaused) {
                this.fireBullet();
            }
            
            // P键暂停
            if (e.key === 'p' && this.gameRunning) {
                this.togglePause();
            }
            
            // ESC键关闭弹窗
            if (e.key === 'Escape') {
                if (!document.getElementById('instructionModal').classList.contains('hidden')) {
                    document.getElementById('instructionModal').classList.add('hidden');
                }
                if (!document.getElementById('rulesModal').classList.contains('hidden')) {
                    document.getElementById('rulesModal').classList.add('hidden');
                }
            }
        });
        
        window.addEventListener('keyup', (e) => {
            if (this.player) {
                this.player.handleKeyUp(e.key);
            }
        });
        
        // 触摸控制（移动端）
        this.canvas.addEventListener('touchstart', (e) => {
            if (this.gameRunning && !this.gamePaused) {
                e.preventDefault();
                const rect = this.canvas.getBoundingClientRect();
                const touch = e.touches[0];
                
                if (this.player) {
                    this.player.x = touch.clientX - rect.left - this.player.width / 2;
                    this.player.y = touch.clientY - rect.top - this.player.height / 2;
                }
            }
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            if (this.gameRunning && !this.gamePaused) {
                e.preventDefault();
                const rect = this.canvas.getBoundingClientRect();
                const touch = e.touches[0];
                
                if (this.player) {
                    this.player.x = touch.clientX - rect.left - this.player.width / 2;
                    this.player.y = touch.clientY - rect.top - this.player.height / 2;
                    
                    // 在移动时自动发射子弹（限制频率）
                    if (performance.now() - this.lastBulletTime > 300) {
                        this.fireBullet();
                        this.lastBulletTime = performance.now();
                    }
                }
            }
        });
    }
    
    // 创建并播放8-bit风格的BGM
    createAndPlayBGM() {
        if (!this.audioContext) return;
        
        // 停止之前的BGM（如果有）
        if (this.bgmNodes) {
            this.stopBGM();
        }
        
        // 创建BGM音频节点
        this.bgmNodes = {};
        
        // 主音量控制
        const masterGain = this.audioContext.createGain();
        masterGain.gain.value = 0.2; // 设置较低的音量
        masterGain.connect(this.audioContext.destination);
        this.bgmNodes.masterGain = masterGain;
        
        // 创建音序器
        this.bgmNodes.currentNote = 0;
        this.bgmNodes.nextNoteTime = this.audioContext.currentTime;
        
        // 定义简单的8-bit风格旋律（半音符号：C4=60, C#4=61等）
        // 每组数字表示[音符, 持续时间(秒)]
        this.bgmNodes.melody = [
            [64, 0.2], [67, 0.2], [71, 0.2], [67, 0.2], // 简单的升调序列
            [64, 0.2], [67, 0.2], [71, 0.2], [76, 0.3], // 继续升调
            [71, 0.2], [67, 0.2], [64, 0.2], [67, 0.2], // 降调序列
            [59, 0.2], [62, 0.2], [67, 0.3], [64, 0.3]  // 结束序列
        ];
        
        // 创建低通滤波器以获得更复古的声音
        const filter = this.audioContext.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 1100;
        filter.Q.value = 3;
        filter.connect(masterGain);
        this.bgmNodes.filter = filter;
        
        // 设置定时器以定期调度音符
        this.bgmNodes.intervalId = setInterval(() => {
            this.scheduleNote();
        }, 100);
        
        this.bgmPlaying = true;
    }
    
    // 调度下一个音符
    scheduleNote() {
        if (!this.audioContext || !this.bgmNodes) return;
        
        // 获取当前时间和下一个音符时间
        const currentTime = this.audioContext.currentTime;
        
        // 如果还没到播放下一个音符的时间，直接返回
        if (currentTime < this.bgmNodes.nextNoteTime) return;
        
        // 从旋律中获取音符和持续时间
        const noteInfo = this.bgmNodes.melody[this.bgmNodes.currentNote];
        const midiNote = noteInfo[0];
        const duration = noteInfo[1];
        
        // 创建振荡器并设置频率（MIDI音符转换为频率）
        const oscillator = this.audioContext.createOscillator();
        oscillator.type = "square"; // 方波，产生8-bit风格声音
        
        // MIDI音符转换为频率: 440 * 2^((n-69)/12)
        oscillator.frequency.value = 440 * Math.pow(2, (midiNote - 69) / 12);
        
        // 创建振幅包络
        const envelope = this.audioContext.createGain();
        envelope.gain.setValueAtTime(0, currentTime);
        envelope.gain.linearRampToValueAtTime(0.3, currentTime + 0.01);
        envelope.gain.linearRampToValueAtTime(0.2, currentTime + duration - 0.05);
        envelope.gain.linearRampToValueAtTime(0, currentTime + duration);
        
        // 连接音频节点
        oscillator.connect(envelope);
        envelope.connect(this.bgmNodes.filter);
        
        // 播放音符
        oscillator.start(currentTime);
        oscillator.stop(currentTime + duration);
        
        // 更新下一个音符时间
        this.bgmNodes.nextNoteTime = currentTime + duration;
        
        // 移动到下一个音符
        this.bgmNodes.currentNote = (this.bgmNodes.currentNote + 1) % this.bgmNodes.melody.length;
    }
    
    // 停止BGM
    stopBGM() {
        if (!this.bgmNodes) return;
        
        // 清除定时器
        if (this.bgmNodes.intervalId) {
            clearInterval(this.bgmNodes.intervalId);
        }
        
        // 渐弱音量（如果可能）
        if (this.bgmNodes.masterGain) {
            const now = this.audioContext.currentTime;
            this.bgmNodes.masterGain.gain.linearRampToValueAtTime(0, now + 0.5);
        }
        
        // 清除节点引用
        setTimeout(() => {
            this.bgmNodes = null;
        }, 500);
        
        this.bgmPlaying = false;
    }
    
    // 切换BGM播放状态
    toggleBGM() {
        if (this.bgmPlaying) {
            this.stopBGM();
        } else {
            this.createAndPlayBGM();
        }
    }
    
    // 开始游戏
    startGame() {
        // 如果有音频上下文且处于暂停状态，恢复它
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        // 开始播放BGM
        this.createAndPlayBGM();
        
        this.resetGame();
        this.gameRunning = true;
        this.gamePaused = false;
        this.player = new Player(this.canvas.width / 2 - 16, this.canvas.height - 50);
        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    // 重置游戏状态
    resetGame() {
        this.score = 0;
        this.updateScoreDisplay();
        this.enemies = [];
        this.bullets = [];
        this.explosions = [];
        this.lastEnemySpawn = 0;
        this.enemySpawnInterval = 1500;
        this.gameTime = 0;
        this.currentGameTime = 0; // 重置当前局游戏时间
        this.currentPhase = 'normal';
        this.phaseTime = 0;
        this.updatePhaseDisplay();
    }
    
    // 切换暂停状态
    togglePause() {
        this.gamePaused = !this.gamePaused;
        
        // 暂停/恢复BGM
        if (this.gamePaused) {
            if (this.audioContext && this.audioContext.state === 'running') {
                this.audioContext.suspend();
            }
        } else {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            this.lastFrameTime = performance.now();
            requestAnimationFrame(this.gameLoop.bind(this));
        }
    }
    
    // 更新分数显示
    updateScoreDisplay() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('highScore').textContent = this.highScore;
    }
    
    // 发射子弹
    fireBullet() {
        if (this.player) {
            const bulletX = this.player.x + 12; // 子弹从飞机中央发射
            const bulletY = this.player.y - 8;
            this.bullets.push(new Bullet(bulletX, bulletY));
        }
    }
    
    // 更新阶段显示
    updatePhaseDisplay() {
        const phaseText = document.getElementById('currentPhase');
        if (phaseText) {
            let displayText = '';
            switch (this.currentPhase) {
                case 'normal':
                    displayText = '普通阶段';
                    break;
                case 'rush':
                    displayText = '⚠️ 暴走阶段 ⚠️';
                    break;
                case 'boss':
                    displayText = '👾 BOSS战 👾';
                    break;
            }
            phaseText.textContent = displayText;
            
            // 更新阶段样式
            phaseText.className = 'phase ' + this.currentPhase;
        }
    }
    
    // 更新游戏阶段
    updateGamePhase(deltaTime) {
        // 累加阶段时间
        this.phaseTime += deltaTime;
        
        // 检查是否需要切换阶段
        switch (this.currentPhase) {
            case 'normal':
                if (this.phaseTime >= this.normalPhaseDuration) {
                    this.currentPhase = 'rush';
                    this.phaseTime = 0;
                    this.isWarningActive = true; // 激活警告特效
                    this.updatePhaseDisplay();
                }
                break;
                
            case 'rush':
                // 在暴走阶段闪烁警告效果
                if (this.isWarningActive) {
                    this.warningAlpha = Math.abs(Math.sin(this.phaseTime / 200));
                }
                
                if (this.phaseTime >= this.rushPhaseDuration) {
                    this.currentPhase = 'normal';
                    this.phaseTime = 0;
                    this.isWarningActive = false; // 关闭警告特效
                    this.updatePhaseDisplay();
                    
                    // 暴走阶段结束后生成随机编队
                    this.generateRandomFormation();
                }
                break;
                
            case 'boss':
                // Boss阶段的处理将在后续实现
                break;
        }
    }
    
    // 生成随机编队
    generateRandomFormation() {
        // 如果当前已有编队活跃，不再生成新编队
        if (this.formationActive) return;
        
        // 获取当前难度设置
        const settings = this.waveController.update(this.score, this.currentPhase, this.currentGameTime);
        
        // 随机选择编队类型
        const formationTypes = ['triangle', 'grid', 'v-shape', 'wave'];
        const formationType = formationTypes[Math.floor(Math.random() * formationTypes.length)];
        
        // 准备编队敌人列表
        this.formationEnemies = [];
        this.formationActive = true;
        this.formationDelay = 0;
        this.formationIndex = 0;
        
        // 生成编队配置
        let formationConfig = [];
        
        switch (formationType) {
            case 'triangle':
                // 三角形编队 (5行金字塔)
                for (let row = 0; row < 5; row++) {
                    const enemiesInRow = row + 1;
                    const startX = (this.canvas.width - (enemiesInRow * 40 + (enemiesInRow - 1) * 10)) / 2;
                    
                    for (let i = 0; i < enemiesInRow; i++) {
                        const x = startX + i * 50; // 40px宽度 + 10px间距
                        const y = -32 - row * 50; // 每行向上偏移
                        const delay = 300 * (row * enemiesInRow + i); // 每个敌人延迟
                        
                        formationConfig.push({
                            x: x,
                            y: y,
                            delay: delay,
                            type: this.getRandomEnemyType(settings.enemyTypes)
                        });
                    }
                }
                break;
                
            case 'grid':
                // 网格编队 (4x4网格)
                const rows = 4;
                const cols = 4;
                const gridWidth = cols * 40 + (cols - 1) * 10;
                const startX = (this.canvas.width - gridWidth) / 2;
                
                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                        const x = startX + col * 50;
                        const y = -32 - row * 50;
                        const delay = 200 * (row * cols + col);
                        
                        formationConfig.push({
                            x: x,
                            y: y,
                            delay: delay,
                            type: this.getRandomEnemyType(settings.enemyTypes)
                        });
                    }
                }
                break;
                
            case 'v-shape':
                // V形编队
                const vCols = 7;
                const vCenter = Math.floor(vCols / 2);
                const vStartX = (this.canvas.width - vCols * 40) / 2;
                
                for (let col = 0; col < vCols; col++) {
                    const row = Math.abs(col - vCenter);
                    const x = vStartX + col * 40;
                    const y = -32 - row * 40;
                    const delay = 200 * col;
                    
                    formationConfig.push({
                        x: x,
                        y: y,
                        delay: delay,
                        type: this.getRandomEnemyType(settings.enemyTypes)
                    });
                }
                break;
                
            case 'wave':
                // 波浪编队
                const waveCols = 10;
                const waveStartX = (this.canvas.width - waveCols * 35) / 2;
                
                for (let col = 0; col < waveCols; col++) {
                    const x = waveStartX + col * 35;
                    const y = -32 - Math.sin(col * 0.5) * 50;
                    const delay = 150 * col;
                    
                    formationConfig.push({
                        x: x,
                        y: y,
                        delay: delay,
                        type: this.getRandomEnemyType(settings.enemyTypes)
                    });
                }
                break;
        }
        
        // 保存编队配置
        this.formationEnemies = formationConfig;
        console.log(`生成${formationType}编队，共${formationConfig.length}个敌人`);
    }
    
    // 从可用敌人类型中随机选择一个
    getRandomEnemyType(enemyTypes) {
        // 有70%几率生成基础敌人
        if (Math.random() < 0.7 || enemyTypes.length === 1) {
            return 'basic';
        }
        
        // 从特殊敌人中随机选择
        const specialTypes = enemyTypes.slice(1);
        return specialTypes[Math.floor(Math.random() * specialTypes.length)];
    }
    
    // 更新编队敌人生成
    updateFormation(deltaTime) {
        if (!this.formationActive || this.formationEnemies.length === 0) return;
        
        // 累加延迟时间
        this.formationDelay += deltaTime;
        
        // 检查是否应该生成下一个编队敌人
        while (this.formationIndex < this.formationEnemies.length &&
               this.formationDelay >= this.formationEnemies[this.formationIndex].delay) {
            
            const enemyConfig = this.formationEnemies[this.formationIndex];
            this.spawnFormationEnemy(
                enemyConfig.x,
                enemyConfig.y,
                enemyConfig.type
            );
            
            this.formationIndex++;
            
            // 检查编队是否完成
            if (this.formationIndex >= this.formationEnemies.length) {
                this.formationActive = false;
                break;
            }
        }
    }
    
    // 生成编队中的敌人
    spawnFormationEnemy(x, y, enemyType) {
        const settings = this.waveController.update(this.score, this.currentPhase, this.currentGameTime);
        let enemy;
        
        // 基于敌人类型创建敌人实例
        switch (enemyType) {
            case 'basic':
                enemy = new Enemy(x, y, settings.speedMultiplier);
                break;
            case 'fast':
                enemy = new FastEnemy(x, y, settings.speedMultiplier * 1.3);
                break;
            case 'armored':
                enemy = new ArmoredEnemy(x, y, settings.speedMultiplier * 0.8);
                break;
            default:
                enemy = new Enemy(x, y, settings.speedMultiplier);
        }
        
        // 为编队敌人设置特殊行为
        enemy.isFormation = true;
        enemy.formationSpeed = settings.speedMultiplier * 0.5; // 编队移动速度较慢
        
        this.enemies.push(enemy);
    }
    
    // 应用当前难度参数
    applyDifficultySettings() {
        // 获取当前难度设置
        const settings = this.waveController.update(this.score, this.currentPhase, this.currentGameTime);
        
        // 应用敌人生成间隔
        this.enemySpawnInterval = settings.spawnInterval;
        
        // 返回设置以便在其他地方使用
        return settings;
    }
    
    // 生成敌人
    spawnEnemy() {
        const settings = this.applyDifficultySettings();
        const x = Math.random() * (this.canvas.width - 32);
        const y = -32;
        
        // 根据当前阶段决定敌人类型和行为
        let enemyType = 'basic'; // 默认基础敌人
        
        // 根据特殊敌人概率决定敌人类型
        if (settings.enemyTypes.length > 1 && Math.random() < settings.specialEnemyChance) {
            // 从可用的特殊敌人类型中随机选择一个
            const specialTypes = settings.enemyTypes.slice(1);
            enemyType = specialTypes[Math.floor(Math.random() * specialTypes.length)];
        }
        
        // 根据当前阶段设置速度（暴走阶段速度更快）
        let speed = settings.speedMultiplier;
        if (this.currentPhase === 'rush') {
            speed *= 1.5; // 暴走阶段速度提升
        }
        
        // 创建对应类型的敌人
        let enemy;
        
        switch (enemyType) {
            case 'basic':
                enemy = new Enemy(x, y, speed);
                break;
            case 'fast':
                enemy = new FastEnemy(x, y, speed * 1.3);
                break;
            case 'armored':
                enemy = new ArmoredEnemy(x, y, speed * 0.8);
                break;
            default:
                enemy = new Enemy(x, y, speed);
        }
        
        this.enemies.push(enemy);
    }
    
    // 检测碰撞
    checkCollisions() {
        // 子弹与敌人碰撞
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const enemy = this.enemies[j];
                
                if (this.isColliding(bullet, enemy)) {
                    // 减少敌人生命值
                    enemy.hp -= 1;
                    
                    // 移除子弹
                    this.bullets.splice(i, 1);
                    
                    // 如果敌人生命值为0，则摧毁敌人
                    if (enemy.hp <= 0) {
                        // 创建爆炸效果
                        this.explosions.push(new Explosion(enemy.x, enemy.y));
                        
                        // 播放爆炸音效
                        this.playExplosion();
                        
                        // 增加分数 (根据敌人类型给予不同分数)
                        this.score += enemy.points || 10;
                        this.updateScoreDisplay();
                        
                        // 移除敌人
                        this.enemies.splice(j, 1);
                    }
                    
                    break;
                }
            }
        }
        
        // 玩家与敌人碰撞
        if (this.player) {
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const enemy = this.enemies[i];
                
                if (this.isColliding(this.player, enemy)) {
                    // 创建爆炸效果
                    this.explosions.push(new Explosion(this.player.x, this.player.y));
                    
                    // 播放爆炸音效
                    this.playExplosion();
                    
                    // 结束游戏
                    this.endGame();
                    return;
                }
            }
        }
    }
    
    // 碰撞检测
    isColliding(a, b) {
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    }
    
    // 游戏结束
    endGame() {
        this.gameRunning = false;
        
        // 停止BGM
        this.stopBGM();
        
        // 更新最高分
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('highScore', this.highScore);
            this.updateScoreDisplay();
        }
        
        // 显示游戏结束界面
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOver').classList.remove('hidden');
    }
    
    // 初始化星空背景
    initStars() {
        this.stars = [];
        for (let i = 0; i < this.numStars; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                radius: Math.random() * 1.5 + 0.5, // 0.5-2像素的半径
                speed: Math.random() * 0.3 + 0.1,  // 不同速度形成视差效果
                brightness: Math.random() * 0.8 + 0.2, // 亮度变化
                color: Math.random() > 0.1 ? 'white' : this.getRandomStarColor() // 偶尔出现彩色星星
            });
        }
    }
    
    // 生成随机星星颜色
    getRandomStarColor() {
        const colors = [
            '#6495ED', // 淡蓝色
            '#8A2BE2', // 紫色
            '#FFD700', // 金色
            '#FF6347', // 番茄色
            '#00FFFF'  // 青色
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    // 更新星空背景
    updateStars(deltaTime) {
        for (let i = 0; i < this.stars.length; i++) {
            const star = this.stars[i];
            
            // 移动星星
            star.y += star.speed * deltaTime / 16; // 基于deltaTime调整速度
            
            // 如果星星超出屏幕底部，重新放置到顶部
            if (star.y > this.canvas.height) {
                star.y = 0;
                star.x = Math.random() * this.canvas.width;
                star.radius = Math.random() * 1.5 + 0.5;
                star.brightness = Math.random() * 0.8 + 0.2;
            }
        }
    }
    
    // 绘制星空背景
    drawStars() {
        for (let i = 0; i < this.stars.length; i++) {
            const star = this.stars[i];
            
            // 保存当前上下文状态
            this.ctx.save();
            
            // 设置星星颜色和透明度
            this.ctx.globalAlpha = star.brightness;
            this.ctx.fillStyle = star.color;
            
            // 绘制星星（圆形）
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 为较大的星星添加光晕效果
            if (star.radius > 1.2) {
                this.ctx.globalAlpha = star.brightness * 0.3;
                this.ctx.beginPath();
                this.ctx.arc(star.x, star.y, star.radius * 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            // 恢复上下文状态
            this.ctx.restore();
        }
    }
    
    // 更新游戏状态
    update(deltaTime) {
        // 累计游戏时间
        if (!this.gamePaused) {
            this.gameTime += deltaTime;
            this.currentGameTime += deltaTime; // 当前局游戏时间累加
        }
        
        // 更新游戏阶段
        this.updateGamePhase(deltaTime);
        
        // 更新星空背景（仅在游戏未暂停时）
        if (!this.gamePaused) {
            this.updateStars(deltaTime);
        }
        
        // 更新编队敌人生成
        if (!this.gamePaused) {
            this.updateFormation(deltaTime);
        }
        
        // 生成敌人（只在没有编队活跃时随机生成）
        if (!this.formationActive && performance.now() - this.lastEnemySpawn > this.enemySpawnInterval) {
            this.spawnEnemy();
            this.lastEnemySpawn = performance.now();
        }
        
        // 更新玩家
        if (this.player) {
            this.player.update(deltaTime);
            
            // 确保玩家不会移出屏幕
            this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.width, this.player.x));
            this.player.y = Math.max(0, Math.min(this.canvas.height - this.player.height, this.player.y));
        }
        
        // 更新子弹
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            this.bullets[i].update(deltaTime);
            
            // 移除超出屏幕的子弹
            if (this.bullets[i].y < -this.bullets[i].height) {
                this.bullets.splice(i, 1);
            }
        }
        
        // 更新敌人
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            this.enemies[i].update(deltaTime);
            
            // 移除超出屏幕底部的敌人
            if (this.enemies[i].y > this.canvas.height) {
                this.enemies.splice(i, 1);
            }
        }
        
        // 更新爆炸效果
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            this.explosions[i].update(deltaTime);
            
            // 移除已完成的爆炸
            if (this.explosions[i].frameCount >= this.explosions[i].totalFrames) {
                this.explosions.splice(i, 1);
            }
        }
        
        // 检测碰撞
        this.checkCollisions();
    }
    
    // 绘制游戏画面
    render() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制背景
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制星空背景
        this.drawStars();
        
        // 如果是暴走阶段，绘制红色警告特效
        if (this.isWarningActive) {
            this.ctx.save();
            this.ctx.fillStyle = `rgba(255, 0, 0, ${this.warningAlpha * 0.2})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.restore();
        }
        
        // 绘制玩家
        if (this.player) {
            if (this.playerImage.complete && this.playerImage.naturalHeight !== 0) {
                this.ctx.drawImage(this.playerImage, this.player.x, this.player.y, this.player.width, this.player.height);
            } else {
                // 使用蓝色方块代替玩家图像
                this.ctx.fillStyle = '#3498db';
                this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
                
                // 绘制飞机窗口
                this.ctx.fillStyle = '#f1c40f';
                this.ctx.fillRect(this.player.x + 13, this.player.y + 8, 6, 6);
            }
        }
        
        // 绘制子弹
        for (const bullet of this.bullets) {
            if (this.bulletImage.complete && this.bulletImage.naturalHeight !== 0) {
                this.ctx.drawImage(this.bulletImage, bullet.x, bullet.y, bullet.width, bullet.height);
            } else {
                // 使用红色方块代替子弹图像
                this.ctx.fillStyle = '#FF0000';
                this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
            }
        }
        
        // 绘制敌人
        for (const enemy of this.enemies) {
            if (enemy.type === 'basic' && this.enemyImage.complete && this.enemyImage.naturalHeight !== 0) {
                this.ctx.drawImage(this.enemyImage, enemy.x, enemy.y, enemy.width, enemy.height);
            } else if (enemy.type === 'fast' && this.fastEnemyImage && this.fastEnemyImage.complete) {
                this.ctx.drawImage(this.fastEnemyImage, enemy.x, enemy.y, enemy.width, enemy.height);
            } else if (enemy.type === 'armored' && this.armoredEnemyImage && this.armoredEnemyImage.complete) {
                this.ctx.drawImage(this.armoredEnemyImage, enemy.x, enemy.y, enemy.width, enemy.height);
            } else {
                // 根据敌人类型使用不同颜色的方块
                let color = '#2ecc71'; // 默认绿色
                
                if (enemy.type === 'fast') {
                    color = '#e74c3c'; // 高速敌人用红色
                } else if (enemy.type === 'armored') {
                    color = '#7f8c8d'; // 装甲敌人用灰色
                }
                
                // 绘制敌机
                this.ctx.fillStyle = color;
                this.ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
                
                // 绘制敌机细节
                this.ctx.fillStyle = '#c0392b';
                this.ctx.fillRect(enemy.x + 8, enemy.y + 8, 16, 6);
                this.ctx.fillRect(enemy.x + 14, enemy.y + 14, 4, 10);
                
                // 如果是装甲敌人，绘制装甲
                if (enemy.type === 'armored') {
                    this.ctx.strokeStyle = '#bdc3c7';
                    this.ctx.lineWidth = 3;
                    this.ctx.strokeRect(enemy.x + 2, enemy.y + 2, enemy.width - 4, enemy.height - 4);
                }
            }
            
            // 如果敌人有多条命，绘制生命值指示器
            if (enemy.hp > 1) {
                // 绘制生命条背景
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                this.ctx.fillRect(enemy.x, enemy.y - 8, enemy.width, 5);
                
                // 绘制生命条
                const healthPercent = enemy.hp / enemy.maxHp;
                this.ctx.fillStyle = healthPercent > 0.5 ? '#2ecc71' : '#e74c3c';
                this.ctx.fillRect(enemy.x, enemy.y - 8, enemy.width * healthPercent, 5);
            }
        }
        
        // 绘制爆炸效果
        for (const explosion of this.explosions) {
            // 爆炸外环
            this.ctx.fillStyle = 'rgba(255, 165, 0, 0.8)';
            this.ctx.beginPath();
            this.ctx.arc(explosion.x + explosion.radius, explosion.y + explosion.radius, 
                        explosion.radius * (1 - explosion.frameCount / explosion.totalFrames), 0, Math.PI * 2);
            this.ctx.fill();
            
            // 爆炸内核
            this.ctx.fillStyle = 'rgba(255, 69, 0, 0.8)';
            this.ctx.beginPath();
            this.ctx.arc(explosion.x + explosion.radius, explosion.y + explosion.radius, 
                        explosion.radius * 0.7 * (1 - explosion.frameCount / explosion.totalFrames), 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // 如果暂停，显示暂停信息
        if (this.gamePaused) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = 'white';
            this.ctx.font = '24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('已暂停', this.canvas.width / 2, this.canvas.height / 2);
        }
    }
    
    // 游戏循环
    gameLoop(timestamp) {
        // 如果游戏暂停，不继续循环
        if (!this.gameRunning || this.gamePaused) {
            return;
        }
        
        // 计算时间差
        const deltaTime = timestamp - (this.lastFrameTime || timestamp);
        this.lastFrameTime = timestamp;
        
        // 更新游戏状态
        this.update(deltaTime);
        
        // 渲染游戏画面
        this.render();
        
        // 继续下一帧
        requestAnimationFrame(this.gameLoop.bind(this));
    }
}

// 难度控制器类
class WaveController {
    constructor() {
        // 难度等级配置 - 再次提升所有敌人速度70%
        this.difficultyLevels = [
            { gameTime: 0, interval: 1500, types: ['basic'], speed: 2.9, specialChance: 0.3 },
            { gameTime: 30000, interval: 1300, types: ['basic', 'fast'], speed: 3.4, specialChance: 0.3 },
            { gameTime: 60000, interval: 1100, types: ['basic', 'fast', 'armored'], speed: 4.2, specialChance: 0.3 },
            { gameTime: 120000, interval: 900, types: ['basic', 'fast', 'armored'], speed: 5.1, specialChance: 0.3 }
        ];
    }
    
    // 根据当前局游戏时间和阶段更新难度设置
    update(currentScore, currentPhase, currentGameTime) {
        // 获取适用的难度等级
        const activeLevel = this.difficultyLevels
            .filter(level => currentGameTime >= level.gameTime)
            .pop();
        
        // 根据阶段调整参数
        let interval = activeLevel.interval;
        let speedMultiplier = activeLevel.speed;
        let specialEnemyChance = activeLevel.specialChance;
        
        // 暴走阶段难度提升，显著增加特殊敌人概率
        if (currentPhase === 'rush') {
            interval *= 0.7; // 敌人生成更快
            specialEnemyChance *= 1.5; // 特殊敌人概率提升
        }
        
        // 计算难度系数
        const difficultyCoefficient = 1 + Math.pow(currentGameTime / 60000, 0.5);
        
        // 返回当前难度设置
        return {
            spawnInterval: interval,
            enemyTypes: activeLevel.types,
            speedMultiplier: speedMultiplier,
            specialEnemyChance: specialEnemyChance,
            difficultyCoefficient: difficultyCoefficient
        };
    }
}

// 玩家类
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 32;
        this.height = 32;
        this.speed = 5;
        this.moveLeft = false;
        this.moveRight = false;
        this.moveUp = false;
        this.moveDown = false;
    }
    
    handleKeyDown(key) {
        switch(key) {
            case 'ArrowLeft':
            case 'a':
                this.moveLeft = true;
                break;
            case 'ArrowRight':
            case 'd':
                this.moveRight = true;
                break;
            case 'ArrowUp':
            case 'w':
                this.moveUp = true;
                break;
            case 'ArrowDown':
            case 's':
                this.moveDown = true;
                break;
        }
    }
    
    handleKeyUp(key) {
        switch(key) {
            case 'ArrowLeft':
            case 'a':
                this.moveLeft = false;
                break;
            case 'ArrowRight':
            case 'd':
                this.moveRight = false;
                break;
            case 'ArrowUp':
            case 'w':
                this.moveUp = false;
                break;
            case 'ArrowDown':
            case 's':
                this.moveDown = false;
                break;
        }
    }
    
    update(deltaTime) {
        if (this.moveLeft) this.x -= this.speed;
        if (this.moveRight) this.x += this.speed;
        if (this.moveUp) this.y -= this.speed;
        if (this.moveDown) this.y += this.speed;
    }
}

// 基础敌人类
class Enemy {
    constructor(x, y, speed) {
        this.x = x;
        this.y = y;
        this.width = 32;
        this.height = 32;
        this.speed = speed;
        this.type = 'basic';
        this.hp = 1;
        this.maxHp = 1;
        this.points = 10; // 基础得分
        
        // 编队属性
        this.isFormation = false;
        this.formationSpeed = speed * 0.5;
    }
    
    update(deltaTime) {
        // 如果是编队敌人，使用较慢的速度从上方进入屏幕
        if (this.isFormation && this.y < 100) {
            this.y += this.formationSpeed;
        } else {
            this.y += this.speed;
        }
    }
}

// 高速敌人类，复杂化移动轨迹并增加得分
class FastEnemy extends Enemy {
    constructor(x, y, speed) {
        super(x, y, speed);
        this.type = 'fast';
        this.hp = 1;
        this.maxHp = 1;
        this.points = 30; // 提高得分奖励
        this.direction = Math.random() > 0.5 ? 1 : -1; // 随机初始水平方向
        this.horizontalSpeed = this.speed * 0.5; // 水平移动速度
        this.verticalOscillation = Math.random() > 0.5; // 是否进行垂直震荡
        this.oscillationAmplitude = 10 + Math.random() * 15; // 震荡幅度
        this.oscillationSpeed = 0.01 + Math.random() * 0.02; // 震荡速度
        this.timeOffset = Math.random() * 100; // 时间偏移，使敌人不同步
        this.movementPattern = Math.floor(Math.random() * 3); // 0:Z字型, 1:S型, 2:螺旋型
    }
    
    update(deltaTime) {
        // 如果是编队敌人且仍在进入阶段，使用特殊移动
        if (this.isFormation && this.y < 100) {
            this.y += this.formationSpeed;
        } else {
            // 基础纵向移动
            this.y += this.speed;
            
            // 根据不同模式应用复杂移动模式
            switch(this.movementPattern) {
                case 0: // Z字型移动
                    // 向左右移动
                    this.x += this.horizontalSpeed * this.direction;
                    
                    // 到达屏幕边缘时改变方向
                    if (this.x <= 0 || this.x >= 380 - this.width) {
                        this.direction *= -1;
                    }
                    break;
                    
                case 1: // S型移动
                    // 使用正弦波进行平滑的左右移动
                    this.x = this.x + Math.sin((this.y + this.timeOffset) * 0.05) * 2;
                    
                    // 确保不超出屏幕
                    if (this.x < 0) this.x = 0;
                    if (this.x > 380 - this.width) this.x = 380 - this.width;
                    break;
                    
                case 2: // 螺旋型移动
                    // 使用正弦和余弦使敌人以复杂的螺旋方式移动
                    const time = (Date.now() + this.timeOffset) * 0.01;
                    const xOffset = Math.sin(time) * 2;
                    const additionalYSpeed = Math.cos(time) * 0.5;
                    
                    this.x += xOffset;
                    this.y += additionalYSpeed;
                    
                    // 确保不超出屏幕边界
                    if (this.x < 0) this.x = 0;
                    if (this.x > 380 - this.width) this.x = 380 - this.width;
                    break;
            }
            
            // 应用垂直震荡（可选）
            if (this.verticalOscillation) {
                this.y += Math.sin((Date.now() + this.timeOffset) * this.oscillationSpeed) * 0.7;
            }
        }
    }
}

// 装甲敌人类
class ArmoredEnemy extends Enemy {
    constructor(x, y, speed) {
        super(x, y, speed);
        this.type = 'armored';
        this.hp = 3; // 更多生命值
        this.maxHp = 3;
        this.points = 30; // 装甲敌人得分更高
    }
    
    update(deltaTime) {
        // 如果是编队敌人且仍在进入阶段，使用特殊移动
        if (this.isFormation && this.y < 100) {
            this.y += this.formationSpeed;
        } else {
            // 使用原有的移动模式
            super.update(deltaTime);
        }
    }
}

// 子弹类
class Bullet {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 8;
        this.height = 8;
        this.speed = 8;
    }
    
    update(deltaTime) {
        this.y -= this.speed;
    }
}

// 爆炸效果类
class Explosion {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 20;
        this.frameCount = 0;
        this.totalFrames = 20;
    }
    
    update(deltaTime) {
        this.frameCount++;
    }
}

// 当页面加载完成后初始化游戏
window.addEventListener('load', () => {
    const game = new SpacewarGame();
}); 