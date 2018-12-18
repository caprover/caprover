function scrollToFixedFromTop(fromTopPx: number) {
  window.scrollTo(0, fromTopPx);
}

export function scrollToThebottom(delay: number) {
  if (!delay) {
    window.scrollTo(0, document.body.scrollHeight);
    return;
  }

  setTimeout(() => {
    window.scrollTo(0, document.body.scrollHeight);
  }, delay);
}

export function scrollToTopSearchBar(delay: number) {
  if (window.scrollY <= 120) return;

  if (!delay) {
    scrollToFixedFromTop(40);
    return;
  }

  setTimeout(() => {
    scrollToFixedFromTop(40);
  }, delay);
}
