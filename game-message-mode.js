/* GAME MESSAGE MODE
   Multiplayer games are retired. Old game-state messages may still exist on
   the server, but they are never shown as playable game cards anymore.
   The new singleplayer-games.js file owns the Games UI and uses local bots.
*/
(() => {
  const style = document.createElement('style');
  style.id = 'no-multiplayer-games-style';
  style.textContent = '.game-message{display:none!important}';
  document.head.appendChild(style);
})();
