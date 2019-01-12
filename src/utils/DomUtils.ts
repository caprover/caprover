function scrollToFixedFromTop(fromTopPx: number, el: HTMLElement) {
  window.scrollTo(0, fromTopPx);
  el.scrollTo({
    top: fromTopPx,
    behavior: "smooth"
  });
}

export default {
  scrollToTopBar(delay?: number) {
    const el = document.getElementById("main-content-layout");
    const currScroll = el ? el.scrollTop : 0;
    if (currScroll <= 120) return;

    if (!delay) {
      scrollToFixedFromTop(0, el!);
      return;
    }

    setTimeout(() => {
      scrollToFixedFromTop(0, el!);
    }, delay);
  },
  scrollToThebottom(delay: number) {
    if (!delay) {
      window.scrollTo(0, document.body.scrollHeight);
      return;
    }

    setTimeout(() => {
      window.scrollTo(0, document.body.scrollHeight);
    }, delay);
  }
};
