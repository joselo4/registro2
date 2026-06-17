if (self === top) {
  var antiClickjack = document.getElementById("antiClickjack");
  if (antiClickjack) {
    antiClickjack.parentNode.removeChild(antiClickjack);
  }
} else {
  top.location = self.location;
}

// Disable right click (anticlick)
document.addEventListener('contextmenu', function(e) {
  e.preventDefault();
});

// Disable inspector key shortcuts to prevent easy viewing of the page code
document.addEventListener('keydown', function(e) {
  if (
    e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
    (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
  ) {
    e.preventDefault();
    return false;
  }
});
