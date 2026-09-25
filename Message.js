// Update the Message component to properly handle polls
function Message({ 
  message, 
  isOwn, 
  onDelete, 
  onStartEdit, 
  onSaveEdit, 
  onCancelEdit, 
  isEditing, 
  formatMessageText, 
  onSpeak, 
  ttsEnabled, 
  onVote, 
  playEffect, 
  room,
  username 
}) {
  const [editText, setEditText] = useState(message.text || '');
  const displayName = message.nickname || message.username;
  const storedNickname = localStorage.getItem(`chatNickname_${message.username}`);
  const finalDisplayName = storedNickname || displayName;
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.addEventListener('loadeddata', () => {
        videoRef.current.classList.add('loaded');
      });
    }
  }, [message.video]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onSaveEdit(message.id, editText);
    } else if (e.key === 'Escape') {
      onCancelEdit();
    }
  };

  useEffect(() => {
    setEditText(message.text || '');
  }, [message.text]);

  return (
    <div className={`message ${isOwn ? 'own' : ''} ${message.isAI ? 'ai-message' : ''}`}>
      <img 
        className="message-avatar"
        src={message.isAI ? 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzAwN2JmZiIgZD0iTTEyIDJhMTAgMTAgMCAwIDEgMTAgMTBjMCA1LjUyMy00LjQ3NyAxMC0xMCAxMFMyIDIxLjUyMyAyIDE2YzAtMS43OTQuNDctMy40NzggMS4zMDItNC45NTZhMTAuMDIxIDEwLjAyMSAwIDAgMSAyLjUyLTIuODU4QTkuOTU0IDkuOTU0IDAgMCAxIDEyIDJ6bTAgMmE4IDggMCAwIDAtOCA4YzAgNC40MTggMy41ODIgOCA4IDhzOC0zLjU4MiA4LTgtMy41ODItOC04LTh6bTEgM3Y2aC00di0yaDJ2LTRoMnptMCA4YTEgMSAwIDEgMSAwIDIgMSAxIDAgMCAxIDAtMnoiLz48L3N2Zz4=' : `https://images.websim.ai/avatar/${message.username}`}
        alt={finalDisplayName}
      />
      <div className="message-content">
        {isOwn && (
          <div className="message-actions">
            <button 
              className="edit-message"
              onClick={() => onStartEdit(message.id)}
              title="Edit message"
            >
              ✎
            </button>
            <button 
              className="delete-message"
              onClick={() => onDelete(message.id)}
              title="Delete message"
            >
              ×
            </button>
          </div>
        )}
        <div><strong>{finalDisplayName}</strong></div>
        {isEditing ? (
          <div>
            <input
              type="text"
              className="edit-input"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              placeholder="Edit message..."
            />
            <div style={{fontSize: '0.8em', marginTop: '0.2rem'}}>
              Press Enter to save, Esc to cancel
            </div>
          </div>
        ) : (
          <>
            {message.text && <div>{formatMessageText(message.text)}</div>}
            {message.images && message.images.map((url, index) => (
              <img key={index} src={url} alt="Shared image" className="shared-image" />
            ))}
            {message.file && (
              message.fileType.startsWith('image/') ? (
                <img src={message.file} alt={message.fileName} />
              ) : (
                <a href={message.file} target="_blank" download={message.fileName}>
                  📎 {message.fileName}
                </a>
              )
            )}
            {message.audio && (
              <audio controls src={message.audio}></audio>
            )}
            {message.video && (
              <video 
                ref={videoRef}
                controls 
                src={message.video} 
                style={{
                  maxWidth: '100%',
                  borderRadius: '8px',
                  marginTop: '0.5rem'
                }}
              ></video>
            )}
            {message.text && ttsEnabled && (
              <button 
                className="tts-button" 
                onClick={() => onSpeak(message.text)}
                title="Text to Speech"
              >
                🔊
              </button>
            )}
            {message.isPoll && message.pollData && (
              <div className="poll">
                <h4>{message.pollData.title}</h4>
                {message.pollData.options.map((option, index) => {
                  const votes = message.pollData.votes?.[index] || [];
                  const totalVotes = Object.values(message.pollData.votes || {})
                    .reduce((sum, voters) => sum + (voters?.length || 0), 0);
                  const percentage = totalVotes === 0 ? 0 : (votes.length / totalVotes) * 100;
                  
                  const hasVoted = votes.includes(username);
                  
                  return (
                    <div key={index} className="poll-option">
                      <button 
                        onClick={() => onVote(message.id, message.pollData, index)}
                        className={hasVoted ? 'voted' : ''}
                      >
                        {option}
                        <div className="vote-bar" style={{width: `${percentage}%`}}></div>
                        <span className="vote-count">
                          {votes.length} vote{votes.length !== 1 ? 's' : ''}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}