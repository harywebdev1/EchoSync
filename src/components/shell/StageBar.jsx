import { Menu, ChevronRight, Search, Globe2, Sun, Moon, MessageCircle, X } from 'lucide-react'
import { Avatar } from '../Avatar'

export function StageBar({
  room,
  view,
  inRoom,
  theme,
  onToggleTheme,
  onSearch,
  searchQuery, onSearchQuery, searchOpen,
  onToggleChat,
  chatOpen,
  unreadCount,
  onHome,
  currentUser,
  onOpenProfile,
  onLogin,
  onSignUp,
  onOpenSidebar,
  loungeOpen,
  unreadLoungeCount,
  onToggleLounge,
}) {
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
        <button className="icon-btn account-mobile" onClick={onOpenProfile} aria-label="Account and profile">
          <Avatar member={currentUser} />
        </button>
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
        <button className="icon-btn" onClick={onToggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
        {inRoom && view === 'room' && (
          <button
            className={`icon-btn chat-desktop-toggle ${chatOpen ? 'active' : ''}`}
            onClick={onToggleChat}
            aria-label={unreadCount ? `Toggle room chat, ${unreadCount} unread messages` : 'Toggle room chat'}
          >
            <MessageCircle />
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
