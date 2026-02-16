import { CardType } from '../network/protocol';

type SpawnCallback = (cardType: CardType, x: number, y: number) => void;

export class InputHandler {
  private canvas: HTMLCanvasElement;
  private onSpawn: SpawnCallback;
  private getSelectedCard: () => CardType | null;
  private isValidPosition: (y: number) => boolean;
  private getCanvasCoords: (clientX: number, clientY: number) => { x: number; y: number };

  constructor(
    canvas: HTMLCanvasElement,
    onSpawn: SpawnCallback,
    getSelectedCard: () => CardType | null,
    isValidPosition: (y: number) => boolean,
    getCanvasCoords: (clientX: number, clientY: number) => { x: number; y: number }
  ) {
    this.canvas = canvas;
    this.onSpawn = onSpawn;
    this.getSelectedCard = getSelectedCard;
    this.isValidPosition = isValidPosition;
    this.getCanvasCoords = getCanvasCoords;

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
  }

  private handlePointerDown(event: PointerEvent) {
    event.preventDefault();
    const selectedCard = this.getSelectedCard();
    if (!selectedCard) return;

    const coords = this.getCanvasCoords(event.clientX, event.clientY);
    
    if (!this.isValidPosition(coords.y)) {
      console.log('Invalid spawn position');
      return;
    }

    this.onSpawn(selectedCard, coords.x, coords.y);
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
  }
}
