import { Menu, ChevronRight, Search, Globe2, Sun, Moon, MessageCircle } from 'lucide-react'
import { Avatar } from '../Avatar'

export function StageBar({
  room,
  view,
  inRoom,
  theme,
  onToggleTheme,
  onSearch,
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
      <div className="mobile-brand" onClick={onHome} role="button" tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && onHome()}>
        <div className="brand-glyph" style={{ width: 25, height: 25, borderRadius: 8 }}>
          <span className="bars" style={{ transform: 'scale(0.78)' }}><i /><i /><i /><i /></span>
        </div>
        <span className="brand-name" style={{ fontSize: 15 }}>Echo<span>Sync</span></span>
      </div>

      <div className="stage-crumb">
        {inRoom && <span className="live-pill"><span className="live-dot" /> LIVE</span>}
        {inRoom && <ChevronRight />}
        <strong>{view === 'rooms' ? 'All rooms' : view === 'library' ? 'Your library' : view === 'room' && inRoom ? room.name : 'Home'}</strong>
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
        <button className="icon-btn" onClick={onSearch} aria-label="Search">
          <Search />
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
