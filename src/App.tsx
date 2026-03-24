import React, { useEffect, useRef, useState } from 'react';

// --- Constants & Types ---
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const FROG_SIZE = 32;
const ATTACK_DURATION = 15;
const TONGUE_LENGTH = 60;

// Physics constants for dynamic movement (now adjusted for deltaTime)
const PLAYER_ACCEL = 10; // Base acceleration per second (further reduced to 10)
const PLAYER_FRICTION = 0.95; // Higher friction for slippery feel
const ENEMY_FRICTION = 0.85;
const KNOCKBACK_FORCE = 15;

const FROG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <ellipse cx="6" cy="24" rx="4" ry="6" fill="#22c55e" transform="rotate(-30 6 24)" />
  <ellipse cx="26" cy="24" rx="4" ry="6" fill="#22c55e" transform="rotate(30 26 24)" />
  <ellipse cx="8" cy="12" rx="3" ry="5" fill="#22c55e" transform="rotate(-15 8 12)" />
  <ellipse cx="24" cy="12" rx="3" ry="5" fill="#22c55e" transform="rotate(15 24 12)" />
  <ellipse cx="16" cy="16" rx="10" ry="12" fill="#4ade80" />
  <circle cx="11" cy="6" r="3.5" fill="#4ade80" />
  <circle cx="21" cy="6" r="3.5" fill="#4ade80" />
  <circle cx="11" cy="5" r="1.5" fill="#fff" />
  <circle cx="21" cy="5" r="1.5" fill="#fff" />
  <circle cx="11" cy="4.5" r="0.8" fill="#000" />
  <circle cx="21" cy="4.5" r="0.8" fill="#000" />
</svg>`;

const frogImage = new Image();
frogImage.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(FROG_SVG);

const ENEMY_IMAGE_MAPPING: { [key: string]: string } = {
  'Токсичные тимейты': 'Токсичные тимейты.png',
  'Боль в спине': 'Боль в Спине.png',
  'Депрессия': 'Депрессия.png',
  'Голод': 'Голод.png',
  'Плохая погода': 'Плохая погода.png',
  'Душка': 'Душка.png',
  'Бессонница': 'Бессониница.png',
  'Прокрастинация': 'Прокрастинация.png',
  'Тревога': 'Тревога.png',
  'Забывчивость': 'Забывчивость.png',
  'Шумные соседи': 'Шумные соседи.png',
};

// Encode space as %20 manually for robustness
const ENEMY_ICON_PATH = 'froggy%20icon/';

const enemyImages: { [key: string]: HTMLImageElement } = {};
Object.keys(ENEMY_IMAGE_MAPPING).forEach(name => {
  const img = new Image();
  const fileName = ENEMY_IMAGE_MAPPING[name];
  const meta = (import.meta as any);
  const baseUrl = (meta && meta.env && meta.env.BASE_URL) || '/Froggy/';
  img.src = `${baseUrl}${ENEMY_ICON_PATH}${encodeURIComponent(fileName)}`;

  img.onload = () => {
    console.log(`[Froggy] SUCCESS: Loaded image for "${name}" from ${img.src}`);
  };
  img.onerror = () => {
    console.error(`[Froggy] ERROR: Failed to load image for "${name}" from ${img.src}`);
    img.dataset.failed = 'true';
  };
  enemyImages[name] = img;
});

// --- Boss Battle Assets ---
const BOSS_NAMES = [
  'Плохая погода', 'Прокрастинация', 'Забывчивость', 'Шумные соседи',
  'Боль в спине', 'Голод', 'Депрессия', 'Бессонница', 'Тревога'
];

const bossImages: { [key: string]: HTMLImageElement } = {};
const mainFrogBossImage = new Image();

BOSS_NAMES.forEach(name => {
  const img = new Image();
  const meta = (import.meta as any);
  const baseUrl = (meta && meta.env && meta.env.BASE_URL) || '/Froggy/';
  img.src = `${baseUrl}Froggy Boss/${encodeURIComponent(name + '.png')}`;
  bossImages[name] = img;
});

const meta = (import.meta as any);
const baseUrl = (meta && meta.env && meta.env.BASE_URL) || '/Froggy/';
mainFrogBossImage.src = `${baseUrl}Froggy Boss/${encodeURIComponent('Main Frog.png')}`;

type EnemyBehavior = 'chase' | 'stop-and-go' | 'erratic' | 'wander' | 'dash' | 'lunge' | 'orbit';
type EnemyShape = 'square' | 'circle' | 'triangle' | 'pentagon' | 'star';

interface EnemyType {
  name: string; hp: number; speed: number; width: number; height: number;
  behavior: EnemyBehavior; damage: number;
  color?: string; shape?: EnemyShape;
}

const ENEMY_TYPES: EnemyType[] = [
  { name: 'Токсичные тимейты', hp: 30, speed: 0.78, width: 32, height: 32, behavior: 'chase', damage: 0.5 },
  { name: 'Боль в спине', hp: 50, speed: 0.42, width: 40, height: 40, behavior: 'lunge', damage: 1.0 },
  { name: 'Депрессия', hp: 80, speed: 0.24, width: 48, height: 48, behavior: 'chase', damage: 0.2 },
  { name: 'Голод', hp: 20, speed: 0.98, width: 24, height: 24, behavior: 'chase', damage: 0.8 },
  { name: 'Плохая погода', hp: 40, speed: 0.66, width: 36, height: 36, behavior: 'chase', damage: 0.5 },
  { name: 'Душка', hp: 60, speed: 0.54, width: 32, height: 32, behavior: 'chase', damage: 0.5 },
  { name: 'Бессонница', hp: 25, speed: 1.14, width: 28, height: 28, behavior: 'chase', damage: 0.5 },
  { name: 'Прокрастинация', hp: 45, speed: 1.8, width: 34, height: 34, behavior: 'stop-and-go', damage: 0.5 },
  { name: 'Тревога', hp: 35, speed: 1.08, width: 30, height: 30, behavior: 'orbit', damage: 0.7 },
  { name: 'Забывчивость', hp: 25, speed: 0.78, width: 28, height: 28, behavior: 'wander', damage: 0.3 },
  { name: 'Шумные соседи', hp: 55, speed: 2.0, width: 38, height: 38, behavior: 'dash', damage: 1.5 },
];

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface Enemy {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  name: string;
  hitTimer: number;
  dead: boolean;
  speed: number;
  behavior: EnemyBehavior;
  damage: number;
  stateTimer: number;
  targetX?: number;
  targetY?: number;
  color?: string;
  shape?: EnemyShape;
}

interface TypingState {
  code: string;
  currentIndex: number;
  fireX: number;
  fireSpeed: number;
  isFinished: boolean;
}

interface BattleState {
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
  playerHp: number;
  playerMaxHp: number;
  playerItems: { name: string; count: number }[];
  turn: 'PLAYER' | 'BOSS';
  message: string;
  isFinished: boolean;
  selectedAction: number; // For menu navigation
  selectedItemIndex: number; // For item selection
  isItemMenuOpen: boolean;
  stateTimer: number;
}

interface GameState {
  mode: 'ACTION' | 'TYPING' | 'BOSS_SELECT' | 'BATTLE';
  typingState?: TypingState;
  battleState?: BattleState;
  level: number;
  player: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    width: number;
    height: number;
    dir: Direction;
    isAttacking: boolean;
    attackTimer: number;
    isCharging: boolean;
    chargeLevel: number;
    currentAttackLength: number;
    hp: number;
    maxHp: number;
    lv: number;
    damage: number;
  };
  enemies: Enemy[];
  availableEnemies: typeof ENEMY_TYPES;
  keys: { [key: string]: boolean };
  dialog: {
    fullText: string;
    currentText: string;
    charIndex: number;
    timer: number;
  };
  hasMoved: boolean;
  spawnTimer: number;
  enemyIdCounter: number;
  isGameOver: boolean;
  isVictory: boolean;
  killerName: string | null;
}

// --- Components ---

function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="flex flex-col items-center justify-center h-full animate-pulse">
      <p className="text-2xl tracking-widest text-gray-400">ЗАГРУЗКА...</p>
    </div>
  );
}

function NamingScreen({ onComplete }: { onComplete: (name: string) => void }) {
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState('Назови своего лягушонка.');
  const [inputValue, setInputValue] = useState('');
  const [displayedMessage, setDisplayedMessage] = useState('');
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    setDisplayedMessage('');
    setCharIndex(0);
  }, [message]);

  useEffect(() => {
    if (charIndex < message.length) {
      const timer = setTimeout(() => {
        setDisplayedMessage((prev) => prev + message[charIndex]);
        setCharIndex((prev) => prev + 1);
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [charIndex, message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (charIndex < message.length) return;

    if (attempt === 0) {
      if (!inputValue.trim()) return;
      setMessage('Слишком тихо... Я не расслышал. Напиши с большой буквы, что ли.');
      setAttempt(1);
      setInputValue('');
    } else if (attempt === 1) {
      if (!inputValue.trim()) return;
      setMessage('Опять не слышу! НАПИШИ КАПСОМ, ЧТОБЫ Я ПОНЯЛ!');
      setAttempt(2);
      setInputValue('');
    } else if (attempt === 2) {
      if (!inputValue.trim()) return;
      setMessage('ОЙ, ЗАЧЕМ ТАК КРИЧАТЬ?! Раз ты такой грубый и повышаешь на меня буквы, я сам выберу тебе имя. Теперь ты....');
      setAttempt(3);
    } else if (attempt === 3) {
      onComplete('Артемяус');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full max-w-2xl px-4 text-center">
      <p className="text-xl md:text-2xl mb-24 h-48 leading-relaxed flex items-center justify-center">{displayedMessage}</p>

      {charIndex >= message.length && (
        <form onSubmit={handleSubmit} className="flex flex-col items-center">
          {attempt < 3 ? (
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="bg-transparent border-b-2 border-white outline-none text-center text-2xl tracking-widest pb-2 mb-8 w-64"
              autoFocus
              maxLength={12}
              placeholder="Имя..."
            />
          ) : (
            <div className="text-3xl uppercase tracking-widest text-yellow-400 animate-bounce mb-12 mt-4">
              АРТЕМЯУС
            </div>
          )}
          <button type="submit" className="text-xl hover:text-yellow-400 transition-colors">
            {attempt < 3 ? 'Подтвердить' : 'Начать игру'}
          </button>
        </form>
      )}
    </div>
  );
}

function GameScreen({ frogName, onVictory }: { frogName: string; onVictory: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const getInitialState = (prevPlayer?: GameState['player'], level: number = 1, bossName?: string): GameState => {
    let mode: GameState['mode'] = level === 1 ? 'ACTION' : (level === 2 || level === 5) ? 'TYPING' : level === 3 ? 'BOSS_SELECT' : 'BATTLE';
    if (level === 6) mode = 'ACTION'; // Fallback

    let typingState: TypingState | undefined;
    if (mode === 'TYPING') {
      const code = level === 2 ? "LSHS-5DDK-TCKCB-RWG6-QTB6" : "G539-MMWJ-DTJ4R-LHH9-KPBR";
      const fireSpeed = level === 2 ? 60 : 90; // pixels per second
      typingState = {
        code,
        currentIndex: 0,
        fireX: -280,
        fireSpeed,
        isFinished: false,
      };
    }

    let battleState: BattleState | undefined;
    if ((mode === 'BATTLE' && bossName) || mode === 'BOSS_SELECT') {
      battleState = {
        bossName: bossName || BOSS_NAMES[0],
        bossHp: 200,
        bossMaxHp: 200,
        playerHp: prevPlayer ? prevPlayer.hp : 100,
        playerMaxHp: 100,
        playerItems: [
          { name: 'Праздничный торт', count: 1 },
          { name: 'Энергетик', count: 2 },
          { name: 'Салат с Фасолью и сухариками', count: 1 }
        ],
        turn: 'PLAYER',
        message: bossName ? `Дикий ${bossName} преграждает путь!` : "Выберите своего противника",
        isFinished: false,
        selectedAction: 0,
        selectedItemIndex: 0,
        isItemMenuOpen: false,
        stateTimer: 0,
      };
    }

    return {
      mode,
      typingState,
      battleState,
      level,
      player: prevPlayer ? { ...prevPlayer, x: CANVAS_WIDTH / 2 - FROG_SIZE / 2, y: CANVAS_HEIGHT / 2 - FROG_SIZE / 2, hp: Math.min(100, prevPlayer.hp) } : {
        x: CANVAS_WIDTH / 2 - FROG_SIZE / 2,
        y: CANVAS_HEIGHT / 2 - FROG_SIZE / 2,
        vx: 0,
        vy: 0,
        width: FROG_SIZE,
        height: FROG_SIZE,
        dir: 'DOWN',
        isAttacking: false,
        attackTimer: 0,
        isCharging: false,
        chargeLevel: 0,
        currentAttackLength: 0,
        hp: 100,
        maxHp: 100,
        lv: 1,
        damage: 10,
      },
      enemies: [],
      availableEnemies: ENEMY_TYPES.map(e => ({
        ...e,
        hp: e.hp * (1 + (level - 1) * 0.3),
        speed: e.speed * (1 + (level - 1) * 0.1),
        damage: e.damage * (1 + (level - 1) * 0.2)
      })),
      keys: {},
      dialog: {
        fullText: `* Вы - ${frogName}, полная РЕШИМОСТИ Лягушка.\n* Стрелочки/WASD - ходить.\n* Z или ПРОБЕЛ - атаковать языком.`,
        currentText: "",
        charIndex: 0,
        timer: 0,
      },
      hasMoved: false,
      spawnTimer: 0,
      enemyIdCounter: 0,
      isGameOver: false,
      isVictory: false,
      killerName: null,
    };
  };

  const state = useRef<GameState>(getInitialState());

  const setDialog = (text: string) => {
    state.current.dialog = {
      fullText: text,
      currentText: "",
      charIndex: 0,
      timer: 0,
    };
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      state.current.keys[e.code] = true;

      const s = state.current;
      if (s.mode === 'TYPING' && !s.isGameOver && !s.isVictory) {
        const ts = s.typingState!;
        if (ts.isFinished) {
          if (e.code === 'Enter' || e.code === 'Space') {
            if (s.level === 2) {
              state.current = getInitialState(s.player, 3);
            } else if (s.level === 5) {
              onVictory();
            } else {
              state.current = getInitialState(s.player, s.level + 1);
            }
            return;
          }
        } else if (ts.currentIndex < ts.code.length) {
          const targetChar = ts.code[ts.currentIndex];
          if (e.key.toUpperCase() === targetChar.toUpperCase() || (targetChar === '-' && e.key === '-')) {
            ts.currentIndex++;
            while (ts.currentIndex < ts.code.length && ts.code[ts.currentIndex] === '-') {
              ts.currentIndex++;
            }
            if (ts.currentIndex >= ts.code.length) {
              ts.isFinished = true;
            }
          }
        }
      }

      if (s.mode === 'BOSS_SELECT') {
        const index = s.battleState ? s.battleState.selectedAction : 0;
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          const newIdx = (index - 1 + BOSS_NAMES.length) % BOSS_NAMES.length;
          s.battleState = { ...s.battleState!, selectedAction: newIdx, bossName: BOSS_NAMES[newIdx] };
        }
        if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          const newIdx = (index + 1) % BOSS_NAMES.length;
          s.battleState = { ...s.battleState!, selectedAction: newIdx, bossName: BOSS_NAMES[newIdx] };
        }
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyZ') {
          const selectedBoss = BOSS_NAMES[index];
          state.current = getInitialState(s.player, 4, selectedBoss);
        }
      }

      if (s.mode === 'BATTLE' && !s.isGameOver && !s.isVictory) {
        const bs = s.battleState!;
        if (bs.isFinished) {
          if (e.code === 'Enter' || e.code === 'Space') {
            if (bs.bossHp <= 0) {
              s.isVictory = true;
              setTimeout(onVictory, 1000);
            } else {
              s.isGameOver = true;
            }
          }
          return;
        }

        if (bs.turn === 'PLAYER') {
          if (bs.isItemMenuOpen) {
            if (e.code === 'ArrowUp' || e.code === 'KeyW') bs.selectedItemIndex = (bs.selectedItemIndex - 1 + bs.playerItems.length) % bs.playerItems.length;
            if (e.code === 'ArrowDown' || e.code === 'KeyS') bs.selectedItemIndex = (bs.selectedItemIndex + 1) % bs.playerItems.length;
            if (e.code === 'Escape' || e.code === 'ArrowLeft') bs.isItemMenuOpen = false;
            if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyZ') {
              const item = bs.playerItems[bs.selectedItemIndex];
              if (item && item.count > 0) {
                item.count--;
                let heal = 0;
                if (item.name === 'Праздничный торт') heal = 100;
                else if (item.name === 'Энергетик') heal = 20;
                else if (item.name === 'Салат с Фасолью и сухариками') heal = 50;

                bs.playerHp = Math.min(bs.playerMaxHp, bs.playerHp + heal);
                bs.message = `Артемяус использовал ${item.name}! +${heal} HP.`;
                bs.turn = 'BOSS';
                bs.isItemMenuOpen = false;
              } else {
                bs.message = 'Эти предметы закончились!';
              }
            }
            return;
          }

          if (e.code === 'ArrowUp' || e.code === 'KeyW') bs.selectedAction = (bs.selectedAction - 1 + 3) % 3;
          if (e.code === 'ArrowDown' || e.code === 'KeyS') bs.selectedAction = (bs.selectedAction + 1) % 3;
          if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyZ') {
            // Process Player Action
            if (bs.selectedAction === 0) { // Attack
              const dmg = 20 + Math.floor(Math.random() * 15);
              bs.bossHp -= dmg;
              bs.message = `Артемяус использует ЯЗЫК-ХЛЫСТ! Нанесено ${dmg} урона.`;
              bs.turn = 'BOSS';
            } else if (bs.selectedAction === 1) { // Defense
              bs.message = `Артемяус прячется в камышах! Защита повышена.`;
              bs.turn = 'BOSS';
            } else if (bs.selectedAction === 2) { // Items
              bs.isItemMenuOpen = true;
            }
            if (bs.bossHp <= 0) {
              bs.bossHp = 0;
              bs.message = `${bs.bossName} повержен! Код для завершения: G539-MMWJ-DTJ4R-LHH9-KPBR. Нажмите ENTER.`;
              bs.isFinished = true;
            }
          }
        }
        if (bs.isFinished && (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyZ')) {
          state.current = getInitialState(s.player, 5);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      state.current.keys[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    lastTimeRef.current = performance.now();

    const update = (dt: number) => {
      const s = state.current;
      const p = s.player;

      // dt is in seconds, e.g., 0.016 for 60fps
      const speedScale = dt * 60; // Scale factors originally designed for 60fps

      // Check Restart / Next Level
      if (s.isGameOver && s.keys['KeyR']) {
        state.current = getInitialState();
        return;
      }
      if (s.isVictory && s.keys['KeyR']) {
        state.current = getInitialState(s.player, s.level + 1);
        return;
      }

      if (s.isGameOver || s.isVictory) return;

      if (s.mode === 'TYPING') {
        const ts = s.typingState!;
        if (!ts.isFinished) {
          ts.fireX += ts.fireSpeed * dt;
        }

        const blockWidth = 60;
        const targetPlayerX = ts.currentIndex * blockWidth;

        // Smoothly move player to targetPlayerX
        p.x += (targetPlayerX - p.x) * 0.2;

        const boxH = 160;
        const boxY = (CANVAS_HEIGHT - 140 - boxH) / 2;
        const blockHeight = 60;
        const startY = boxY + boxH / 2 - blockHeight / 2;
        p.y = startY - p.height - 10; // Position frog above the block

        // Check collision with fire
        if (!ts.isFinished && ts.fireX > p.x - 10) {
          s.isGameOver = true;
          s.killerName = "Гнев Ксюндры";
        }

        return;
      }

      if (s.mode === 'BOSS_SELECT') {
        const bs = s.battleState!;
        bs.stateTimer += dt;
        return;
      }

      if (s.mode === 'BATTLE') {
        const bs = s.battleState!;
        if (bs.turn === 'BOSS' && !bs.isFinished) {
          bs.stateTimer += dt;
          if (bs.stateTimer > 1.5) { // 1.5 second delay
            const dmg = 15 + Math.floor(Math.random() * 10);
            bs.playerHp = Math.max(0, bs.playerHp - dmg);
            bs.message = `${bs.bossName} использует КОШМАРНУЮ АТАКУ! Нанесено ${dmg} урона.`;
            bs.turn = 'PLAYER';
            bs.stateTimer = 0;
            if (bs.playerHp <= 0) {
              bs.message = "Артемяус упал в обморок...";
              bs.isFinished = true;
            }
          }
        }
        return;
      }

      if (s.mode === 'ACTION') {
        // --- Player Physics & Movement ---
        let moved = false;
        if (!p.isAttacking) {
          if (s.keys['ArrowUp'] || s.keys['KeyW']) { p.vy -= PLAYER_ACCEL * dt; p.dir = 'UP'; moved = true; }
          if (s.keys['ArrowDown'] || s.keys['KeyS']) { p.vy += PLAYER_ACCEL * dt; p.dir = 'DOWN'; moved = true; }
          if (s.keys['ArrowLeft'] || s.keys['KeyA']) { p.vx -= PLAYER_ACCEL * dt; p.dir = 'LEFT'; moved = true; }
          if (s.keys['ArrowRight'] || s.keys['KeyD']) { p.vx += PLAYER_ACCEL * dt; p.dir = 'RIGHT'; moved = true; }
        }

        p.vx *= Math.pow(PLAYER_FRICTION, speedScale);
        p.vy *= Math.pow(PLAYER_FRICTION, speedScale);
        p.x += p.vx * speedScale;
        p.y += p.vy * speedScale;

        // Bounds checking
        const padding = 20;
        const bottomUIHeight = 140;
        if (p.x < padding) { p.x = padding; p.vx = 0; }
        if (p.x > CANVAS_WIDTH - padding - p.width) { p.x = CANVAS_WIDTH - padding - p.width; p.vx = 0; }
        if (p.y < padding) { p.y = padding; p.vy = 0; }
        if (p.y > CANVAS_HEIGHT - bottomUIHeight - padding - p.height) { p.y = CANVAS_HEIGHT - bottomUIHeight - padding - p.height; p.vy = 0; }

        // Start Spawning
        if (moved && !s.hasMoved) {
          s.hasMoved = true;
          s.spawnTimer = 30;
        }

        // --- Spawning Logic ---
        if (s.hasMoved && s.availableEnemies.length > 0) {
          s.spawnTimer -= speedScale;
          if (s.spawnTimer <= 0) {
            const idx = Math.floor(Math.random() * s.availableEnemies.length);
            const type = s.availableEnemies[idx];
            s.availableEnemies.splice(idx, 1); // Remove to ensure uniqueness

            const edge = Math.floor(Math.random() * 4);
            let ex = 0, ey = 0;
            if (edge === 0) { ex = Math.random() * CANVAS_WIDTH; ey = -50; }
            else if (edge === 1) { ex = CANVAS_WIDTH + 50; ey = Math.random() * CANVAS_HEIGHT; }
            else if (edge === 2) { ex = Math.random() * CANVAS_WIDTH; ey = CANVAS_HEIGHT + 50; }
            else { ex = -50; ey = Math.random() * CANVAS_HEIGHT; }

            s.enemies.push({
              id: s.enemyIdCounter++,
              x: ex, y: ey, vx: 0, vy: 0,
              width: type.width, height: type.height,
              hp: type.hp, maxHp: type.hp,
              name: type.name,
              speed: type.speed,
              behavior: type.behavior,
              damage: type.damage,
              stateTimer: 0,
              hitTimer: 0,
              dead: false,
              color: type.color,
              shape: type.shape
            });
            s.spawnTimer = 180 + Math.random() * 240; // Next spawn in 3-7 seconds
          }
        }

        // --- Attack Logic ---
        const attackKey = s.keys['Space'] || s.keys['KeyZ'];

        if (attackKey && !p.isAttacking) {
          p.isCharging = true;
          // Reduced charge level to take ~2.5 seconds (roughly 0.0065 per frame at 60fps)
          p.chargeLevel = Math.min(1, p.chargeLevel + 0.0065 * speedScale);
        } else if (!attackKey && p.isCharging) {
          p.isCharging = false;
          p.isAttacking = true;
          p.attackTimer = ATTACK_DURATION;

          const MIN_TONGUE_LENGTH = 15;
          const MAX_TONGUE_LENGTH = 120; // Reduced from 180 to 120
          p.currentAttackLength = MIN_TONGUE_LENGTH + (MAX_TONGUE_LENGTH - MIN_TONGUE_LENGTH) * p.chargeLevel;
          const isFullyCharged = p.chargeLevel >= 0.95;
          p.chargeLevel = 0;

          let ax = p.x;
          let ay = p.y;
          let aw = p.width;
          let ah = p.height;

          if (p.dir === 'UP') { ay -= p.currentAttackLength; ah = p.currentAttackLength; aw = 8; ax += p.width / 2 - 4; }
          if (p.dir === 'DOWN') { ay += p.height; ah = p.currentAttackLength; aw = 8; ax += p.width / 2 - 4; }
          if (p.dir === 'LEFT') { ax -= p.currentAttackLength; aw = p.currentAttackLength; ah = 8; ay += p.height / 2 - 4; }
          if (p.dir === 'RIGHT') { ax += p.width; aw = p.currentAttackLength; ah = 8; ay += p.height / 2 - 4; }

          s.enemies.forEach(enemy => {
            if (!enemy.dead &&
              ax < enemy.x + enemy.width &&
              ax + aw > enemy.x &&
              ay < enemy.y + enemy.height &&
              ay + ah > enemy.y) {

              enemy.hp -= p.damage;
              enemy.hitTimer = 15;

              // Knockback Physics (only on full charge)
              if (isFullyCharged) {
                const dx = (enemy.x + enemy.width / 2) - (p.x + p.width / 2);
                const dy = (enemy.y + enemy.height / 2) - (p.y + p.height / 2);
                const dist = Math.hypot(dx, dy) || 1;
                enemy.vx = (dx / dist) * KNOCKBACK_FORCE;
                enemy.vy = (dy / dist) * KNOCKBACK_FORCE;
              }

              if (enemy.hp <= 0) {
                enemy.dead = true;
                // Level Up!
                p.lv++;
                p.damage += p.damage * 0.001; // Увеличиваем урон на 0.1%
                p.hp = Math.min(100, p.hp + 5); // Добавляем 5 ХП, максимум 100
                setDialog(`* Вы победили ${enemy.name}!\n* Ваш УРОВЕНЬ повышен до ${p.lv}!`);
              } else {
                setDialog(`* Вы ударили ${enemy.name}.`);
              }
            }
          });
        }

        if (p.isAttacking) {
          p.attackTimer--;
          if (p.attackTimer <= 0) {
            p.isAttacking = false;
          }
        }

        // --- Enemy Physics & Logic ---
        s.enemies.forEach(enemy => {
          if (enemy.dead) return;

          if (enemy.hitTimer > 0) enemy.hitTimer -= speedScale;

          // Move towards player if not heavily knocked back
          if (enemy.hitTimer <= 10) {
            enemy.stateTimer += speedScale;
            const dx = p.x + p.width / 2 - (enemy.x + enemy.width / 2);
            const dy = p.y + p.height / 2 - (enemy.y + enemy.height / 2);
            const dist = Math.hypot(dx, dy);

            const enemyAccel = enemy.speed * speedScale * 0.3;

            switch (enemy.behavior) {
              case 'chase':
                if (dist > 0) {
                  enemy.vx += (dx / dist) * enemyAccel;
                  enemy.vy += (dy / dist) * enemyAccel;
                }
                break;
              case 'stop-and-go':
                if (Math.floor(enemy.stateTimer) % 120 < 60) {
                  if (dist > 0) {
                    enemy.vx += (dx / dist) * enemyAccel * 1.33;
                    enemy.vy += (dy / dist) * enemyAccel * 1.33;
                  }
                } else {
                  enemy.vx *= Math.pow(0.8, speedScale);
                  enemy.vy *= Math.pow(0.8, speedScale);
                }
                break;
              case 'erratic':
                if (dist > 0) {
                  const perpX = -dy / dist;
                  const perpY = dx / dist;
                  const jitter = Math.sin(enemy.stateTimer * 0.5) * 2;
                  enemy.vx += ((dx / dist) + perpX * jitter) * enemyAccel * 0.66;
                  enemy.vy += ((dy / dist) + perpY * jitter) * enemyAccel * 0.66;
                }
                break;
              case 'wander':
                if (Math.floor(enemy.stateTimer) % 90 === 0 || enemy.targetX === undefined) {
                  if (Math.random() > 0.5) {
                    enemy.targetX = p.x;
                    enemy.targetY = p.y;
                  } else {
                    enemy.targetX = Math.random() * CANVAS_WIDTH;
                    enemy.targetY = Math.random() * CANVAS_HEIGHT;
                  }
                }
                const tx = enemy.targetX! - enemy.x;
                const ty = enemy.targetY! - enemy.y;
                const tDist = Math.hypot(tx, ty);
                if (tDist > 0) {
                  enemy.vx += (tx / tDist) * enemyAccel;
                  enemy.vy += (ty / tDist) * enemyAccel;
                }
                break;
              case 'dash':
                if (Math.floor(enemy.stateTimer) % 100 < 70) {
                  if (dist > 0) {
                    enemy.vx += (dx / dist) * enemyAccel * 0.33;
                    enemy.vy += (dy / dist) * enemyAccel * 0.33;
                  }
                } else if (Math.floor(enemy.stateTimer) % 100 === 70) {
                  if (dist > 0) {
                    enemy.targetX = (dx / dist) * enemy.speed * 3;
                    enemy.targetY = (dy / dist) * enemy.speed * 3;
                  }
                } else {
                  enemy.vx = (enemy.targetX || 0) * speedScale;
                  enemy.vy = (enemy.targetY || 0) * speedScale;
                }
                break;
              case 'lunge':
                // Cycle: 60 frames wait (shakes), 30 frames dash
                const lungeCycle = Math.floor(enemy.stateTimer) % 90;
                if (lungeCycle < 60) {
                  // Shake effect
                  enemy.x += (Math.random() - 0.5) * 2;
                  enemy.y += (Math.random() - 0.5) * 2;
                  enemy.vx *= 0.5;
                  enemy.vy *= 0.5;
                  // Set dash target just before lunging
                  if (lungeCycle === 59) {
                    enemy.targetX = (dx / dist) * enemy.speed * 8;
                    enemy.targetY = (dy / dist) * enemy.speed * 8;
                  }
                } else {
                  enemy.vx = (enemy.targetX || 0) * speedScale;
                  enemy.vy = (enemy.targetY || 0) * speedScale;
                }
                break;
              case 'orbit':
                // Circles player and slowly drifts closer
                const angle = enemy.stateTimer * 0.05;
                const radius = 100 + Math.sin(enemy.stateTimer * 0.01) * 50;
                const ox = p.x + p.width / 2 + Math.cos(angle) * radius;
                const oy = p.y + p.height / 2 + Math.sin(angle) * radius;

                const odx = ox - enemy.x;
                const ody = oy - enemy.y;
                const oDist = Math.hypot(odx, ody);
                if (oDist > 0) {
                  enemy.vx += (odx / oDist) * enemyAccel * 0.5;
                  enemy.vy += (ody / oDist) * enemyAccel * 0.5;
                }
                break;
            }
          }

          enemy.vx *= Math.pow(ENEMY_FRICTION, speedScale);
          enemy.vy *= Math.pow(ENEMY_FRICTION, speedScale);
          enemy.x += enemy.vx * speedScale;
          enemy.y += enemy.vy * speedScale;

          // Collision with player
          const distToPlayer = Math.hypot(
            (p.x + p.width / 2) - (enemy.x + enemy.width / 2),
            (p.y + p.height / 2) - (enemy.y + enemy.height / 2)
          );

          if (distToPlayer < (p.width + enemy.width) / 2.2) {
            p.hp -= enemy.damage; // Drain HP based on enemy damage
            if (p.hp <= 0) {
              p.hp = 0;
              s.isGameOver = true;
              s.killerName = enemy.name;
            }
          }
        });

        // Check Victory
        if (s.hasMoved && s.availableEnemies.length === 0 && s.enemies.every(e => e.dead)) {
          s.isVictory = true;
        }
      }

      // --- Dialog Typewriter ---
      if (s.dialog.charIndex < s.dialog.fullText.length) {
        s.dialog.timer += speedScale;
        if (s.dialog.timer > 2) {
          s.dialog.timer = 0;
          s.dialog.charIndex++;
          s.dialog.currentText = s.dialog.fullText.substring(0, s.dialog.charIndex);
        }
      }
    };

    const draw = () => {
      const s = state.current;
      const p = s.player;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      const bottomUIHeight = 140;

      let boxW = CANVAS_WIDTH - 20;
      let boxH = CANVAS_HEIGHT - bottomUIHeight - 20;
      let boxX = 10;
      let boxY = 10;

      if (s.mode === 'TYPING') {
        boxW = 450;
        boxH = 160;
        boxX = (CANVAS_WIDTH - boxW) / 2;
        boxY = (CANVAS_HEIGHT - bottomUIHeight - boxH) / 2;
      }

      ctx.strokeRect(boxX, boxY, boxW, boxH);

      if (s.mode === 'ACTION') {
        s.enemies.forEach(enemy => {
          if (enemy.dead) return;

          ctx.save();
          ctx.translate(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);

          const w = enemy.width;
          const h = enemy.height;
          const hw = w / 2;
          const hh = h / 2;

          const img = enemyImages[enemy.name];
          if (img && img.complete && img.naturalWidth !== 0) {
            ctx.drawImage(img, -hw, -hh, w, h);
          } else if (img && img.dataset.failed === 'true') {
            // Draw a red box or something to indicate missing asset if we really want to remove shapes
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.strokeRect(-hw, -hh, w, h);
            ctx.fillStyle = '#fff';
            ctx.font = '8px monospace';
            ctx.fillText('ERR', -hw + 2, 0);
          } else {
            // Still loading? Draw a placeholder circle
            ctx.strokeStyle = '#666';
            ctx.beginPath();
            ctx.arc(0, 0, hw, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Hit effect overlay for images
          if (enemy.hitTimer > 0) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(-hw, -hh, w, h);
            ctx.globalCompositeOperation = 'source-over';
          }
          ctx.restore();

          const hpPercent = enemy.hp / enemy.maxHp;
          ctx.fillStyle = '#ff0000';
          ctx.fillRect(enemy.x, enemy.y - 10, enemy.width, 4);
          ctx.fillStyle = '#00ff00';
          ctx.fillRect(enemy.x, enemy.y - 10, enemy.width * hpPercent, 4);

          ctx.fillStyle = '#fff';
          ctx.font = '10px "Press Start 2P", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(enemy.name, enemy.x + enemy.width / 2, enemy.y - 15);
          ctx.textAlign = 'left';
        });

        // Draw Player
        let angle = 0;
        if (p.dir === 'DOWN') angle = Math.PI;
        else if (p.dir === 'LEFT') angle = -Math.PI / 2;
        else if (p.dir === 'RIGHT') angle = Math.PI / 2;

        ctx.save();
        ctx.translate(p.x + p.width / 2, p.y + p.height / 2);

        if (p.isCharging) {
          const scale = 1 + p.chargeLevel * 0.15;
          ctx.scale(scale, scale);
        }

        ctx.rotate(angle);
        ctx.drawImage(frogImage, -p.width / 2, -p.height / 2, p.width, p.height);
        ctx.restore();

        if (p.isCharging) {
          ctx.fillStyle = '#000';
          ctx.fillRect(p.x, p.y - 12, p.width, 6);
          ctx.fillStyle = '#f472b6';
          ctx.fillRect(p.x + 1, p.y - 11, (p.width - 2) * p.chargeLevel, 4);
        }

        // Draw Attack
        if (p.isAttacking) {
          ctx.fillStyle = '#f472b6';
          let ax = p.x;
          let ay = p.y;
          let aw = p.width;
          let ah = p.height;

          const progress = 1 - Math.abs((p.attackTimer - ATTACK_DURATION / 2) / (ATTACK_DURATION / 2));
          const currentLength = p.currentAttackLength * progress;

          if (p.dir === 'UP') { ay -= currentLength; ah = currentLength; aw = 8; ax += p.width / 2 - 4; }
          if (p.dir === 'DOWN') { ay += p.height; ah = currentLength; aw = 8; ax += p.width / 2 - 4; }
          if (p.dir === 'LEFT') { ax -= currentLength; aw = currentLength; ah = 8; ay += p.height / 2 - 4; }
          if (p.dir === 'RIGHT') { ax += p.width; aw = currentLength; ah = 8; ay += p.height / 2 - 4; }

          ctx.fillRect(ax, ay, aw, ah);
        }
      } else if (s.mode === 'TYPING') {
        const ts = s.typingState!;
        const blockWidth = 60;
        const blockHeight = 60;
        const startY = boxY + boxH / 2 - blockHeight / 2;

        ctx.save();

        // Clip to the smaller box
        ctx.beginPath();
        ctx.rect(boxX, boxY, boxW, boxH);
        ctx.clip();

        // Camera follows player
        const cameraX = p.x - 300;
        ctx.translate(boxX - cameraX, 0);

        // Draw blocks
        ctx.font = '24px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < ts.code.length; i++) {
          const bx = i * blockWidth;
          const char = ts.code[i];

          if (char === '-') {
            ctx.fillStyle = '#fff';
            ctx.fillRect(bx + blockWidth / 2 - 10, startY + blockHeight / 2 - 2, 20, 4);
            continue;
          }

          if (i < ts.currentIndex) {
            ctx.fillStyle = '#333'; // Typed
            ctx.fillRect(bx, startY, blockWidth - 5, blockHeight);
            ctx.fillStyle = '#000';
            ctx.fillText(char, bx + (blockWidth - 5) / 2, startY + blockHeight / 2);
          } else if (i === ts.currentIndex) {
            ctx.fillStyle = '#ff0'; // Current
            ctx.fillRect(bx, startY, blockWidth - 5, blockHeight);
            ctx.fillStyle = '#000';
            ctx.fillText(char, bx + (blockWidth - 5) / 2, startY + blockHeight / 2);
          } else {
            ctx.fillStyle = '#fff'; // Untyped
            ctx.fillRect(bx, startY, blockWidth - 5, blockHeight);
            // Hidden letter - do not draw text
          }
        }

        // Draw Fire (Гнев Ксюндры)
        ctx.fillStyle = '#ff4500';
        ctx.beginPath();
        ctx.arc(ts.fireX, startY + blockHeight / 2, 40 + Math.random() * 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff8c00';
        ctx.beginPath();
        ctx.arc(ts.fireX - 10, startY + blockHeight / 2, 30 + Math.random() * 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(ts.fireX - 20, startY + blockHeight / 2, 20 + Math.random() * 10, 0, Math.PI * 2);
        ctx.fill();

        // Draw Player
        ctx.drawImage(frogImage, p.x, p.y, p.width, p.height);

        ctx.restore();

        if (ts.isFinished && !s.isVictory && !s.isGameOver) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

          ctx.fillStyle = '#00ff00';
          ctx.font = '30px "Press Start 2P", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('КОД РАСШИФРОВАН!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);

          ctx.fillStyle = '#fff';
          ctx.font = '24px "Press Start 2P", monospace';
          ctx.fillText(ts.code, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

          ctx.fillStyle = '#aaa';
          ctx.font = '16px "Press Start 2P", monospace';
          ctx.fillText('Нажмите ENTER чтобы продолжить', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
          ctx.textAlign = 'left';
        }
      } else if (s.mode === 'BOSS_SELECT') {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#fff';
        ctx.font = '20px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ВЫБЕРИ СВОЕГО БОССА', CANVAS_WIDTH / 2, 50);

        const bs = s.battleState || { selectedAction: 0 };
        BOSS_NAMES.forEach((name, i) => {
          ctx.fillStyle = i === bs.selectedAction ? '#ff0' : '#444';
          ctx.font = '16px "Press Start 2P", monospace';
          ctx.fillText(name, CANVAS_WIDTH / 2, 110 + i * 35);
          if (i === bs.selectedAction) {
            ctx.fillText('>', CANVAS_WIDTH / 2 - 180, 110 + i * 35);
          }
        });
      } else if (s.mode === 'BATTLE') {
        const bs = s.battleState!;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw Boss
        const bImg = bossImages[bs.bossName];
        if (bImg && bImg.complete) {
          ctx.drawImage(bImg, CANVAS_WIDTH * 0.7 - 80, 80, 160, 160);
        }

        // Draw Player
        if (mainFrogBossImage.complete) {
          ctx.drawImage(mainFrogBossImage, CANVAS_WIDTH * 0.25 - 60, 230, 120, 120);
        }

        // UI Box
        ctx.fillStyle = '#000';
        ctx.fillRect(0, CANVAS_HEIGHT - 140, CANVAS_WIDTH, 140);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.strokeRect(5, CANVAS_HEIGHT - 135, CANVAS_WIDTH - 10, 130);

        // HP Bars
        const drawHP = (x: number, y: number, name: string, hp: number, maxHp: number) => {
          ctx.fillStyle = '#fff';
          ctx.font = '10px "Press Start 2P", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(name, x, y);
          ctx.fillStyle = '#333';
          ctx.fillRect(x, y + 10, 150, 10);
          ctx.fillStyle = '#0f0';
          ctx.fillRect(x, y + 10, 150 * (hp / maxHp), 10);
          ctx.fillStyle = '#fff';
          ctx.fillText(`${Math.ceil(hp)}/${maxHp}`, x + 160, y + 18);
        };

        drawHP(30, 40, 'АРТЕМЯУС', bs.playerHp, bs.playerMaxHp);
        drawHP(CANVAS_WIDTH - 250, 250, bs.bossName, bs.bossHp, bs.bossMaxHp);

        // Message / Menu
        ctx.fillStyle = '#fff';
        ctx.font = '12px "Press Start 2P"';
        ctx.textAlign = 'left';
        if (bs.turn === 'PLAYER' && !bs.isFinished) {
          if (bs.isItemMenuOpen) {
            ctx.fillText('Выберите предмет:', 30, CANVAS_HEIGHT - 110);
            bs.playerItems.forEach((item, i) => {
              ctx.fillStyle = i === bs.selectedItemIndex ? '#ff0' : '#fff';
              ctx.fillText(`${i === bs.selectedItemIndex ? '>' : ' '} ${item.name} (${item.count})`, 30, CANVAS_HEIGHT - 85 + i * 20);
            });
          } else {
            ctx.fillText('Выберите действие:', 30, CANVAS_HEIGHT - 100);
            const actions = ['АТАКА', 'ЗАЩИТА', 'ПРЕДМЕТЫ'];
            actions.forEach((a, i) => {
              ctx.fillStyle = i === bs.selectedAction ? '#ff0' : '#fff';
              ctx.fillText(`${i === bs.selectedAction ? '>' : ' '} ${a}`, 30, CANVAS_HEIGHT - 70 + i * 25);
            });
          }
        } else {
          const lines = bs.message.match(/.{1,35}(\s|$)/g) || [bs.message];
          lines.forEach((line, i) => {
            ctx.fillText(line.trim(), 30, CANVAS_HEIGHT - 90 + i * 25);
          });
        }
      }

      const uiY = CANVAS_HEIGHT - bottomUIHeight;

      ctx.fillStyle = '#fff';
      ctx.font = '16px "Press Start 2P", monospace';
      ctx.fillText(`УРОВЕНЬ ИГРЫ: ${s.level}`, 10, 25);

      const displayName = frogName.toUpperCase().substring(0, 8);
      ctx.fillText(`${displayName}   LV ${p.lv}`, 20, uiY + 30);
      ctx.fillText(`HP`, 280, uiY + 30);

      ctx.fillStyle = '#ff0000';
      ctx.fillRect(320, uiY + 15, 100, 20);
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(320, uiY + 15, 100 * (p.hp / p.maxHp), 20);
      ctx.fillStyle = '#fff';
      ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, 440, uiY + 30);

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, uiY + 50, CANVAS_WIDTH - 20, bottomUIHeight - 60);

      ctx.fillStyle = '#fff';
      ctx.font = '12px "Press Start 2P", monospace';
      const lines = s.dialog.currentText.split('\n');
      lines.forEach((line, i) => {
        // Auto-wrap if line is too long
        const wrappedLines = line.match(/.{1,45}(\s|$)/g) || [line];
        wrappedLines.forEach((wl, j) => {
          ctx.fillText(wl.trim(), 25, uiY + 80 + (i * 25 + j * 15));
        });
      });

      // Overlays
      if (s.isGameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#ff0000';
        ctx.font = '40px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ВЫ ПРОИГРАЛИ', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);

        if (s.killerName) {
          ctx.fillStyle = '#fff';
          ctx.font = '16px "Press Start 2P", monospace';
          ctx.fillText(`Вы проиграли от: ${s.killerName}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10);
        }

        ctx.fillStyle = '#fff';
        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillText('Нажмите R чтобы начать заново', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
        ctx.textAlign = 'left';
      } else if (s.isVictory) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#00ff00';
        ctx.font = '30px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('УРОВЕНЬ ПРОЙДЕН!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
        ctx.fillStyle = '#fff';
        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillText('Нажмите R чтобы перейти на следующий уровень', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
        ctx.textAlign = 'left';
      }
    };

    const loop = (time: number) => {
      const dt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      // Cap dt to avoid huge jumps if tab was inactive
      const cappedDt = Math.min(dt, 0.1);

      update(cappedDt);
      draw();
      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [frogName]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="bg-black border-4 border-gray-800 rounded-lg shadow-2xl"
        style={{ imageRendering: 'pixelated' }}
      />
      <div className="absolute -top-12 left-0 text-gray-500 text-sm">
        Управление: WASD / Стрелки. Атака: ПРОБЕЛ / Z. Перезапуск: R
      </div>
    </div>
  );
}

const VictoryScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        onComplete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onComplete]);

  return (
    <div className="absolute inset-0 bg-black flex flex-col items-center justify-center text-center p-8 space-y-8 animate-in fade-in duration-1000">
      <h1 className="text-6xl md:text-8xl font-black text-yellow-400 animate-bounce tracking-tighter">
        УИУИУИУ!
      </h1>
      <p className="text-3xl md:text-5xl text-white font-bold tracking-widest leading-tight">
        ПОЗДРАВЛЯЕМ С ДНЕМ РОЖДЕНИЯ!!!
      </p>
      <div className="flex space-x-6 text-5xl">
        <span className="animate-pulse">🎂</span>
        <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>🎈</span>
        <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>✨</span>
        <span className="animate-bounce" style={{ animationDelay: '0.6s' }}>🎉</span>
      </div>
      <p className="text-xl text-gray-400 mt-12 animate-pulse uppercase tracking-[0.3em]">
        Нажмите [ENTER] чтобы играть снова
      </p>
    </div>
  );
};

export default function App() {
  const [screen, setScreen] = useState<'START' | 'LOADING' | 'NAMING' | 'GAME' | 'VICTORY'>('LOADING');
  const [frogName, setFrogName] = useState('FROG');

  return (
    <div className="relative w-full h-screen bg-neutral-950 flex items-center justify-center overflow-hidden font-mono text-white select-none">
      {screen === 'LOADING' && <LoadingScreen onComplete={() => setScreen('NAMING')} />}
      {screen === 'NAMING' && <NamingScreen onComplete={(name) => { setFrogName(name); setScreen('GAME'); }} />}
      {screen === 'GAME' && <GameScreen frogName={frogName} onVictory={() => setScreen('VICTORY')} />}
      {screen === 'VICTORY' && <VictoryScreen onComplete={() => setScreen('NAMING')} />}
    </div>
  );
}
