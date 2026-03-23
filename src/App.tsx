import React, { useEffect, useRef, useState } from 'react';

// --- Constants & Types ---
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const FROG_SIZE = 32;
const ATTACK_DURATION = 15;
const TONGUE_LENGTH = 60;

// Physics constants for dynamic movement
const PLAYER_ACCEL = 0.8;
const PLAYER_FRICTION = 0.9;
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

type EnemyBehavior = 'chase' | 'stop-and-go' | 'erratic' | 'wander' | 'dash';
type EnemyShape = 'square' | 'circle' | 'triangle' | 'pentagon' | 'star';

interface EnemyType {
  name: string; hp: number; speed: number; color: string; width: number; height: number;
  behavior: EnemyBehavior; damage: number; shape: EnemyShape;
}

const ENEMY_TYPES: EnemyType[] = [
  { name: 'Токсичные тимейты', hp: 30, speed: 0.5, color: '#8b5cf6', width: 32, height: 32, behavior: 'chase', damage: 0.5, shape: 'circle' },
  { name: 'Боль в спине', hp: 50, speed: 0.25, color: '#ef4444', width: 40, height: 40, behavior: 'chase', damage: 1.0, shape: 'triangle' },
  { name: 'Депрессия', hp: 80, speed: 0.15, color: '#3b82f6', width: 48, height: 48, behavior: 'chase', damage: 0.2, shape: 'square' },
  { name: 'Голод', hp: 20, speed: 0.6, color: '#f59e0b', width: 24, height: 24, behavior: 'chase', damage: 0.8, shape: 'star' },
  { name: 'Плохая погода', hp: 40, speed: 0.4, color: '#6b7280', width: 36, height: 36, behavior: 'chase', damage: 0.5, shape: 'pentagon' },
  { name: 'Душка', hp: 60, speed: 0.35, color: '#10b981', width: 32, height: 32, behavior: 'chase', damage: 0.5, shape: 'circle' },
  { name: 'Нехватка сна', hp: 25, speed: 0.7, color: '#6366f1', width: 28, height: 28, behavior: 'chase', damage: 0.5, shape: 'star' },
  { name: 'Прокрастинация', hp: 45, speed: 1.2, color: '#d946ef', width: 34, height: 34, behavior: 'stop-and-go', damage: 0.5, shape: 'triangle' },
  { name: 'Тревога', hp: 35, speed: 0.7, color: '#f43f5e', width: 30, height: 30, behavior: 'erratic', damage: 0.7, shape: 'pentagon' },
  { name: 'Забывчивость', hp: 25, speed: 0.5, color: '#94a3b8', width: 28, height: 28, behavior: 'wander', damage: 0.3, shape: 'circle' },
  { name: 'Шумные соседи', hp: 55, speed: 1.3, color: '#eab308', width: 38, height: 38, behavior: 'dash', damage: 1.5, shape: 'star' },
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
  color: string;
  behavior: EnemyBehavior;
  damage: number;
  shape: EnemyShape;
  stateTimer: number;
  targetX?: number;
  targetY?: number;
}

interface TypingState {
  code: string;
  currentIndex: number;
  fireX: number;
  fireSpeed: number;
  isFinished: boolean;
}

interface GameState {
  mode: 'ACTION' | 'TYPING';
  typingState?: TypingState;
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
      setMessage('ОЙ, ЗАЧЕМ ТАК КРИЧАТЬ?! Раз ты такой грубый и повышаешь на меня буквы, я сам выберу тебе имя. Теперь ты... Артемяус.');
      setAttempt(3);
    } else if (attempt === 3) {
      onComplete('Артемяус');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full max-w-2xl px-4 text-center">
      <p className="text-xl md:text-2xl mb-12 h-32 leading-relaxed">{displayedMessage}</p>

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
            <div className="text-3xl uppercase tracking-widest text-yellow-400 animate-bounce mb-8">
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

function GameScreen({ frogName }: { frogName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  const getInitialState = (prevPlayer?: GameState['player'], level: number = 1): GameState => {
    const mode = level === 1 ? 'ACTION' : 'TYPING';
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

    return {
      mode,
      typingState,
      level,
      player: prevPlayer ? { ...prevPlayer, x: CANVAS_WIDTH / 2 - FROG_SIZE / 2, y: CANVAS_HEIGHT / 2 - FROG_SIZE / 2, hp: Math.min(100, prevPlayer.hp + 5) } : {
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
        fullText: `* Вы - ${frogName}, полная РЕШИМОСТИ Дон Лягушон.\n* Стрелочки/WASD - ходить.\n* Z или ПРОБЕЛ - атаковать языком.`,
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
            state.current = getInitialState(s.player, s.level + 1);
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

    const update = () => {
      const s = state.current;
      const p = s.player;

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
          ts.fireX += ts.fireSpeed / 60; // Assuming 60fps
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

      if (s.mode === 'ACTION') {
        // --- Player Physics & Movement ---
        let moved = false;
        if (!p.isAttacking) {
          if (s.keys['ArrowUp'] || s.keys['KeyW']) { p.vy -= PLAYER_ACCEL; p.dir = 'UP'; moved = true; }
          if (s.keys['ArrowDown'] || s.keys['KeyS']) { p.vy += PLAYER_ACCEL; p.dir = 'DOWN'; moved = true; }
          if (s.keys['ArrowLeft'] || s.keys['KeyA']) { p.vx -= PLAYER_ACCEL; p.dir = 'LEFT'; moved = true; }
          if (s.keys['ArrowRight'] || s.keys['KeyD']) { p.vx += PLAYER_ACCEL; p.dir = 'RIGHT'; moved = true; }
        }

        p.vx *= PLAYER_FRICTION;
        p.vy *= PLAYER_FRICTION;
        p.x += p.vx;
        p.y += p.vy;

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
          s.spawnTimer--;
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
              color: type.color,
              behavior: type.behavior,
              damage: type.damage,
              shape: type.shape,
              stateTimer: 0,
              hitTimer: 0,
              dead: false
            });
            s.spawnTimer = 180 + Math.random() * 240; // Next spawn in 3-7 seconds
          }
        }

        // --- Attack Logic ---
        const attackKey = s.keys['Space'] || s.keys['KeyZ'];

        if (attackKey && !p.isAttacking) {
          p.isCharging = true;
          p.chargeLevel = Math.min(1, p.chargeLevel + 0.05); // Takes 20 frames to fully charge
        } else if (!attackKey && p.isCharging) {
          p.isCharging = false;
          p.isAttacking = true;
          p.attackTimer = ATTACK_DURATION;

          const MIN_TONGUE_LENGTH = 15;
          const MAX_TONGUE_LENGTH = 180;
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

          if (enemy.hitTimer > 0) enemy.hitTimer--;

          // Move towards player if not heavily knocked back
          if (enemy.hitTimer <= 10) {
            enemy.stateTimer++;
            const dx = p.x + p.width / 2 - (enemy.x + enemy.width / 2);
            const dy = p.y + p.height / 2 - (enemy.y + enemy.height / 2);
            const dist = Math.hypot(dx, dy);

            switch (enemy.behavior) {
              case 'chase':
                if (dist > 0) {
                  enemy.vx += (dx / dist) * enemy.speed * 0.3;
                  enemy.vy += (dy / dist) * enemy.speed * 0.3;
                }
                break;
              case 'stop-and-go':
                if (enemy.stateTimer % 120 < 60) {
                  if (dist > 0) {
                    enemy.vx += (dx / dist) * enemy.speed * 0.4;
                    enemy.vy += (dy / dist) * enemy.speed * 0.4;
                  }
                } else {
                  enemy.vx *= 0.8;
                  enemy.vy *= 0.8;
                }
                break;
              case 'erratic':
                if (dist > 0) {
                  const perpX = -dy / dist;
                  const perpY = dx / dist;
                  const jitter = Math.sin(enemy.stateTimer * 0.5) * 2;
                  enemy.vx += ((dx / dist) + perpX * jitter) * enemy.speed * 0.2;
                  enemy.vy += ((dy / dist) + perpY * jitter) * enemy.speed * 0.2;
                }
                break;
              case 'wander':
                if (enemy.stateTimer % 90 === 0 || enemy.targetX === undefined) {
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
                  enemy.vx += (tx / tDist) * enemy.speed * 0.3;
                  enemy.vy += (ty / tDist) * enemy.speed * 0.3;
                }
                break;
              case 'dash':
                if (enemy.stateTimer % 100 < 70) {
                  if (dist > 0) {
                    enemy.vx += (dx / dist) * enemy.speed * 0.1;
                    enemy.vy += (dy / dist) * enemy.speed * 0.1;
                  }
                } else if (enemy.stateTimer % 100 === 70) {
                  if (dist > 0) {
                    enemy.targetX = (dx / dist) * enemy.speed * 3;
                    enemy.targetY = (dy / dist) * enemy.speed * 3;
                  }
                } else {
                  enemy.vx = enemy.targetX || 0;
                  enemy.vy = enemy.targetY || 0;
                }
                break;
            }
          }

          enemy.vx *= ENEMY_FRICTION;
          enemy.vy *= ENEMY_FRICTION;
          enemy.x += enemy.vx;
          enemy.y += enemy.vy;

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
        s.dialog.timer++;
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

          ctx.fillStyle = enemy.hitTimer > 0 ? '#ffffff' : enemy.color;

          ctx.save();
          ctx.translate(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);

          const w = enemy.width;
          const h = enemy.height;
          const hw = w / 2;
          const hh = h / 2;

          ctx.beginPath();
          if (enemy.shape === 'square') {
            ctx.rect(-hw, -hh, w, h);
          } else if (enemy.shape === 'circle') {
            ctx.arc(0, 0, hw, 0, Math.PI * 2);
          } else if (enemy.shape === 'triangle') {
            ctx.moveTo(0, -hh);
            ctx.lineTo(hw, hh);
            ctx.lineTo(-hw, hh);
            ctx.closePath();
          } else if (enemy.shape === 'pentagon') {
            for (let i = 0; i < 5; i++) {
              const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
              const px = Math.cos(angle) * hw;
              const py = Math.sin(angle) * hh;
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
          } else if (enemy.shape === 'star') {
            for (let i = 0; i < 10; i++) {
              const angle = (i * Math.PI) / 5 - Math.PI / 2;
              const radius = i % 2 === 0 ? hw : hw / 2;
              const px = Math.cos(angle) * radius;
              const py = Math.sin(angle) * radius;
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
          }
          ctx.fill();

          ctx.fillStyle = '#000';
          if (enemy.shape === 'square' || enemy.shape === 'pentagon') {
            ctx.fillRect(-hw + 4, -hh + 4, 4, 4);
            ctx.fillRect(hw - 8, -hh + 4, 4, 4);
          } else if (enemy.shape === 'circle') {
            ctx.fillRect(-hw + 6, -hh + 8, 4, 4);
            ctx.fillRect(hw - 10, -hh + 8, 4, 4);
          } else if (enemy.shape === 'triangle') {
            ctx.fillRect(-hw + 10, 0, 4, 4);
            ctx.fillRect(hw - 14, 0, 4, 4);
          } else if (enemy.shape === 'star') {
            ctx.fillRect(-hw + 8, -hh + 12, 4, 4);
            ctx.fillRect(hw - 12, -hh + 12, 4, 4);
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
      }

      const uiY = CANVAS_HEIGHT - bottomUIHeight;

      ctx.fillStyle = '#fff';
      ctx.font = '16px "Press Start 2P", monospace';
      ctx.fillText(`УРОВЕНЬ ИГРЫ: ${s.level}`, 10, 25);

      const displayName = frogName.toUpperCase().substring(0, 8);
      ctx.fillText(`${displayName}   LV ${p.lv}`, 30, uiY + 30);
      ctx.fillText(`HP`, 220, uiY + 30);

      ctx.fillStyle = '#ff0000';
      ctx.fillRect(260, uiY + 15, 100, 20);
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(260, uiY + 15, 100 * (p.hp / p.maxHp), 20);
      ctx.fillStyle = '#fff';
      ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, 380, uiY + 30);

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, uiY + 50, CANVAS_WIDTH - 20, bottomUIHeight - 60);

      ctx.fillStyle = '#fff';
      ctx.font = '14px "Press Start 2P", monospace';
      const lines = s.dialog.currentText.split('\n');
      lines.forEach((line, i) => {
        ctx.fillText(line, 30, uiY + 85 + (i * 25));
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

    const loop = () => {
      update();
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

export default function App() {
  const [appState, setAppState] = useState<'LOADING' | 'NAMING' | 'PLAYING'>('LOADING');
  const [frogName, setFrogName] = useState('FROG');

  return (
    <div className="min-h-screen bg-black flex items-center justify-center font-pixel text-white">
      {appState === 'LOADING' && <LoadingScreen onComplete={() => setAppState('NAMING')} />}
      {appState === 'NAMING' && (
        <NamingScreen
          onComplete={(name) => {
            setFrogName(name);
            setAppState('PLAYING');
          }}
        />
      )}
      {appState === 'PLAYING' && <GameScreen frogName={frogName} />}
    </div>
  );
}
