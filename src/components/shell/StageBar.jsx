import { useEffect, useRef, useState } from 'react'
import { Menu, Search, Globe2, MessageCircle, UserRound, Settings, X } from 'lucide-react'
import { Avatar } from '../Avatar'

export function StageBar({
  room,
  view,
  inRoom,
  onSearch,
  searchQuery, onSearchQuery, searchOpen,
  onToggleChat,
  chatOpen,
  unreadCount,
  onHome,
  currentUser,
  onOpenProfile,
  onOpenChannel,
  onLogin,
  onSignUp,
  onOpenSidebar,
  loungeOpen,
  unreadLoungeCount,
  onToggleLounge,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  useEffect(() => {
    if (!menuOpen) return undefined
    const onPointer = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    const onKey = (event) => { if (event.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])
  useEffect(() => { if (!currentUser) setMenuOpen(false) }, [currentUser])
  return (
    <header className="stage-bar">
      <button className="icon-btn mobile-menu-btn" onClick={onOpenSidebar} aria-label="Open navigation">
        <Menu />
      </button>
      <div className="mobile-brand" aria-label="EchoSync Home" onClick={onHome} role="button" tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && onHome()}>
        <div className="brand-glyph" style={{ width: 25, height: 25, borderRadius: 8 }}>
          <span className="bars" style={{ transform: 'scale(0.78)' }}><i /><i /><i /><i /></span>
        </div>
        <span className="brand-name" style={{ fontSize: 15 }}>Echo<span>Sync</span></span>
      </div>


      <div className="canonical-search" data-testid="canonical-search">
        <Search aria-hidden="true" />
        <input id="canonical-search-input" type="search" aria-label="Search songs, artists, moods" aria-expanded={searchOpen} aria-controls="search-command-surface" autoComplete="off" value={searchQuery} onFocus={onSearch} onClick={onSearch} onChange={event => onSearchQuery(event.target.value)} placeholder="Search songs, artists, moods…" onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); document.querySelector('#search-command-surface button')?.focus() } }} />
        {searchQuery ? <button className="icon-btn" aria-label="Clear search" onClick={() => { onSearchQuery(''); document.getElementById('canonical-search-input')?.focus() }}><X /></button> : <kbd>Ctrl K</kbd>}
      </div>
      <div className="stage-actions">
        {!currentUser && (
          <div className="guest-actions">
            <button className="text-btn guest-login" onClick={onLogin}>Log in</button>
            <button className="primary-btn guest-signup" onClick={onSignUp}>Sign up</button>
          </div>
        )}
        <div className="account-menu-wrap" ref={menuRef}>
          <button
            className="icon-btn account-mobile"
            onClick={() => (currentUser ? setMenuOpen((value) => !value) : onOpenProfile())}
            aria-label={currentUser ? 'Account and profile' : 'Log in or sign up'}
            aria-haspopup={currentUser ? 'menu' : undefined}
            aria-expanded={currentUser ? menuOpen : undefined}
          >
            {currentUser ? <Avatar member={currentUser} /> : <UserRound />}
          </button>
          {currentUser && menuOpen && (
            <div className="account-menu" role="menu">
              <span className="account-menu-label">@{currentUser.handle || 'listener'}</span>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onOpenChannel?.(currentUser) }}>
                <UserRound /> View channel
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onOpenProfile() }}>
                <Settings /> Settings
              </button>
            </div>
          )}
        </div>
        <button
          className={`lounge-header-btn ${loungeOpen ? 'active' : ''}`}
          onClick={onToggleLounge}
          aria-label={unreadLoungeCount ? `Open Public Lounge, ${unreadLoungeCount} unread messages` : 'Open Public Lounge'}
          aria-pressed={loungeOpen}
          data-testid="lounge-header-btn"
        >
          <Globe2 />
          <span>Lounge</span>
          <i className="lounge-online-dot" />
          {unreadLoungeCount > 0 && (
            <b className="lounge-header-unread" data-testid="lounge-header-unread">
              {unreadLoungeCount > 99 ? '99+' : unreadLoungeCount}
            </b>
          )}
        </button>
        {inRoom && view === 'room' && (
          <button
            className={`icon-btn chat-desktop-toggle ${chatOpen ? 'active' : ''}`}
            onClick={onToggleChat}
            aria-label={unreadCount ? `Toggle room chat, ${unreadCount} unread messages` : 'Toggle room chat'}
          >
            <MessageCircle />
            <span className="chat-toggle-label">Chat</span>
            {!chatOpen && unreadCount > 0 && (
              <span className="chat-unread-badge" data-testid="chat-toggle-unread">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  )
}
