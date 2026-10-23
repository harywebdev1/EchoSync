import { Logo } from './Logo.jsx'
import {
  X,
  Search,
  Home,
  Radio,
  Globe2,
  Library,
  KeyRound,
  Plus,
  MessageCircle,
  Lock,
  ListMusic,
  UserPlus,
  DoorOpen,
  Crown,
  MoreHorizontal,
} from 'lucide-react'
import { Equalizer } from './Equalizer.jsx'
import { Avatar } from '../Avatar'

export function Sidebar({
  room,
  rooms,
  view,
  onNavigate,
  onSearch,
  onJoinRoom,
  role,
  onInvite,
  likedCount,
  onOpenProfile,
  onCreateRoom,
  onJoinCode,
  onCreatePlaylist,
  playlists,
  onOpenPlaylist,
  onLeaveRoom,
  currentUser,
  inRoom,
  unreadRoomCounts,
  latestRoomPreview,
  loungeOpen,
  unreadLoungeCount,
  latestLoungePreview,
  onOpenLounge,
  mobileOpen,
  onMobileClose,
}) {
  const close = onMobileClose || (() => {})
  const navigate = (nextView) => {
    onNavigate(nextView)
    close()
  }
  const openSearch = () => {
    onSearch()
    close()
  }
  const openLounge = () => {
    onOpenLounge?.()
    close()
  }
  const openPlaylist = (playlist) => {
    onOpenPlaylist(playlist)
    close()
  }
  const openProfile = () => {
    onOpenProfile()
    close()
  }
  const joinRoom = (item) => {
    onJoinRoom(item)
    close()
  }
  const createRoom = () => {
    onCreateRoom()
    close()
  }

  return (
    <>
      <button
        className={`sidebar-scrim ${mobileOpen ? 'visible' : ''}`}
        onClick={close}
        aria-label="Close navigation"
        tabIndex={mobileOpen ? 0 : -1}
      />
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-head">
          <Logo />
          <button className="sidebar-close" onClick={close} aria-label="Close navigation">
            <X />
          </button>
        </div>

        <div className="side-middle">
          <button className="search-trigger" onClick={openSearch}>
            <Search size={14} />
            <span>Search songs, artists...</span>
            <kbd>Ctrl K</kbd>
          </button>

          <nav className="side-nav">
            <button className={`nav-item ${view === 'home' || (view === 'room' && !inRoom) ? 'active' : ''}`} onClick={() => navigate('home')}>
              <Home />
              <span>Home</span>
            </button>
            <button className={`nav-item ${view === 'rooms' ? 'active' : ''}`} onClick={() => navigate('rooms')}>
              <Radio />
              <span>Rooms</span>
              <span className="nav-count">{String(rooms.length).padStart(2, '0')}</span>
            </button>
            <div className={`lounge-nav-wrap ${latestLoungePreview ? 'has-preview' : ''}`}>
              {latestLoungePreview && (
                <button
                  type="button"
                  className="room-chat-preview lounge-chat-preview"
                  data-testid="lounge-preview"
                  onClick={openLounge}
                  aria-label={`Open Public Lounge: ${latestLoungePreview.text}`}
                >
                  <Globe2 size={10} />
                  <span className="room-chat-preview-copy">
                    <b>@{latestLoungePreview.sender}</b>
                    <span>{latestLoungePreview.text}</span>
                  </span>
                </button>
              )}
              <button
                className={`nav-item nav-lounge ${loungeOpen ? 'active' : ''}`}
                onClick={openLounge}
                data-testid="lounge-nav-btn"
                aria-pressed={loungeOpen}
              >
                <span className="nav-lounge-glyph"><Globe2 /><i className="lounge-online-dot" /></span>
                <span>Public Lounge</span>
                {unreadLoungeCount > 0 ? (
                  <span className="lounge-unread-pill" data-testid="lounge-sidebar-unread">
                    {unreadLoungeCount > 99 ? '99+' : unreadLoungeCount}
                  </span>
                ) : (
                  <span className="nav-count lounge-live-label">LIVE</span>
                )}
              </button>
            </div>
            <button className="nav-item" onClick={openSearch}>
              <Search />
              <span>Search</span>
            </button>
            <button className={`nav-item ${view === 'library' ? 'active' : ''}`} onClick={() => navigate('library')}>
              <Library />
              <span>Your library</span>
              <span className="nav-count">{String(likedCount).padStart(2, '0')}</span>
            </button>
          </nav>

          <div className="side-section side-rooms">
            <div className="side-label">
              <span>LISTENING ROOMS</span>
              <span className="side-label-actions">
                <button onClick={() => { onJoinCode(); close() }} aria-label="Join room by code"><KeyRound size={12} /></button>
                <button onClick={createRoom} aria-label="Create room"><Plus size={13} /></button>
              </span>
            </div>
            <div className="room-list">
              {rooms.length === 0 && (
                <p className="side-empty">No rooms yet. Start one and invite a friend.</p>
              )}
              {rooms.map((item) => {
                const unread = unreadRoomCounts?.[item.id] || 0
                const preview = latestRoomPreview?.[item.id]
                const connected = inRoom && room.id === item.id
                return (
                  <div key={item.id} className={`room-item-wrap ${unread ? 'has-unread' : ''}`}>
                    {preview && (
                      <button
                        key={preview.id}
                        type="button"
                        className="room-chat-preview"
                        data-testid={`room-chat-preview-${item.id}`}
                        onClick={() => joinRoom(item)}
                        aria-label={`Open ${item.name} chat: ${preview.text}`}
                      >
                        <MessageCircle size={10} />
                        <span className="room-chat-preview-copy">
                          <b>@{preview.sender}</b>
                          <span>{preview.text}</span>
                        </span>
                      </button>
                    )}
                    <button
                      className={`room-link ${inRoom && room.id === item.id && view === 'room' ? 'active' : ''} ${connected ? 'connected' : ''}`}
                      style={{ '--room-accent': item.accent }}
                      onClick={() => joinRoom(item)}
                      aria-label={`${item.name}${unread ? `, ${unread} unread messages` : ''}`}
                    >
                      <span className="room-dot" />
                      <span className="room-link-name">{item.name}</span>
                      {item.private
                        ? <Lock size={9} style={{ opacity: 0.45 }} aria-label="Private room" />
                        : <Globe2 size={9} style={{ opacity: 0.3 }} aria-label="Public room" />}
                      <Equalizer />
                      {unread > 0 && (
                        <span className="room-unread-pill" data-testid={`room-unread-${item.id}`}>
                          <MessageCircle size={9} />
                          <b>{unread > 99 ? '99+' : unread}</b>
                        </span>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="side-section side-playlists">
            <div className="side-label">
              <span>PLAYLISTS</span>
              <button onClick={() => { onCreatePlaylist(); close() }} aria-label="Create playlist"><Plus size={13} /></button>
            </div>
            <div className="room-list">
              {playlists.length === 0 && <p className="side-empty">Build your first playlist.</p>}
              {playlists.slice(0, 5).map((playlist) => (
                <button key={playlist.id} className="room-link playlist-link" onClick={() => openPlaylist(playlist)}>
                  <ListMusic size={12} />
                  <span className="room-link-name">{playlist.name}</span>
                  <span className="nav-count">{playlist.trackIds.length}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="side-bottom">
          {inRoom ? (
            <div className="invite-card">
              <strong>Listening is better together.</strong>
              <p>Code <b>{room.code}</b> - playback stays in lockstep.</p>
              <button onClick={onInvite}><UserPlus size={11} /> Copy invite link</button>
              <button className="leave-room-btn" onClick={() => { onLeaveRoom(); close() }}><DoorOpen size={11} /> Leave room</button>
            </div>
          ) : (
            <div className="invite-card">
              <strong>Start a listening room.</strong>
              <p>Bring your queue to a friend. Everyone hears the same beat.</p>
              <button onClick={createRoom}><Plus size={11} /> Create a room</button>
            </div>
          )}
          <button className="profile" onClick={openProfile}>
            <Avatar member={currentUser} online />
            <span className="profile-meta">
              <strong>{currentUser?.name || 'Sign in'}</strong>
              <span>@{currentUser?.handle || 'guest'}{inRoom && <> · <Crown size={10} /> {role}</>}</span>
            </span>
            <MoreHorizontal size={15} />
          </button>
        </div>
      </aside>
    </>
  )
}
