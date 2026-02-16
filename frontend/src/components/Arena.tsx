import { useEffect, useRef, useCallback, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { wsClient } from '../network/websocket';
import { CardType, ARENA_WIDTH, ARENA_HEIGHT } from '../network/protocol';
import { Renderer } from '../engine/renderer';
import { GameSimulator } from '../engine/simulator';
import { InputHandler } from '../engine/input';

export function Arena() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const simulatorRef = useRef<GameSimulator>(new GameSimulator());
  const inputHandlerRef = useRef<InputHandler | null>(null);
  const animationFrameRef = useRef<number>(0);
  const selectedCardRef = useRef<CardType | null>(null);
  const elixirRef = useRef<number>(0);
  const displayElixirRef = useRef<number>(0);

  const [canvasSize, setCanvasSize] = useState({ width: ARENA_WIDTH, height: ARENA_HEIGHT });
  const [displayElixir, setDisplayElixir] = useState(0);

  const { gameState, playerNum, selectedCard, setClientElixir } = useGameStore();

  selectedCardRef.current = selectedCard;

  const handleSpawn = useCallback((cardType: CardType, x: number, y: number) => {
    const clampedX = Math.max(0, Math.min(ARENA_WIDTH, x));
    const clampedY = Math.max(0, Math.min(ARENA_HEIGHT, y));

    wsClient.send({
      type: 'SPAWN_UNIT',
      cardType,
      x: clampedX,
      y: clampedY,
    });
  }, []);

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const availableWidth = container.clientWidth;
      const availableHeight = container.clientHeight;

      const rawScale = Math.min(availableWidth / ARENA_WIDTH, availableHeight / ARENA_HEIGHT);
      const integerScale = Math.floor(rawScale);
      const scale = integerScale >= 1 ? integerScale : rawScale;

      const width = Math.floor(ARENA_WIDTH * scale);
      const height = Math.floor(ARENA_HEIGHT * scale);

      setCanvasSize({ width, height });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updateSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new Renderer(canvasRef.current);
    renderer.setPlayerNum(playerNum);
    renderer.setSimulator(simulatorRef.current);
    rendererRef.current = renderer;

    canvasRef.current.style.imageRendering = 'pixelated';
    canvasRef.current.style.touchAction = 'none';

    const inputHandler = new InputHandler(
      canvasRef.current,
      handleSpawn,
      () => selectedCardRef.current,
      (y) => renderer.isValidSpawnPosition(y),
      (clientX, clientY) => renderer.getCanvasCoordinates(clientX, clientY)
    );
    inputHandlerRef.current = inputHandler;

    let lastElixirUpdate = 0;

    const renderLoop = () => {
      const state = simulatorRef.current.update();
      renderer.render(state);

      const now = performance.now();
      if (now - lastElixirUpdate > 100) {
        const targetElixir = simulatorRef.current.getElixir(playerNum);
        if (elixirRef.current === 0 && targetElixir > 0) {
          elixirRef.current = targetElixir;
        }
        const smoothed = elixirRef.current + (targetElixir - elixirRef.current) * 0.2;
        elixirRef.current = smoothed;

        const newDisplay = Math.floor(smoothed + 1e-4);
        if (newDisplay !== displayElixirRef.current) {
          displayElixirRef.current = newDisplay;
          setDisplayElixir(newDisplay);
          setClientElixir(newDisplay);
        }
        lastElixirUpdate = now;
      }

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      inputHandler.destroy();
    };
  }, [playerNum, handleSpawn, setClientElixir]);

  useEffect(() => {
    if (!gameState) {
      simulatorRef.current.reset();
      elixirRef.current = 0;
      displayElixirRef.current = 0;
      setDisplayElixir(0);
      setClientElixir(0);
      return;
    }

    simulatorRef.current.setState(gameState);
  }, [gameState, setClientElixir]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setPlayerNum(playerNum);
    }
  }, [playerNum]);

  const elixirPercent = Math.min(100, (elixirRef.current / 10) * 100);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: '8px',
      flex: 1,
      width: '100%',
      minHeight: 0,
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px',
        padding: '8px 16px',
        background: '#2c3e50',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 'bold', color: '#9b59b6', fontSize: '14px' }}>ELIXIR</span>
        <div style={{ 
          width: '150px', 
          height: '20px', 
          background: '#1a1a2e',
          borderRadius: '4px',
          overflow: 'hidden',
          border: '2px solid #34495e'
        }}>
          <div style={{
            width: `${elixirPercent}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #9b59b6, #8e44ad)',
            boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.2)',
          }} />
        </div>
        <span style={{ 
          minWidth: '24px', 
          fontWeight: 'bold',
          color: '#9b59b6',
          fontSize: '16px',
          textAlign: 'center',
        }}>
          {displayElixir}
        </span>
      </div>
      
      <div 
        ref={containerRef}
        style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={canvasRef}
          width={ARENA_WIDTH}
          height={ARENA_HEIGHT}
          style={{
            width: canvasSize.width,
            height: canvasSize.height,
            border: '3px solid #2c3e50',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        />
      </div>
    </div>
  );
}
