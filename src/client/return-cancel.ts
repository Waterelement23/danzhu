export type ScreenMarble = { x: number; y: number; radius: number };
export type DragFeedback = {
  marble: ScreenMarble;
  cancelled: boolean;
};

/** Leave the real marble before returning; the 8px gap prevents boundary jitter. */
export class ReturnCancel {
  armed = false;
  cancelled = false;

  begin(distance: number, radius: number) {
    this.clear();
    this.armed = distance > radius;
  }

  update(distance: number, radius: number) {
    if (distance >= radius + 8) this.armed = true;
    if (this.armed) {
      if (this.cancelled && distance >= radius + 8) this.cancelled = false;
      else if (!this.cancelled && distance <= radius) this.cancelled = true;
    }
    return this.cancelled;
  }

  clear() {
    this.armed = false;
    this.cancelled = false;
  }
}

/** Prefer the left side, away from the player name on the marble's right. */
export function meterPosition(ball: ScreenMarble, size: { width: number; height: number }) {
  const left = ball.x - ball.radius - 24 - 104;
  return {
    x: Math.max(8, Math.min(size.width - 112, left >= 8 ? left : ball.x + ball.radius + 24)),
    y: Math.max(8, Math.min(size.height - 92, left >= 8 ? ball.y - 42 : ball.y + 24)),
  };
}
