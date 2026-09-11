export type DragFeedback = {
  origin: { x: number; y: number };
  pointer: { x: number; y: number };
  armed: boolean;
  cancelled: boolean;
};

export class ReturnCancel {
  armed = false;
  cancelled = false;

  update(distance: number) {
    if (distance >= 28) this.armed = true;
    if (this.armed) {
      if (this.cancelled && distance >= 22) this.cancelled = false;
      else if (!this.cancelled && distance <= 14) this.cancelled = true;
    }
    return this.cancelled;
  }

  clear() {
    this.armed = false;
    this.cancelled = false;
  }
}
