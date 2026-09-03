(() => {
  function patch() {
    if (!window.GAME_TYPES) return;
    const solo = ['snake','minesweeper','2048','solitaire','wordguess'];
    solo.forEach(id => { if (!GAME_TYPES[id]) GAME_TYPES[id] = {name:id, min:1, max:1, solo:true}; });
  }
  patch();
  setTimeout(patch,100);
  setTimeout(patch,500);
})();
