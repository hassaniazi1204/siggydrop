'use client';

import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { useSession, signOut } from 'next-auth/react';
import NextAuthModal from '../components/NextAuthModal';

// Ball level configuration
const BALL_CONFIG = [
  { level: 1, radius: 15, image: '/avatars/stefan2.png', color: '#8B5CF6', score: 10, name: 'stefan', shape: 'square' as const },
  { level: 2, radius: 20, image: '/avatars/raintaro2.png', color: '#3B82F6', score: 20, name: 'raintaro', shape: 'cylinder' as const },
  { level: 3, radius: 33, image: '/avatars/itoshi2.png', color: '#EC4899', score: 30, name: 'itoshi', shape: 'circle' as const },
  { level: 4, radius: 38, image: '/avatars/hinata2.png', color: '#F59E0B', score: 40, name: 'hinata', shape: 'circle' as const },
  { level: 5, radius: 43, image: '/avatars/willow.png', color: '#10B981', score: 50, name: 'willow', shape: 'circle' as const },
  { level: 6, radius: 48, image: '/avatars/jezz2.png', color: '#EF4444', score: 60, name: 'jezz', shape: 'circle' as const },
  { level: 7, radius: 53, image: '/avatars/dunken2.png', color: '#8B5CF6', score: 70, name: 'dunken', shape: 'circle' as const },
  { level: 8, radius: 58, image: '/avatars/josh2.png', color: '#3B82F6', score: 80, name: 'josh', shape: 'circle' as const },
  { level: 9, radius: 63, image: '/avatars/niraj2.png', color: '#EC4899', score: 90, name: 'niraj', shape: 'circle' as const },
  { level: 10, radius: 73, image: '/avatars/ritual2.png', color: '#F59E0B', score: 100, name: 'ritual', shape: 'circle' as const },
];

interface Ball {
  body: Matter.Body;
  level: number;
  image: HTMLImageElement;
  id: number;
}

let ballIdCounter = 0;

// Helper function to get random ball level (weighted towards lower levels)
const getRandomBallLevel = (): number => {
  const random = Math.random();
  if (random < 0.4) return 1;
  if (random < 0.7) return 2;
  if (random < 0.85) return 3;
  if (random < 0.95) return 4;
  return 5;
};

export default function MergeGame() {
  const { data: session, status } = useSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const worldRef = useRef<Matter.World | null>(null);
  const ballsRef = useRef<Ball[]>([]);
  const imagesRef = useRef<{ [key: number]: HTMLImageElement }>({});
  const processingMergeRef = useRef<Set<string>>(new Set());
  const siggyImageRef = useRef<HTMLImageElement | null>(null);
  const backdropImageRef = useRef<HTMLImageElement | null>(null);
  
  // Refs for render loop to access latest values
  const currentBallRef = useRef(1);
  const dropPositionRef = useRef(180);
  const canDropBallRef = useRef(true);
  const gameOverRef = useRef(false);
  const scoreRef = useRef(0);
  const nextBallRef = useRef(2);
    const userNameRef = useRef(''); // Store username in ref for immediate access
  
  // Frame-rate independence refs
  const lastTimeRef = useRef<number>(performance.now());
  const accumulatorRef = useRef<number>(0);
  
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [currentBall, setCurrentBall] = useState(1);
  const [nextBall, setNextBall] = useState(2);
  const [canDropBall, setCanDropBall] = useState(true);
  const [dropPosition, setDropPosition] = useState(180);
  const [userName, setUserName] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
 
  
  const [savingScore, setSavingScore] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Profile states
  const [userProfileImage, setUserProfileImage] = useState<string | null>(null);

  // Audio refs - created once and reused
  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);
  const dropSoundRef = useRef<HTMLAudioElement | null>(null);
  const mergeSoundRef = useRef<HTMLAudioElement | null>(null);
  const gameOverSoundRef = useRef<HTMLAudioElement | null>(null);
  
  const gameWidth = 360;
  const gameHeight = 800;
  const topBoundary = 380;  // Game over line - moved up for better difficulty (was 450)
  const wallThickness = 5;
  const spawnY = 310;  // Below larger Siggy (Siggy: y=100, height=200, so bottom=300, +10px spacing)

// ✅ FIXED AUTH STATE LISTENER

// NextAuth session handler
useEffect(() => {
  if (status === 'loading') return;

  if (session?.user) {
    // User is logged in with OAuth
    const name = session.user.name || session.user.email || 'Player';
    setUserName(name);
    userNameRef.current = name;
    setUserProfileImage(session.user.image || null);
    setShowAuthModal(false);
    
    // Start music
    if (backgroundMusicRef.current && !isMuted) {
      backgroundMusicRef.current.play().catch(console.warn);
    }
  } else if (!userName) {
    // No session and no guest username - show auth modal
    setShowAuthModal(true);
  }
}, [session, status, userName, isMuted]);


  // Handle mute toggle
  useEffect(() => {
    const audios = [
      backgroundMusicRef.current,
      dropSoundRef.current,
      mergeSoundRef.current,
      gameOverSoundRef.current,
    ];
    
    audios.forEach(audio => {
      if (audio) {
        audio.muted = isMuted;
      }
    });
    
    console.log(isMuted ? '🔇 Audio muted' : '🔊 Audio unmuted');
  }, [isMuted]);

  // Load all avatar images
  useEffect(() => {
    BALL_CONFIG.forEach((config) => {
      const img = new Image();
      img.src = config.image;
      img.crossOrigin = 'anonymous';
      imagesRef.current[config.level] = img;
    });
    
    // Load Siggy mascot image
    const siggyImg = new Image();
    siggyImg.src = '/avatars/siggy.png';
    siggyImg.crossOrigin = 'anonymous';
    siggyImageRef.current = siggyImg;
    
    // Load Game backdrop image
    const backdropImg = new Image();
    backdropImg.src = '/avatars/Game backdrop.png';
    backdropImg.crossOrigin = 'anonymous';
    backdropImageRef.current = backdropImg;
    
    // Initialize next ball
    setNextBall(getRandomBallLevel());
  }, []);

  // Initialize Matter.js physics engine
  useEffect(() => {
    if (!canvasRef.current || engineRef.current) return;

    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0.6 },  // Reduced gravity for slower, more controlled falling (50% of original 1.2)
    });
    engineRef.current = engine;
    worldRef.current = engine.world;

    const wallOptions = { isStatic: true, render: { fillStyle: '#8B5CF6' } };
    
    // Create thicker, more solid ground
    const groundHeight = 20;
    const ground = Matter.Bodies.rectangle(
      gameWidth / 2, 
      gameHeight - groundHeight / 2, 
      gameWidth, 
      groundHeight, 
      wallOptions
    );
    
    const leftWall = Matter.Bodies.rectangle(wallThickness / 2, gameHeight / 2, wallThickness, gameHeight, wallOptions);
    const rightWall = Matter.Bodies.rectangle(gameWidth - wallThickness / 2, gameHeight / 2, wallThickness, gameHeight, wallOptions);
    
    Matter.World.add(engine.world, [ground, leftWall, rightWall]);
    
    console.log('✅ Physics initialized - Ground at y:', gameHeight - groundHeight / 2);
    
    // Frame-rate independent game loop using deltaTime
    const FIXED_TIME_STEP = 1000 / 60; // 60 FPS fixed timestep
    lastTimeRef.current = performance.now();
    
    // Define render function FIRST (before gameLoop references it)
    const customRender = () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, gameWidth, gameHeight);
      
      // Draw Game backdrop image if loaded
      if (backdropImageRef.current && backdropImageRef.current.complete) {
        ctx.drawImage(backdropImageRef.current, 0, 0, gameWidth, gameHeight);
      } else {
        // Fallback to solid color if image not loaded yet
        ctx.fillStyle = '#0F0F23';
        ctx.fillRect(0, 0, gameWidth, gameHeight);
      }
      
      // Draw top boundary line
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(wallThickness, topBoundary);
      ctx.lineTo(gameWidth - wallThickness, topBoundary);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw walls (visual representation)
      const groundHeight = 20;
      ctx.fillStyle = '#8B5CF6';
      ctx.fillRect(0, gameHeight - groundHeight, gameWidth, groundHeight);
      ctx.fillRect(0, 0, wallThickness, gameHeight);
      ctx.fillRect(gameWidth - wallThickness, 0, wallThickness, gameHeight);

      // Remove balls that fell out of bounds
      ballsRef.current = ballsRef.current.filter(ball => {
        const inBounds = ball.body.position.y < gameHeight + 100; // Add buffer
        if (!inBounds && worldRef.current) {
          console.log(`❌ Ball ${ball.id} fell out of bounds at y=${ball.body.position.y}`);
          Matter.World.remove(worldRef.current, ball.body);
        }
        return inBounds;
      });

      // Draw all balls
      ballsRef.current.forEach((ball) => {
        const { body, level, image } = ball;
        const config = BALL_CONFIG[level - 1];
        
        // Debug: Log if ball position seems wrong
        if (body.position.y > gameHeight - 50 && body.position.y < gameHeight + 50) {
          console.log(`⚠️ Ball ${ball.id} near ground: y=${body.position.y.toFixed(1)}, velocity=${body.velocity.y.toFixed(2)}`);
        }
        
        ctx.save();
        ctx.translate(body.position.x, body.position.y);
        ctx.rotate(body.angle);

        // Vibration based on shape and level
        let vibrationIntensity = 0;
        if (config.shape === 'square') {
          vibrationIntensity = 0; // No vibration for Level 1
        } else if (config.shape === 'cylinder') {
          vibrationIntensity = 0.2; // Minimal vibration for Level 2
        } else {
          vibrationIntensity = level * 0.3; // Normal vibration for circles
        }
        
        const vibrationX = (Math.random() - 0.5) * vibrationIntensity;
        const vibrationY = (Math.random() - 0.5) * vibrationIntensity;

        // Draw based on shape
        if (config.shape === 'square') {
          // Square shape for Level 1 - no glow, minimal vibration
          const size = config.radius * 2;
          
          ctx.fillStyle = config.color;
          ctx.fillRect(
            vibrationX - config.radius,
            vibrationY - config.radius,
            size,
            size
          );

          if (image && image.complete) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(vibrationX - config.radius, vibrationY - config.radius, size, size);
            ctx.clip();
            ctx.drawImage(
              image,
              vibrationX - config.radius,
              vibrationY - config.radius,
              size,
              size
            );
            ctx.restore();
          }

          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.strokeRect(
            vibrationX - config.radius,
            vibrationY - config.radius,
            size,
            size
          );
        } else if (config.shape === 'cylinder') {
          // Capsule/Pill shape for Level 2 - rounded top and bottom
          const width = config.radius * 1.6;
          const height = config.radius * 2.4;
          const capRadius = width / 2; // Radius for rounded caps
          const rectHeight = height - width; // Height of middle section - DECLARE ONCE
          
          // Small glow for cylinder
          const gradient = ctx.createRadialGradient(vibrationX, vibrationY, 0, vibrationX, vibrationY, config.radius);
          gradient.addColorStop(0, config.color + '44');
          gradient.addColorStop(1, config.color + '00');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(vibrationX, vibrationY, config.radius + 2, 0, Math.PI * 2);
          ctx.fill();

          // Draw capsule as ONE path: rectangle + top semicircle + bottom semicircle
          ctx.fillStyle = config.color;
          ctx.beginPath();
          
          // Center rectangle
          ctx.rect(
            vibrationX - width / 2,
            vibrationY - rectHeight / 2,
            width,
            rectHeight
          );
          
          // Top semicircle (from Math.PI to 0, going clockwise)
          ctx.arc(
            vibrationX,
            vibrationY - rectHeight / 2,
            capRadius,
            Math.PI,
            0,
            false
          );
          
          // Bottom semicircle (from 0 to Math.PI, going clockwise)
          ctx.arc(
            vibrationX,
            vibrationY + rectHeight / 2,
            capRadius,
            0,
            Math.PI,
            false
          );
          
          ctx.fill();

          // Clip and draw image using same path
          if (image && image.complete) {
            ctx.save();
            ctx.beginPath();
            
            // Same path: rectangle + semicircles
            ctx.rect(
              vibrationX - width / 2,
              vibrationY - rectHeight / 2,
              width,
              rectHeight
            );
            ctx.arc(
              vibrationX,
              vibrationY - rectHeight / 2,
              capRadius,
              Math.PI,
              0,
              false
            );
            ctx.arc(
              vibrationX,
              vibrationY + rectHeight / 2,
              capRadius,
              0,
              Math.PI,
              false
            );
            ctx.clip();
            
            ctx.drawImage(
              image,
              vibrationX - width / 2,
              vibrationY - height / 2,
              width,
              height
            );
            ctx.restore();
          }

          // Draw border using same path (no seams)
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          
          ctx.rect(
            vibrationX - width / 2,
            vibrationY - rectHeight / 2,
            width,
            rectHeight
          );
          ctx.arc(
            vibrationX,
            vibrationY - rectHeight / 2,
            capRadius,
            Math.PI,
            0,
            false
          );
          ctx.arc(
            vibrationX,
            vibrationY + rectHeight / 2,
            capRadius,
            0,
            Math.PI,
            false
          );
          ctx.closePath();
          ctx.stroke();
        } else {
          // Circle shape for Levels 3-10 - normal rendering with glow
          const gradient = ctx.createRadialGradient(vibrationX, vibrationY, 0, vibrationX, vibrationY, config.radius);
          gradient.addColorStop(0, config.color + '66');
          gradient.addColorStop(1, config.color + '00');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(vibrationX, vibrationY, config.radius + 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = config.color;
          ctx.beginPath();
          ctx.arc(vibrationX, vibrationY, config.radius, 0, Math.PI * 2);
          ctx.fill();

          if (image && image.complete) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(vibrationX, vibrationY, config.radius - 1, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(
              image,
              vibrationX - config.radius,
              vibrationY - config.radius,
              config.radius * 2,
              config.radius * 2
            );
            ctx.restore();
          }

          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(vibrationX, vibrationY, config.radius, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();
      });

      // ============ TOP OVERLAY UI - INSIDE CANVAS ============
      
      // 1. Draw Score - Top Left (Transparent, no border)
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0)'; // Transparent background
      ctx.fillRect(10, 10, 140, 80);
      
      // Score label
      ctx.fillStyle = '#E554E8';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('SCORE', 20, 30);
      
      // Score value (using ref for live updates)
      ctx.fillStyle = '#8840FF';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(scoreRef.current.toString(), 20, 65);
      ctx.restore();
      
      // 2. Draw Next Ball - Top Right (Right-aligned, inside canvas)
      const nextBallConfig = BALL_CONFIG[nextBallRef.current - 1];
      const nextBallImage = imagesRef.current[nextBallRef.current];
      
      ctx.save();
      // Background panel - transparent
      ctx.fillStyle = 'rgba(0, 0, 0, 0)'; // Transparent background
      ctx.fillRect(gameWidth - 100, 10, 90, 80);
      
      // Label - Right aligned
      ctx.fillStyle = '#E554E8';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('NEXT', gameWidth - 20, 30);
      
      // Next ball circle - positioned below "NEXT" text, right-aligned
      const ballX = gameWidth - 50; // 50px from right edge (20px margin + 30px for ball centering)
      ctx.fillStyle = nextBallConfig.color;
      ctx.beginPath();
      ctx.arc(ballX, 60, 20, 0, Math.PI * 2);
      ctx.fill();
      
      // Next ball image
      if (nextBallImage && nextBallImage.complete) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ballX, 60, 19, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(
          nextBallImage,
          ballX - 20,
          60 - 20,
          40,
          40
        );
        ctx.restore();
      }
      
      // Border around ball
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ballX, 60, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Draw preview ball following cursor (positioned at bottom of Siggy)
      if (!gameOverRef.current && canDropBallRef.current) {
        const previewConfig = BALL_CONFIG[currentBallRef.current - 1];
        const previewImage = imagesRef.current[currentBallRef.current];
        
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.translate(dropPositionRef.current, spawnY);

        // Draw based on shape
        if (previewConfig.shape === 'square') {
          // Square preview
          const size = previewConfig.radius * 2;
          ctx.fillStyle = previewConfig.color;
          ctx.fillRect(-previewConfig.radius, -previewConfig.radius, size, size);

          if (previewImage && previewImage.complete) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(-previewConfig.radius, -previewConfig.radius, size, size);
            ctx.clip();
            ctx.drawImage(
              previewImage,
              -previewConfig.radius,
              -previewConfig.radius,
              size,
              size
            );
            ctx.restore();
          }

          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.strokeRect(-previewConfig.radius, -previewConfig.radius, size, size);
        } else if (previewConfig.shape === 'cylinder') {
          // Capsule preview (pill shape) - rect + semicircles
          const width = previewConfig.radius * 1.6;
          const height = previewConfig.radius * 2.4;
          const capRadius = width / 2;
          const rectHeight = height - width;

          // Draw as ONE path: rectangle + semicircles
          ctx.fillStyle = previewConfig.color;
          ctx.beginPath();
          
          ctx.rect(-width / 2, -rectHeight / 2, width, rectHeight);
          ctx.arc(0, -rectHeight / 2, capRadius, Math.PI, 0, false);
          ctx.arc(0, rectHeight / 2, capRadius, 0, Math.PI, false);
          ctx.fill();

          if (previewImage && previewImage.complete) {
            ctx.save();
            ctx.beginPath();
            
            ctx.rect(-width / 2, -rectHeight / 2, width, rectHeight);
            ctx.arc(0, -rectHeight / 2, capRadius, Math.PI, 0, false);
            ctx.arc(0, rectHeight / 2, capRadius, 0, Math.PI, false);
            ctx.clip();
            
            ctx.drawImage(
              previewImage,
              -width / 2,
              -height / 2,
              width,
              height
            );
            ctx.restore();
          }

          // Border using same path
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          
          ctx.rect(-width / 2, -rectHeight / 2, width, rectHeight);
          ctx.arc(0, -rectHeight / 2, capRadius, Math.PI, 0, false);
          ctx.arc(0, rectHeight / 2, capRadius, 0, Math.PI, false);
          ctx.closePath();
          ctx.stroke();
        } else {
          // Circle preview (normal)
          ctx.fillStyle = previewConfig.color;
          ctx.beginPath();
          ctx.arc(0, 0, previewConfig.radius, 0, Math.PI * 2);
          ctx.fill();

          if (previewImage && previewImage.complete) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, previewConfig.radius - 1, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(
              previewImage,
              -previewConfig.radius,
            -previewConfig.radius,
            previewConfig.radius * 2,
            previewConfig.radius * 2
          );
          ctx.restore();
        }

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, previewConfig.radius, 0, Math.PI * 2);
        ctx.stroke();
        }
        
        ctx.restore();

        // Draw drop guide line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(dropPositionRef.current, spawnY + previewConfig.radius);
        ctx.lineTo(dropPositionRef.current, gameHeight - wallThickness);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }; // End of customRender
    
    // NOW define gameLoop (after customRender is defined)
    const gameLoop = () => {
      if (!engineRef.current) return;
      
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;
      
      accumulatorRef.current += deltaTime;
      
      while (accumulatorRef.current >= FIXED_TIME_STEP) {
        Matter.Engine.update(engineRef.current, FIXED_TIME_STEP);
        accumulatorRef.current -= FIXED_TIME_STEP;
      }
      
      customRender();
      requestAnimationFrame(gameLoop);
    };
    
    // Start the game loop
    gameLoop();

    // Collision detection
    Matter.Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach((pair) => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        if (bodyA.isStatic || bodyB.isStatic) return;

        // Use parent body for compound bodies (Level 2 cylinders)
        const parentA = bodyA.parent || bodyA;
        const parentB = bodyB.parent || bodyB;
        
        // Skip if same body (shouldn't happen but just in case)
        if (parentA.id === parentB.id) return;

        const ballA = ballsRef.current.find(b => b.body.id === parentA.id);
        const ballB = ballsRef.current.find(b => b.body.id === parentB.id);

        // Both balls must exist
        if (!ballA || !ballB) return;
        
        // STRICT CHECK: Only merge if EXACT same level
        if (ballA.level !== ballB.level) {
          console.log(`❌ Merge blocked: Different levels (${ballA.level} vs ${ballB.level})`);
          return;
        }
        
        // Additional safety: Verify both balls have the same level
        const levelA = ballA.level;
        const levelB = ballB.level;
        if (levelA !== levelB) {
          console.error(`⚠️ Level mismatch detected: ballA.level=${levelA}, ballB.level=${levelB}`);
          return;
        }

        // Use parent body IDs for merge key to prevent duplicates
        const mergeKey = [ballA.id, ballB.id].sort().join('-');
        if (processingMergeRef.current.has(mergeKey)) return;
        processingMergeRef.current.add(mergeKey);

        console.log(`✅ Merging: Level ${levelA} + Level ${levelB} → Level ${levelA === 10 ? 1 : levelA + 1}`);

        const mergeLevel = ballA.level;
        const mergeScore = BALL_CONFIG[mergeLevel - 1].score;
        
        const mergeX = (parentA.position.x + parentB.position.x) / 2;
        const mergeY = (parentA.position.y + parentB.position.y) / 2;

        // Play merge sound
        if (mergeSoundRef.current && !isMuted) {
          mergeSoundRef.current.currentTime = 0; // Reset for rapid merges
          mergeSoundRef.current.play().catch(error => {
            console.warn('Merge sound play failed:', error);
          });
        }

        Matter.World.remove(engine.world, parentA);
        Matter.World.remove(engine.world, parentB);
        
        ballsRef.current = ballsRef.current.filter(b => b.id !== ballA.id && b.id !== ballB.id);

        const newLevel = mergeLevel === 10 ? 1 : mergeLevel + 1;
        
        setTimeout(() => {
          createBall(mergeX, mergeY, newLevel);
          setScore(prev => {
            const newScore = prev + mergeScore;
            scoreRef.current = newScore;
            return newScore;
          });
          processingMergeRef.current.delete(mergeKey);
        }, 50);
      });
    });

    // Game over detection
    const checkGameOver = setInterval(() => {
      if (gameOver) return;
      
      const anyBallAbove = ballsRef.current.some(ball => {
        const config = BALL_CONFIG[ball.level - 1];
        const topOfBall = ball.body.position.y - config.radius;
        const isAboveLine = topOfBall < topBoundary;
        
        // Ball must be significantly below spawn point to count as "settled"
        const hasMovedFromSpawn = ball.body.position.y > spawnY + 50;
        
        // Ball must have very low velocity AND be below spawn area
        const isSettled = Math.abs(ball.body.velocity.y) < 0.2 && 
                         Math.abs(ball.body.velocity.x) < 0.2 &&
                         hasMovedFromSpawn;
        
        return isAboveLine && isSettled;
      });
      
      if (anyBallAbove) {
        setGameOver(true);
        gameOverRef.current = true;
        
        // Stop background music and play game over sound
        if (backgroundMusicRef.current) {
          backgroundMusicRef.current.pause();
          console.log('🎵 Background music stopped');
        }
        if (gameOverSoundRef.current && !isMuted) {
          gameOverSoundRef.current.currentTime = 0;
          gameOverSoundRef.current.play().catch(error => {
            console.warn('Game over sound play failed:', error);
          });
          console.log('💀 Game over sound played');
        }
        
        // Auto-save score to leaderboard - use refs for accuracy
        const finalScore = scoreRef.current;
        const finalUsername = userNameRef.current;
        console.log('Game Over! Username:', finalUsername, 'Score:', finalScore);
        
        if (finalUsername && finalUsername.trim().length > 0) {
          console.log('Saving to leaderboard...');
          saveScoreToLeaderboard(finalUsername, finalScore);
        } else {
          console.error('Cannot save: No username found!');
          console.error('userNameRef.current:', userNameRef.current);
          console.error('userName state:', userName);
          alert('Error: Username not found. Please restart the game.');
        }
      }
    }, 500);

    return () => {
      clearInterval(checkGameOver);
      Matter.World.clear(engine.world, false);
      Matter.Engine.clear(engine);
      ballsRef.current = [];
      processingMergeRef.current.clear();
      engineRef.current = null;
      worldRef.current = null;
    };
  }, [gameOver]);

  const createBall = (x: number, y: number, level: number) => {
    if (!worldRef.current) return;

    const config = BALL_CONFIG[level - 1];
    let body: Matter.Body;

    // Create different shapes based on level
    if (config.shape === 'square') {
      // Level 1: Square - Heavy, stable, minimal bounce
      const size = config.radius * 2; // Use radius as half-size
      body = Matter.Bodies.rectangle(x, y, size, size, {
        restitution: 0.1,     // Almost no bounce
        friction: 0.8,        // High friction for stability
        density: 0.005,       // Heaviest (2.5x normal)
        frictionAir: 0.001,
      });
    } else if (config.shape === 'cylinder') {
      // Level 2: Capsule (rounded top and bottom) - Medium-heavy
      const width = config.radius * 1.6;
      const height = config.radius * 2.4;
      
      // Create compound body: top circle + middle rectangle + bottom circle
      const capRadius = width / 2;
      const rectHeight = height - width;
      
      const topCircle = Matter.Bodies.circle(x, y - rectHeight / 2, capRadius, { label: 'top' });
      const middleRect = Matter.Bodies.rectangle(x, y, width, rectHeight, { label: 'middle' });
      const bottomCircle = Matter.Bodies.circle(x, y + rectHeight / 2, capRadius, { label: 'bottom' });
      
      body = Matter.Body.create({
        parts: [middleRect, topCircle, bottomCircle],
        restitution: 0.2,     // Low bounce
        friction: 0.6,        // Medium-high friction
        density: 0.003,       // Heavy (1.5x normal)
        frictionAir: 0.002,
      });
    } else {
      // Levels 3-10: Circle - Normal physics
      body = Matter.Bodies.circle(x, y, config.radius, {
        restitution: 0.3,     // Slight bounce
        friction: 0.5,        // More friction
        density: 0.002,       // Normal
        frictionAir: 0.002,
      });
    }

    // Give ball initial downward velocity so it starts falling immediately
    Matter.Body.setVelocity(body, { x: 0, y: 2 });

    Matter.World.add(worldRef.current, body);
    
    ballsRef.current.push({
      body,
      level,
      image: imagesRef.current[level],
      id: ballIdCounter++,
    });
    
    console.log(`✅ Ball created: Level ${level}, ID ${ballIdCounter - 1}, Position (${x}, ${y}), Total balls: ${ballsRef.current.length}`);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameOver || !canDropBall) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const scaleX = gameWidth / rect.width;
    const actualX = x * scaleX;
    
    const config = BALL_CONFIG[currentBall - 1];
    const clampedX = Math.max(
      wallThickness + config.radius + 2, 
      Math.min(gameWidth - wallThickness - config.radius - 2, actualX)
    );
    
    // Prevent multiple drops
    setCanDropBall(false);
    canDropBallRef.current = false;
    
    createBall(clampedX, spawnY, currentBall);
    
    // Play drop sound
    if (dropSoundRef.current && !isMuted) {
      dropSoundRef.current.currentTime = 0; // Reset to start for rapid drops
      dropSoundRef.current.play().catch(error => {
        console.warn('Drop sound play failed:', error);
      });
    }
    
    // Update ball queue
    setCurrentBall(nextBall);
    currentBallRef.current = nextBall;
    const newNextBall = getRandomBallLevel();
    setNextBall(newNextBall);
    nextBallRef.current = newNextBall;
    
    // Re-enable dropping after delay
    setTimeout(() => {
      setCanDropBall(true);
      canDropBallRef.current = true;
    }, 500);
  };

  // Touch handlers - separate movement from drop
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (gameOver || !canDropBall) return;
    e.preventDefault(); // Prevent scrolling
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || e.touches.length === 0) return;

    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const scaleX = gameWidth / rect.width;
    const actualX = x * scaleX;
    
    const config = BALL_CONFIG[currentBall - 1];
    const clampedX = Math.max(
      wallThickness + config.radius + 2, 
      Math.min(gameWidth - wallThickness - config.radius - 2, actualX)
    );
    
    // Update position only, don't drop yet
    setDropPosition(clampedX);
    dropPositionRef.current = clampedX;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (gameOver || !canDropBall) return;
    e.preventDefault();
    
    // Drop ball at current position
    const clampedX = dropPositionRef.current;
    
    // Prevent multiple drops
    setCanDropBall(false);
    canDropBallRef.current = false;
    
    createBall(clampedX, spawnY, currentBall);
    
    // Play drop sound
    if (dropSoundRef.current && !isMuted) {
      dropSoundRef.current.currentTime = 0; // Reset to start for rapid drops
      dropSoundRef.current.play().catch(error => {
        console.warn('Drop sound play failed:', error);
      });
    }
    
    // Update ball queue
    setCurrentBall(nextBall);
    currentBallRef.current = nextBall;
    const newNextBall = getRandomBallLevel();
    setNextBall(newNextBall);
    nextBallRef.current = newNextBall;
    
    // Re-enable dropping after delay
    setTimeout(() => {
      setCanDropBall(true);
      canDropBallRef.current = true;
    }, 500);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameOver || !canDropBall) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const scaleX = gameWidth / rect.width;
    const actualX = x * scaleX;
    
    const config = BALL_CONFIG[currentBall - 1];
    const clampedX = Math.max(
      wallThickness + config.radius + 2, 
      Math.min(gameWidth - wallThickness - config.radius - 2, actualX)
    );
    setDropPosition(clampedX);
    dropPositionRef.current = clampedX;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (gameOver || !canDropBall) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || e.touches.length === 0) return;
    
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const scaleX = gameWidth / rect.width;
    const actualX = x * scaleX;
    
    const config = BALL_CONFIG[currentBall - 1];
    const clampedX = Math.max(
      wallThickness + config.radius + 2, 
      Math.min(gameWidth - wallThickness - config.radius - 2, actualX)
    );
    setDropPosition(clampedX);
    dropPositionRef.current = clampedX;
  };

  const restartGame = () => {
    // Reset game state
    setScore(0);
    scoreRef.current = 0;
    setGameOver(false);
    gameOverRef.current = false;
    setSavingScore(false);
    setCurrentBall(1);
    currentBallRef.current = 1;
    const newNextBall = getRandomBallLevel();
    setNextBall(newNextBall);
    nextBallRef.current = newNextBall;
    setCanDropBall(true);
    canDropBallRef.current = true;
    ballsRef.current = [];
    processingMergeRef.current.clear();
    ballIdCounter = 0;
    
    // Reset user inputs
    setShowAuthModal(true);
    setUserName('');
    userNameRef.current = ''; // Clear username ref
    
    // Stop background music (will restart when user clicks Start Game again)
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.pause();
      backgroundMusicRef.current.currentTime = 0; // Reset to beginning
      console.log('🎵 Background music stopped for restart');
    }
    
    // Clear physics world
    if (engineRef.current && worldRef.current) {
      const bodies = Matter.Composite.allBodies(worldRef.current);
      bodies.forEach(body => {
        if (!body.isStatic) {
          Matter.World.remove(worldRef.current!, body);
        }
      });
    }
  };

  const handleGuestLogin = (username: string) => {
    setUserName(username);
    userNameRef.current = username;
    setShowAuthModal(false);
    
    // Start music for guest
    if (backgroundMusicRef.current && !isMuted) {
      backgroundMusicRef.current.play().catch(console.warn);
    }
    };

  const handleLogout = async () => {
    if (session) {
      // OAuth user - sign out with NextAuth
      await signOut({ callbackUrl: '/' });
    } else {
      // Guest user - just clear state
      setUserName('');
      userNameRef.current = '';
      setUserProfileImage(null);
      setShowAuthModal(true);
    }
  };



  const saveScoreToLeaderboard = async (username: string, finalScore: number) => {
    console.log('saveScoreToLeaderboard called with:', { username, finalScore });
    
    try {
      setSavingScore(true);

      console.log('Sending POST request to /api/leaderboard...');
      const response = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          score: finalScore,
        }),
      });

      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Response data:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save score');
      }

      console.log('Score saved successfully! Redirecting to leaderboard...');
      
      // Only redirect on success
      setTimeout(() => {
        window.location.href = `/leaderboard?username=${encodeURIComponent(username)}&score=${finalScore}`;
      }, 1500);
    } catch (error) {
      console.error('Error saving score to leaderboard:', error);
      setSavingScore(false); // Stop showing saving message
      
      // Show detailed error message and DO NOT redirect
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`❌ Failed to save your score!\n\nError: ${errorMessage}\n\nPlease check:\n1. Your internet connection\n2. Supabase credentials are set in Vercel\n3. The leaderboard table exists\n\nYour score (${finalScore}) was NOT saved.`);
      
      // Do NOT redirect - let user stay on game page
    }
  };

  return (
    <main 
      className="min-h-screen relative overflow-hidden"
      style={{
        backgroundImage: 'url(/brand-assets/Patterns/Layers.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        fontFamily: "'Barlow', sans-serif",
      }}
    >
{/* Loading State - Only while checking auth */}
      {status === 'loading' && (
  <div style={{
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.95)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '60px',
        height: '60px',
        border: '4px solid rgba(64, 255, 175, 0.2)',
        borderTop: '4px solid #40FFAF',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 20px',
      }} />
      <p style={{
        color: '#FFFFFF',
        fontSize: '1.1rem',
        fontFamily: "'Barlow-Bold', 'Barlow', sans-serif",
      }}>
        Loading...
      </p>
    </div>
  </div>
)}


      {/* Auth Modal - Show after check completes AND no session */}
      {showAuthModal && (
  <NextAuthModal
    isOpen={showAuthModal}
    onGuestLogin={handleGuestLogin}
  />
)}


      {/* Profile Header - Only show when logged in and not in auth modal */}
      {!showAuthModal && userName && (
  <div className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-md border-b border-purple-500/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Left side - Logo/Title */}
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  SIGGYDROP
                </span>
              </div>
              
              {/* Right side - Profile */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 bg-gray-900/80 rounded-full px-4 py-2 border border-purple-500/30">
                  {userProfileImage ? (
                    <img 
                      src={userProfileImage} 
                      alt={userName}
                      className="w-8 h-8 rounded-full border-2 border-purple-400 object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full border-2 border-purple-400 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-white font-semibold text-sm hidden sm:inline">
                    {userName}
                  </span>
                </div>
                {/* Only show logout for OAuth users (those with session) */}
    {session && (
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-semibold text-sm transition-colors border border-red-500/30 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  {/* logout icon */}
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dark overlay for better contrast */}
      <div className="fixed inset-0 bg-black/40" style={{ zIndex: 0 }}></div>

      {/* Content */}
      <div className={`relative z-10 p-4 md:p-8 ${!showAuthModal && userName ? 'pt-20 md:pt-24' : ''}`}>
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-8">
          <div className="flex justify-between items-center">
            <a
              href="/"
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 border-2 border-purple-400/30 rounded-xl font-bold text-white hover:scale-105 transition-transform shadow-lg shadow-purple-500/30"
              style={{ fontFamily: "'Barlow-Bold', 'Barlow', sans-serif" }}
            >
              ← Home
            </a>
            <div className="text-center flex justify-center">
              <img
                src="/brand-assets/Lockup/Translucent.png"
                alt="Ritual"
                style={{
                  height: 'auto',
                  width: 'clamp(200px, 40vw, 400px)',
                  filter: 'drop-shadow(0 0 30px rgba(64,255,175,0.4))',
                }}
              />
            </div>
            {/* Mute/Unmute Button */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="px-6 py-3 bg-gradient-to-r from-green-400 to-emerald-600 border-2 border-green-400/30 rounded-xl font-bold text-black hover:scale-105 transition-transform shadow-lg shadow-green-400/30"
              style={{ fontFamily: "'Barlow-Bold', 'Barlow', sans-serif" }}
              title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
            >
              {isMuted ? '🔇 Unmute' : '🔊 Mute'}
            </button>
          </div>
        </div>

      <div className="max-w-4xl mx-auto px-4 relative">
        {/* Left Side - SIGGYDROP (top to bottom) */}
        <div 
          className="hidden xl:block absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full"
          style={{
            writingMode: 'vertical-rl',
            transform: 'translateY(-50%) translateX(calc(-100% - 2rem)) rotate(180deg)',
            fontSize: 'clamp(6rem, 8vw, 10rem)',
            fontWeight: 900,
            fontFamily: "'Barlow-ExtraBold', 'Barlow', sans-serif",
            background: 'linear-gradient(to bottom, #E554E8, #8840FF)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '0.00001em',
            height: '77vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          SIGGYDROP
        </div>

        {/* Right Side - SIGGYDROP (bottom to top) */}
        <div 
          className="hidden xl:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-full"
          style={{
            writingMode: 'vertical-rl',
            transform: 'translateY(-50%) translateX(calc(100% + 2rem))',
            fontSize: 'clamp(6rem, 8vw, 10rem)',
            fontWeight: 900,
            fontFamily: "'Barlow-ExtraBold', 'Barlow', sans-serif",
            background: 'linear-gradient(to bottom, #E554E8, #8840FF)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '0.00001em',
            height: '77vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          SIGGYDROP
        </div>

        {/* Game Layout */}
        <div className="flex flex-col lg:flex-row items-start justify-center gap-8 lg:gap-20">
        {/* Game Canvas */}
        <div className="flex-shrink-0 order-3 lg:order-1 w-full lg:w-auto">
          <div className="relative inline-block w-full max-w-[360px] mx-auto lg:mx-0" style={{ overflow: 'visible' }}>
            <canvas
              ref={canvasRef}
              width={gameWidth}
              height={gameHeight}
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="border-2 border-green-400/20 rounded-2xl cursor-crosshair bg-black shadow-inner"
              style={{ 
                width: '100%',
                maxWidth: '360px',
                height: 'auto',
                touchAction: 'none',
                display: 'block',
                WebkitTapHighlightColor: 'transparent',
                userSelect: 'none',
              }}
            />
            
            {/* Siggy Mascot - DOM Overlay (aligned with ball) */}
            {!gameOver && canvasRef.current && (() => {
              const rect = canvasRef.current.getBoundingClientRect();
              const scaleX = rect.width / gameWidth;
              const scaleY = rect.height / gameHeight;
              
              // Siggy dimensions
              const siggyCanvasSize = 200;
              const siggyScreenWidth = siggyCanvasSize * scaleX;
              const siggyScreenHeight = siggyCanvasSize * scaleY;
              
              // Siggy X position - aligned with dropPosition (already clamped)
              const siggyScreenX = dropPosition * scaleX;
              
              // Siggy Y position - positioned so ball spawns right below Siggy
              // Ball spawns at spawnY=310, Siggy top should be at 310-200=110 to have ball at bottom
              const siggyCanvasY = spawnY - siggyCanvasSize; // 310 - 200 = 110
              const siggyScreenY = siggyCanvasY * scaleY;
              
              return (
                <img
                  src="/avatars/siggy.png"
                  alt="Siggy"
                  style={{
                    position: 'absolute',
                    width: `${siggyScreenWidth}px`,
                    height: `${siggyScreenHeight}px`,
                    top: `${siggyScreenY}px`,
                    left: `${siggyScreenX}px`,
                    transform: 'translateX(-50%)',
                    opacity: 0.95,
                    pointerEvents: 'none',
                    zIndex: 5,
                  }}
                />
              );
            })()}
            
            {gameOver && savingScore && (
              <div className="absolute inset-0 bg-black/95 backdrop-blur-md rounded-2xl flex items-center justify-center p-4">
                <div className="text-center space-y-6 max-w-sm w-full bg-gradient-to-br from-gray-900 to-black border-2 border-green-400/50 rounded-2xl p-8 shadow-2xl">
                  <div className="text-5xl mb-2">🎮</div>
                  <h2 className="text-4xl font-black bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent">
                    Game Over!
                  </h2>
                  <div className="bg-black/50 rounded-xl p-6 border border-green-400/30">
                    <div className="text-sm text-white/50 mb-2">Final Score</div>
                    <p className="text-6xl font-black bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent">
                      {score}
                    </p>
                    <p className="text-lg text-white/70 mt-2">Points</p>
                  </div>
                  
                  <div className="text-center space-y-4">
                    <div className="text-xl text-green-400 font-bold animate-pulse">
                      💾 Saving your score...
                    </div>
                    <div className="text-sm text-white/70">
                      Redirecting to leaderboard
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Sidebar */}
        <div className="flex-shrink-0 w-full lg:w-80 space-y-6">
          {/* How to Play */}
          <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-purple-500/30 p-6 rounded-2xl backdrop-blur-xl shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🎮</span>
              <h3 
                className="text-xl font-black"
                style={{ 
                  color: '#E554E8',
                  fontFamily: "'Barlow-ExtraBold', 'Barlow', sans-serif",
                }}
              >
                How to Play
              </h3>
            </div>
            <ul 
              className="space-y-3 text-sm"
              style={{ 
                color: '#111111',
                fontFamily: "'Barlow-Regular', 'Barlow', sans-serif",
              }}
            >
              <li className="flex items-start gap-2">
                <span style={{ color: '#8840FF' }} className="font-bold mt-0.5">►</span>
                <span style={{ color: '#FFFFFF' }}>Click to drop balls</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: '#8840FF' }} className="font-bold mt-0.5">►</span>
                <span style={{ color: '#FFFFFF' }}>Merge same levels</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: '#8840FF' }} className="font-bold mt-0.5">►</span>
                <span style={{ color: '#FFFFFF' }}>Level up to score</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: '#8840FF' }} className="font-bold mt-0.5">►</span>
                <span style={{ color: '#FFFFFF' }}>Lv10 + Lv10 = Lv1</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: '#8840FF' }} className="font-bold mt-0.5">►</span>
                <span style={{ color: '#FFFFFF' }}>Don't cross red line!</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: '#8840FF' }} className="font-bold mt-0.5">►</span>
                <span style={{ color: '#FFFFFF' }}>Wait for ball to settle</span>
              </li>
            </ul>
          </div>

          {/* Ritual Wheel */}
          <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-green-400/30 p-6 rounded-2xl backdrop-blur-xl shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🔄</span>
              <h3 
                className="text-xl font-black"
                style={{ 
                  color: '#E554E8',
                  fontFamily: "'Barlow-ExtraBold', 'Barlow', sans-serif",
                }}
              >
                Merge Guide
              </h3>
            </div>
            <div className="flex justify-center">
              <img 
                src="/avatars/Ritual wheel.png"
                alt="Ritual Wheel"
                className="w-full max-w-[240px] h-auto"
                style={{ filter: 'drop-shadow(0 0 20px rgba(64,255,175,0.3))' }}
              />
            </div>
          </div>

          {/* Restart Button */}
          <button
            onClick={restartGame}
            className="w-full py-4 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl font-black text-white hover:scale-105 transition-transform shadow-lg shadow-red-500/30 border-2 border-red-400/30"
          >
            🔄 Restart Game
          </button>
        </div>
        </div>
        

      </div> {/* Close max-w-4xl (line 956) */}
      </div> {/* Close relative z-10 content wrapper (line 921) */}
    </main>
  );
}
