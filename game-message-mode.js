/* GAME MESSAGE MODE
   Game state stays server-synchronized so multiplayer games keep working.
   The game state is tagged as a user message instead of a system message.
   games.js already recognizes __CHAT_GAME_STATE__: and keeps these out of
   the ordinary chat-message list, so the state is invisible as a normal chat
   message while the game UI remains visible to players.
*/
(() => {
  const GAME_PREFIX = '__CHAT_GAME_STATE__:';
  const originalWrite = window.writeGameState;
  if (typeof originalWrite !== 'function') return;

  window.writeGameState = async function(game) {
    if (!game?.id) return false;

    const payload = GAME_PREFIX + JSON.stringify(game);
    await window.apiPost({
      game_server: true,
      game_state: true,
      username: '__USER__',
      channel: 'public',
      message: payload,
      device_id: game.hostDeviceId
    });

    return true;
  };
})();
