/** Move the existing live scene into place; never replace the canvas or flash a cover. */
export class EntryTransition {
  private animation?: Animation;
  constructor(private readonly element: HTMLElement) {}
  play(from: DOMRect) {
    this.cancel();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const to = this.element.getBoundingClientRect();
    if (!to.width || !to.height || !from.width || !from.height) return;
    const dy = from.top - to.top;
    this.element.classList.add('entering-scene');
    const animation = this.element.animate(
      [
        {
          transform: `translate(${from.left - to.left}px, ${Math.abs(dy) < 2 ? 12 : dy}px) scale(${from.width / to.width}, ${from.height / to.height})`,
        },
        { transform: 'none' },
      ],
      { duration: 480, easing: 'cubic-bezier(.22,1,.36,1)' },
    );
    this.animation = animation;
    void animation.finished
      .catch(() => {})
      .then(() => {
        if (this.animation !== animation) return;
        this.animation = undefined;
        this.element.classList.remove('entering-scene');
      });
  }
  cancel = () => {
    this.animation?.cancel();
    this.animation = undefined;
    this.element.classList.remove('entering-scene');
  };
}
